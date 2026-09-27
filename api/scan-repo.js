import { saveScan } from '../lib/db.js';
import { validateRepoUrl, cleanupOldScans, scanRepo } from '../lib/scanner.js';

// Tell Vercel to allow up to 60 seconds for this function (Hobby tier maximum).
// Cloning + scanning a real repo can easily exceed the 10s default.
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { repoUrl } = req.body || {};

  if (!repoUrl || !validateRepoUrl(repoUrl)) {
    return res.status(400).json({
      error: 'Invalid GitHub repository URL. Must match format: https://github.com/owner/repo',
    });
  }

  // Clean up any leftover /tmp/scans entries from crashed previous invocations
  cleanupOldScans();

  try {
    const scanResults = await scanRepo(repoUrl);
    const savedRecord = await saveScan(scanResults.repoUrl, scanResults);
    return res.status(200).json(savedRecord);
  } catch (err) {
    console.error('[Vercel API Error /api/scan-repo]:', err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.message || 'An unexpected error occurred while scanning the repository.',
    });
  }
}
