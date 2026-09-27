import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as tar from 'tar';
import { signatures } from './signatures.js';

// Vercel: /tmp is the only writable directory in serverless functions.
// For local fallback OS, use system tmpdir if /tmp is not available.
const BASE_SCAN_DIR = process.platform === 'win32'
  ? path.join(os.tmpdir(), 'scans')
  : '/tmp/scans';

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

function parseOwnerRepo(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Best-effort cleanup of leftover scan entries older than 1 hour.
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
          console.log(`[scanner] Cleaned stale scan: ${itemPath}`);
        }
      } catch (_) {
        // Skip un-statable items
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
const FETCH_TIMEOUT_MS = 45_000;         // 45 seconds timeout for tarball fetch & extract

export async function scanRepo(repoUrl) {
  if (!validateRepoUrl(repoUrl)) {
    const err = new Error('Invalid GitHub repository URL. Must match: https://github.com/owner/repo');
    err.statusCode = 400;
    throw err;
  }

  const cleanUrl = normalizeRepoUrl(repoUrl);
  const ownerRepo = parseOwnerRepo(cleanUrl);
  if (!ownerRepo) {
    const err = new Error('Could not parse GitHub repository owner and name.');
    err.statusCode = 400;
    throw err;
  }

  const scanId = uuidv4();
  const scanDir = path.join(BASE_SCAN_DIR, scanId);
  const tarPath = path.join(scanDir, 'repo.tar.gz');
  const extractDir = path.join(scanDir, 'extracted');

  // Ensure directories exist
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    // --- Fetch Tarball via GitHub API ---
    const tarballApiUrl = `https://api.github.com/repos/${ownerRepo.owner}/${ownerRepo.repo}/tarball`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(tarballApiUrl, {
        headers: {
          'User-Agent': 'SecretGuard-Scanner',
          'Accept': 'application/vnd.github+json',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        const tErr = new Error('Repo too large or unreachable — try a smaller repo');
        tErr.statusCode = 400;
        throw tErr;
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404 || response.status === 403) {
      const pErr = new Error('Repository not found or private. SecretGuard only scans public repositories.');
      pErr.statusCode = 404;
      throw pErr;
    }

    if (!response.ok) {
      const err = new Error(`Failed to download repository tarball (HTTP ${response.status} ${response.statusText})`);
      err.statusCode = response.status >= 500 ? 500 : 400;
      throw err;
    }

    // Write tarball to /tmp/scans/{uuid}/repo.tar.gz
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tarPath, Buffer.from(arrayBuffer));

    // Extract tarball using pure-JS tar package
    await tar.x({
      file: tarPath,
      cwd: extractDir,
    });

    // GitHub tarballs unpack into a single root directory inside extractDir (e.g. owner-repo-sha)
    const extractedEntries = fs.readdirSync(extractDir, { withFileTypes: true });
    let rootScanDir = extractDir;
    if (extractedEntries.length === 1 && extractedEntries[0].isDirectory()) {
      rootScanDir = path.join(extractDir, extractedEntries[0].name);
    }

    // --- Fail-fast size guard (before scanning) ---
    const repoSize = getFolderSize(rootScanDir);
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
        const relativePath = path.relative(rootScanDir, fullPath).replace(/\\/g, '/');

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

    walkAndScan(rootScanDir);

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
    if (err.statusCode) throw err;

    const msg = err.message || '';
    const netErr = new Error(`Network or fetch error: ${msg || 'Failed to download repository tarball'}`);
    netErr.statusCode = 500;
    throw netErr;

  } finally {
    // Always delete the temp scan directory — whether we succeeded, errored, or timed out
    try {
      if (fs.existsSync(scanDir)) {
        fs.rmSync(scanDir, { recursive: true, force: true });
      }
    } catch (cleanErr) {
      console.warn(`[scanner] Failed to delete scan directory ${scanDir}:`, cleanErr.message);
    }
  }
}
