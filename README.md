# SecretGuard v1 — Git Secret Leak Detector

A web app where you paste a public GitHub repo URL, the backend shallow-clones it, scans for accidentally committed secrets (API keys, tokens, credentials), and shows findings with severity and remediation guidance.

## Project Structure

```
secretguard/          ← Vercel project root
├── api/
│   ├── scan-repo.js          # POST /api/scan-repo
│   └── repo-scans/
│       └── [id].js           # GET /api/repo-scans/:id
├── lib/
│   ├── db.js                 # PostgreSQL + in-memory fallback
│   ├── scanner.js            # Git clone + file scanning engine
│   └── signatures.js        # Secret pattern definitions
├── src/                      # React (Vite) frontend
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   └── components/
│       ├── Header.jsx
│       ├── RepoForm.jsx
│       ├── ScanResults.jsx
│       ├── FindingItem.jsx
│       ├── ErrorBanner.jsx
│       └── Disclaimer.jsx
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json               # Framework: vite, maxDuration: 60s for scan function
└── package.json              # Unified deps (frontend + serverless)
```

## Deploying to Vercel

1. Push the `secretguard/` folder as the Vercel project root.
2. Add `DATABASE_URL` environment variable in the Vercel dashboard (Neon, Supabase, or any Postgres URL).
3. Vercel auto-detects `framework: vite` from `vercel.json` and builds `dist/` for the frontend.
4. The `/api/*` routes are served as serverless functions.

## Local Development

```bash
npm install
npm run dev       # Frontend at localhost:3000
```

For the API functions locally, use the [Vercel CLI](https://vercel.com/docs/cli):
```bash
npx vercel dev    # Runs both frontend + API functions locally
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | PostgreSQL connection string. Falls back to in-memory store if absent. |

## Scan Details

- **Depth**: Shallow clone (depth 1, default branch only)
- **Timeout**: Clone aborts after 45 seconds; full function budget is 60 seconds
- **Size limit**: Repositories over 200 MB are rejected before scanning begins
- **Findings cap**: Maximum 50 findings per scan (additional findings noted as truncated)
- **Cleanup**: Temp clone in `/tmp/scans/{uuid}/` always deleted in a `finally` block