# AIIMS Rishikesh CNE Management System — Production Setup

## 1. Production topology
```text
Browser
  -> Cloudflare Worker + static Vite assets
       -> Cloudflare D1 (live operational DB)
       -> Gemini API (server-side MCQ generation)
       -> Google Apps Script
            -> Officers Master Google Sheet (authoritative employee master)
            -> Google Drive (actual files)
            -> Google Sheets (structured asynchronous backup only)
```
`server.ts`/SQL.js are optional development-preview helpers only; production uses `worker/index.ts` + D1.

## 2. Install and verify
```bash
npm install
npm run audit
npm run typecheck
npm run build
npx wrangler login
```

## 3. Create D1 and apply migration
```bash
npx wrangler d1 create cne_d1_prod
```
Put the returned database ID into `wrangler.toml`, then:
```bash
npm run d1:migrate:remote
```
The migration seeds only `ADMIN`, `AREA_INCHARGE`, and `EMPLOYEE` roles. It does not create demo employees/passwords.

## 4. Cloudflare secrets
Set strong independent values:
```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put BOOTSTRAP_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GOOGLE_APPS_SCRIPT_URL
npx wrangler secret put GOOGLE_INTEGRATION_SECRET
```
`BOOTSTRAP_TOKEN` is mandatory for the one-time first ADMIN bootstrap. `GEMINI_MODEL` defaults to the explicitly approved `gemini-3.8-flash`; there is no automatic model fallback.

## 5. Officers Master Sheet
Use the existing authoritative Officers spreadsheet. `Code.gs` discovers columns by header name rather than fixed column position. Required headers are equivalent to:
- Employee ID
- Name
- Date of Joining / DOJ

Recommended headers also include Designation, Department/Area, Email, Phone/Mobile, and Status. Dates should resolve to `YYYY-MM-DD`.

## 6. Backup Sheet
Create/select a separate Google Spreadsheet for structured backup. This is not the live application DB.

## 7. Google Apps Script
1. Create an Apps Script project and paste `google-apps-script/Code.gs`.
2. **Services -> Add a service -> Drive API**. The Advanced Drive service is required for automatic PDF/DOC/DOCX/PPT/PPTX conversion/extraction. Plain TXT extraction works directly.
3. In **Project Settings -> Script Properties**, set:
   - `INTEGRATION_SECRET` = same secret as Cloudflare `GOOGLE_INTEGRATION_SECRET`
   - `OFFICERS_SPREADSHEET_ID`
   - `OFFICERS_SHEET_NAME` (optional; defaults to `Officers data`, then `Officers`)
   - `BACKUP_SPREADSHEET_ID`
4. Deploy as a Web App: **Execute as Me**; access may be **Anyone** because every privileged POST action independently requires the integration secret in the JSON body.
5. Save the `/exec` deployment URL as Cloudflare `GOOGLE_APPS_SCRIPT_URL`.

The integration fails closed if the Officers/Backup spreadsheet IDs or integration secret are absent. It does not fall back to an arbitrary active spreadsheet.

## 8. Drive folders and extraction
The integration creates/uses:
```text
CNE Management System/
  CNE Materials/<CNE-ID>/
  CNE Library/
  Gallery/
  Chairperson/
  Generated Documents/
```
Uploaded PDF/DOC/DOCX/PPT/PPTX/TXT files are stored in Drive. The Worker then requests extraction; extracted text is stored/indexed in D1 chunks. Failed extraction is recorded as `FAILED` with an error and can be retried by an authorized user. Drive Library synchronization detects new/changed files by Drive modified time and avoids reprocessing unchanged documents.

Gallery and Chairperson images are intentionally public Home content. The Apps Script upload attempts `ANYONE_WITH_LINK` view sharing for these approved public images. If your Google Workspace policy prohibits public link sharing, use an institution-approved public image/CDN policy before publishing those sections.

## 9. First ADMIN
Deploy, open Sign In, and use **Initialize Admin** only when `can_bootstrap=true`. Enter real administrator information, strong password, DOJ, and the exact `BOOTSTRAP_TOKEN`. The D1 bootstrap claim prevents a second first-admin creation.

## 10. Sync Officers and assign Area In-Charges
As ADMIN:
1. Role Master -> Sync Officers Sheet.
2. Assign application roles.
3. Assign AREA_INCHARGE users to their clinical Area(s).
Server-side middleware restricts Area-In-Charge CNE/application/participant/attendance/resource/question/report actions to assigned Areas.

## 11. Backup queue
D1 writes are authoritative. Backup jobs are queued and attempted after writes using `ctx.waitUntil()`. Cloudflare Cron (`*/15 * * * *`) retries `PENDING`/`FAILED_RETRYABLE` jobs. A Sheets outage does not roll back valid D1 data.

## 12. Deploy
```bash
npm run audit
npm run typecheck
npm run build
npm run deploy
```
The Worker serves the Vite `dist/` assets and `/api/*` from the same origin. Security headers, secure cookie handling, and controlled CORS are applied by the Worker.

## 13. Staging acceptance test before real institutional data
Use a test Officers sheet/Drive/backup sheet first and verify:
1. health + public Home
2. first ADMIN bootstrap and second-bootstrap rejection
3. Login / refresh / logout / Forgot Password
4. Officers sync
5. Area-In-Charge scope enforcement
6. CNE create -> modify -> cancel / complete state rules
7. application -> approval -> capacity protection
8. participant + signed QR attendance
9. real Drive file upload + automatic extraction + retry
10. Drive Library sync and indexed chunks
11. Gemini one-generation rule and evidence hierarchy
12. post-test eligibility/scoring
13. CMS Gallery/Chairperson Drive uploads
14. Sheets backup failure/retry
15. Admin diagnostics/reports

Do not place real AIIMS operational data into the system until this staging checklist passes.
