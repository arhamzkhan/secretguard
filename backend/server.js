const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb, saveScan, getScanById } = require('./db');
const { validateRepoUrl, cleanupOldScans, scanRepo } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Startup checks
cleanupOldScans();
initDb();

// API Endpoints
app.post('/api/scan-repo', async (req, res) => {
  try {
    const { repoUrl } = req.body || {};

    if (!repoUrl || !validateRepoUrl(repoUrl)) {
      return res.status(400).json({
        error: "Invalid GitHub repository URL. Must match format: https://github.com/owner/repo"
      });
    }

    const scanResults = await scanRepo(repoUrl);
    const savedRecord = await saveScan(scanResults.repoUrl, scanResults);

    return res.status(200).json(savedRecord);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.message || "An unexpected error occurred while scanning the repository."
    });
  }
});

app.get('/api/repo-scans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await getScanById(id);

    if (!record) {
      return res.status(404).json({ error: "Scan result not found." });
    }

    return res.status(200).json(record);
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve scan result." });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SecretGuard Backend v1' });
});

app.listen(PORT, () => {
  console.log(`SecretGuard Backend listening on port ${PORT}`);
});
