# AIIMS Rishikesh Clinical Nursing Education (CNE) Management System

Production-oriented CNE portal built with React + TypeScript + Vite, Cloudflare Worker + D1, Google Apps Script/Drive/Sheets, and server-side Gemini MCQ generation.

## Architecture
- **Frontend / static assets:** React + Vite served by Cloudflare Worker static assets.
- **API:** Cloudflare Worker (`worker/index.ts`).
- **Live operational database:** Cloudflare D1.
- **Institutional employee master:** existing Officers Google Sheet, synchronized to D1.
- **Files:** Google Drive.
- **Structured backup:** Google Sheets, asynchronous and retryable.
- **AI:** Gemini through the Worker only, grounded first in CNE-specific indexed evidence and then the active institutional CNE Library.

## Local verification
```bash
npm install
npm run audit
npm run typecheck
npm run build
```

For configuration and deployment, read **SETUP.md**. For the production-hardening changes in this package, read **PRODUCTION_FIXES.md**.
