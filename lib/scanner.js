import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';
import { signatures } from './signatures.js';

// Vercel: /tmp is the only writable directory in serverless functions.
const BASE_SCAN_DIR = '/tmp/scans';

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;

export function validateRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return GITHUB_URL_REGEX.test(url.trim());
}

function normalizeRepoUrl(url) {
  let cleaned = url.trim().replace(/\/$/, '');
  if (cleaned.endsWith('.git')) cleaned = cleaned.slice(0, -4);
  return cleaned;
}

/**
 * Best-effort cleanup of leftover /tmp/scans entries older than 1 hour.
 * Called at the start of each invocation — serverless containers can be reused,
 * so old clones from crashed invocations may still be around.
 */
export function cleanupOldScans() {
  try {
    if (!fs.existsSync(BASE_SCAN_DIR)) return;
    const items = fs.readdirSync(BASE_SCAN_DIR);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const item of items) {
      const itemPath = path.join(BASE_SCAN_DIR, item);
      try {
        const stats = fs.statSync(itemPath);
        if (now - stats.mtimeMs > ONE_HOUR) {
          fs.rmSync(itemPath, { recursive: true, force: true });
          console.log(`[scanner] Cleaned stale clone: ${itemPath}`);
        }
      } catch (_) {
        // Skip items we can't stat — already deleted or permission issue
      }
    }
  } catch (err) {
    console.warn('[scanner] Startup cleanup warning:', err.message);
  }
}

function getFolderSize(dirPath) {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getFolderSize(fullPath);
      } else if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
      }
    }
  } catch (_) {
    // Ignore unreadable entries
  }
  return totalSize;
}

function isBinary(buffer) {
  const maxBytes = Math.min(buffer.length, 512);
  for (let i = 0; i < maxBytes; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function maskSecret(matchStr) {
  const len = matchStr.length;
  if (len > 8) {
    const first4 = matchStr.slice(0, 4);
    const last4 = matchStr.slice(-4);
    const middleCount = Math.max(4, len - 8);
    return `${first4}${'*'.repeat(middleCount)}${last4}`;
  } else if (len >= 4) {
    return `${matchStr.slice(0, 2)}****${matchStr.slice(-2)}`;
  }
  return '****';
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor']);
const MAX_FILE_SIZE = 1 * 1024 * 1024;   // 1 MB — skip large files
const MAX_REPO_SIZE = 200 * 1024 * 1024; // 200 MB — fail fast to avoid timeout
// Clone timeout: leave 15s headroom for scanning within the 60s function limit
const CLONE_TIMEOUT_MS = 45_000;

export async function scanRepo(repoUrl) {
  if (!validateRepoUrl(repoUrl)) {
    const err = new Error('Invalid GitHub repository URL. Must match: https://github.com/owner/repo');
    err.statusCode = 400;
    throw err;
  }

  const cleanUrl = normalizeRepoUrl(repoUrl);
  const scanId = uuidv4();
  const scanDir = path.join(BASE_SCAN_DIR, scanId);

  // Ensure /tmp/scans exists (writable on Vercel)
  if (!fs.existsSync(BASE_SCAN_DIR)) {
    fs.mkdirSync(BASE_SCAN_DIR, { recursive: true });
  }

  const git = simpleGit({
    baseDir: BASE_SCAN_DIR,
    binary: 'git',
    maxConcurrentProcesses: 2,
  });

  try {
    // --- Shallow clone with hard timeout ---
    let timeoutTimer = null;
    const clonePromise = git.clone(cleanUrl, scanDir, ['--depth', '1']);
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('CLONE_TIMEOUT')), CLONE_TIMEOUT_MS);
    });

    try {
      await Promise.race([clonePromise, timeoutPromise]);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    // --- Fail-fast size guard (before scanning) ---
    // This runs immediately after clone so we reject large repos before burning
    // any more of the 60s function budget on scanning.
    const repoSize = getFolderSize(scanDir);
    if (repoSize > MAX_REPO_SIZE) {
      const sizeErr = new Error('Repository too large for v1 scanning (200MB limit).');
      sizeErr.statusCode = 400;
      throw sizeErr;
    }

    // --- File walk & pattern match ---
    const findings = [];
    let totalFindingsCount = 0;

    function walkAndScan(currentDir) {
      if (findings.length >= 50) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (findings.length >= 50) break;

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(scanDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) walkAndScan(fullPath);
          continue;
        }

        if (!entry.isFile()) continue;

        // --- .env file detection ---
        const basename = entry.name.toLowerCase();
        if (
          basename === '.env' ||
          (basename.startsWith('.env.') &&
            !basename.includes('example') &&
            !basename.includes('sample') &&
            !basename.includes('template') &&
            !basename.includes('test'))
        ) {
          totalFindingsCount++;
          findings.push({
            file: relativePath,
            line: 1,
            pattern: '.env file committed',
            severity: 'medium',
            matchPreview: '.env',
            what: 'A committed environment configuration file (.env) was found in the repository.',
            why: '.env files usually contain sensitive environment variables, database credentials, and secret keys intended strictly for local or server environments.',
            fix: 'Add .env to your .gitignore file, remove it from git tracking (git rm --cached .env), and commit the change.',
          });
        }

        // --- Skip oversized or empty files ---
        let stats;
        try { stats = fs.statSync(fullPath); } catch (_) { continue; }
        if (stats.size === 0 || stats.size > MAX_FILE_SIZE) continue;

        // --- Skip binary files ---
        let buffer;
        try { buffer = fs.readFileSync(fullPath); } catch (_) { continue; }
        if (isBinary(buffer)) continue;

        // --- Pattern match line-by-line ---
        const lines = buffer.toString('utf8').split(/\r?\n/);
        for (let l = 0; l < lines.length; l++) {
          if (findings.length >= 50) break;
          const lineContent = lines[l];
          if (!lineContent.trim()) continue;

          for (const sig of signatures) {
            if (findings.length >= 50) break;
            sig.regex.lastIndex = 0;
            let match;
            while ((match = sig.regex.exec(lineContent)) !== null) {
              totalFindingsCount++;
              findings.push({
                file: relativePath,
                line: l + 1,
                pattern: sig.name,
                severity: sig.severity,
                matchPreview: maskSecret(match[0]),
                what: sig.what,
                why: sig.why,
                fix: sig.fix,
              });
              if (findings.length >= 50) break;
              if (match.index === sig.regex.lastIndex) sig.regex.lastIndex++;
            }
          }
        }
      }
    }

    walkAndScan(scanDir);

    return {
      repoUrl: cleanUrl,
      scannedAt: new Date().toISOString(),
      findings,
      truncated: totalFindingsCount > 50,
      totalFindings: totalFindingsCount,
      summary: {
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
      },
    };

  } catch (err) {
    // --- Translate git / timeout errors into clean user-facing messages ---
    if (err.message === 'CLONE_TIMEOUT' || err.code === 'ETIMEDOUT') {
      const tErr = new Error('Repo too large or unreachable — try a smaller repo');
      tErr.statusCode = 400;
      throw tErr;
    }

    const msg = err.message || '';
    if (
      msg.includes('Repository not found') ||
      msg.includes('Authentication failed') ||
      msg.includes('Could not read from remote repository') ||
      msg.includes('Terminal prompts disabled') ||
      msg.includes('404')
    ) {
      const pErr = new Error('Repository not found or private. SecretGuard only scans public repositories.');
      pErr.statusCode = 404;
      throw pErr;
    }

    // Re-throw errors we already annotated (size guard, URL validation)
    if (err.statusCode) throw err;

    const netErr = new Error(`Network or clone error: ${msg || 'Failed to access repository'}`);
    netErr.statusCode = 500;
    throw netErr;

  } finally {
    // Always delete the clone — whether we succeeded, errored, or timed out
    try {
      if (fs.existsSync(scanDir)) {
        fs.rmSync(scanDir, { recursive: true, force: true });
      }
    } catch (cleanErr) {
      console.warn(`[scanner] Failed to delete clone ${scanDir}:`, cleanErr.message);
    }
  }
}
