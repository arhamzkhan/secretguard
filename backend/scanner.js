const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const simpleGit = require('simple-git');
const signatures = require('./signatures');

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;

function validateRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return GITHUB_URL_REGEX.test(url.trim());
}

function normalizeRepoUrl(url) {
  let cleaned = url.trim().replace(/\/$/, '');
  if (cleaned.endsWith('.git')) {
    cleaned = cleaned.slice(0, -4);
  }
  return cleaned;
}

const BASE_SCAN_DIR = path.join(os.tmpdir(), 'secretguard_scans');

function cleanupOldScans() {
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
          console.log(`Cleaned up stale scan directory: ${itemPath}`);
        }
      } catch (err) {
        // Ignore single folder cleanup error
      }
    }
  } catch (err) {
    console.warn('Startup scan cleanup warning:', err.message);
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
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (err) {
    // Ignore unreadable entries
  }
  return totalSize;
}

function isBinary(buffer) {
  const maxBytes = Math.min(buffer.length, 512);
  let nulls = 0;
  for (let i = 0; i < maxBytes; i++) {
    if (buffer[i] === 0) nulls++;
  }
  return nulls > 0;
}

function maskSecret(matchStr) {
  const len = matchStr.length;
  if (len > 8) {
    const first4 = matchStr.slice(0, 4);
    const last4 = matchStr.slice(-4);
    const middleCount = Math.max(4, len - 8);
    return `${first4}${'*'.repeat(middleCount)}${last4}`;
  } else if (len >= 4) {
    const first2 = matchStr.slice(0, 2);
    const last2 = matchStr.slice(-2);
    return `${first2}****${last2}`;
  } else {
    return '****';
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor']);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_REPO_SIZE = 200 * 1024 * 1024; // 200MB
const CLONE_TIMEOUT_MS = 30000; // 30 seconds

async function scanRepo(repoUrl) {
  if (!validateRepoUrl(repoUrl)) {
    const err = new Error('Invalid GitHub repository URL. Must be in the format https://github.com/owner/repo');
    err.statusCode = 400;
    throw err;
  }

  const cleanUrl = normalizeRepoUrl(repoUrl);
  const scanId = uuidv4();
  const scanDir = path.join(BASE_SCAN_DIR, scanId);

  if (!fs.existsSync(BASE_SCAN_DIR)) {
    fs.mkdirSync(BASE_SCAN_DIR, { recursive: true });
  }

  const git = simpleGit({
    baseDir: BASE_SCAN_DIR,
    binary: 'git',
    maxConcurrentProcesses: 2,
  });

  try {
    let cloneTimedOut = false;
    let timeoutTimer = null;

    const clonePromise = git.clone(cleanUrl, scanDir, ['--depth', '1']);

    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => {
        cloneTimedOut = true;
        reject(new Error('CLONE_TIMEOUT'));
      }, CLONE_TIMEOUT_MS);
    });

    try {
      await Promise.race([clonePromise, timeoutPromise]);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    // Disk Size Guard
    const repoSize = getFolderSize(scanDir);
    if (repoSize > MAX_REPO_SIZE) {
      const sizeErr = new Error('Repository too large for v1 scanning (200MB limit).');
      sizeErr.statusCode = 400;
      throw sizeErr;
    }

    // Walk files & scan
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
          if (SKIP_DIRS.has(entry.name)) continue;
          walkAndScan(fullPath);
        } else if (entry.isFile()) {
          // Check .env file detection
          const basename = entry.name.toLowerCase();
          if (basename === '.env' || (basename.startsWith('.env.') && !basename.includes('example') && !basename.includes('sample') && !basename.includes('template') && !basename.includes('test'))) {
            totalFindingsCount++;
            findings.push({
              file: relativePath,
              line: 1,
              pattern: ".env file committed",
              severity: "medium",
              matchPreview: ".env",
              what: "A committed environment configuration file (.env) was found in the repository.",
              why: ".env files usually contain sensitive environment variables, database credentials, and secret keys intended strictly for local or server environments.",
              fix: "Add .env to your .gitignore file, remove it from git tracking (git rm --cached .env), and commit the change."
            });
          }

          // Check file size limit
          let stats;
          try {
            stats = fs.statSync(fullPath);
          } catch (e) {
            continue;
          }
          if (stats.size > MAX_FILE_SIZE || stats.size === 0) continue;

          // Read file content and check if binary
          let buffer;
          try {
            buffer = fs.readFileSync(fullPath);
          } catch (e) {
            continue;
          }

          if (isBinary(buffer)) continue;

          const content = buffer.toString('utf8');
          const lines = content.split(/\r?\n/);

          for (let l = 0; l < lines.length; l++) {
            if (findings.length >= 50) break;

            const lineContent = lines[l];
            if (!lineContent.trim()) continue;

            for (const sig of signatures) {
              if (findings.length >= 50) break;

              // Reset regex index
              sig.regex.lastIndex = 0;
              let match;
              while ((match = sig.regex.exec(lineContent)) !== null) {
                totalFindingsCount++;
                const matchedText = match[0];
                const masked = maskSecret(matchedText);

                findings.push({
                  file: relativePath,
                  line: l + 1,
                  pattern: sig.name,
                  severity: sig.severity,
                  matchPreview: masked,
                  what: sig.what,
                  why: sig.why,
                  fix: sig.fix
                });

                if (findings.length >= 50) break;
                // Avoid infinite loop on 0-width match
                if (match.index === sig.regex.lastIndex) {
                  sig.regex.lastIndex++;
                }
              }
            }
          }
        }
      }
    }

    walkAndScan(scanDir);

    const severityCounts = {
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    return {
      repoUrl: cleanUrl,
      scannedAt: new Date().toISOString(),
      findings,
      truncated: totalFindingsCount > 50,
      totalFindings: totalFindingsCount,
      summary: severityCounts
    };

  } catch (err) {
    if (err.message === 'CLONE_TIMEOUT' || err.code === 'ETIMEDOUT') {
      const tErr = new Error("Repo too large or unreachable — try a smaller repo");
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
      const pErr = new Error("Repository not found or private. SecretGuard only scans public repositories.");
      pErr.statusCode = 404;
      throw pErr;
    }

    if (err.statusCode) {
      throw err;
    }

    const netErr = new Error(`Network or clone error: ${msg || 'Failed to access repository'}`);
    netErr.statusCode = 500;
    throw netErr;

  } finally {
    // Cleanup clone folder immediately
    try {
      if (fs.existsSync(scanDir)) {
        fs.rmSync(scanDir, { recursive: true, force: true });
      }
    } catch (cleanErr) {
      console.warn(`Failed to delete clone directory ${scanDir}:`, cleanErr.message);
    }
  }
}

module.exports = {
  validateRepoUrl,
  cleanupOldScans,
  scanRepo
};
