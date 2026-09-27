# SecretGuard

A public GitHub repository scanner that detects accidentally committed secrets — API keys, tokens, credentials — before they become a real problem. Paste a repo URL, get a findings report with severity, masked previews, and remediation guidance.

**Live demo:** https://trysecretguard.vercel.app 

## What it detects

- AWS Access Keys & Secret Keys
- GitHub Personal Access Tokens
- Slack Tokens
- Stripe Live Keys
- Google API Keys
- Generic API key / password assignments
- Committed `.env` files
- Private key blocks (RSA/EC)

Every finding shows the file, line number, a masked preview (never the full secret), and a plain-language what/why/fix explanation.

## How it works

1. Fetches the repo as a tarball via GitHub's API (no `git` binary needed — works in serverless environments)
2. Extracts and walks all text files, skipping `node_modules`, `.git`, binaries, and large files
3. Pattern-matches file contents against known secret signatures
4. Returns findings capped at 50, with severity breakdown

## Tech stack

- **Frontend:** React (Vite)
- **Backend:** Vercel serverless functions (Node.js)
- **Database:** PostgreSQL (Supabase)

## Limitations (v1)

- Scans the current state of the default branch only — not full commit history
- Public repositories only (no GitHub OAuth / private repo support yet)
- 200MB repo size limit (serverless execution time constraints)

## Running locally

```bash
npm install
npm run dev
```

Requires a `DATABASE_URL` environment variable pointing to a PostgreSQL instance (falls back to in-memory storage if not set).

## Disclaimer

SecretGuard scans publicly accessible repository content for patterns that resemble secrets. It does not verify whether a detected pattern is an active, real credential — flagged findings should be manually reviewed. This tool performs no exploitation or unauthorized access; it only reads what's already public in the repository. Provided for educational and informational purposes, with no warranty of accuracy or completeness.