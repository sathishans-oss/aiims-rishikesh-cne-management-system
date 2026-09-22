# Final production-hardening pass

This package incorporates the original CNE functional specification and subsequent code-audit corrections.

Major corrections include:
- Cloudflare Worker + D1 as the production application backend; single-origin static asset deployment.
- HttpOnly cookie authentication, PBKDF2-SHA-256 passwords, rate limiting, atomic reset tokens, and atomic one-time ADMIN bootstrap.
- Server-side ADMIN / AREA_INCHARGE / EMPLOYEE authorization with explicit Area-In-Charge assignments and Area scoping.
- Enriched authenticated CNE contracts, atomic annual CNE sequence IDs, multi-resource-person persistence, lifecycle validation, and completion prerequisites.
- Application server-side filtering/pagination and database-enforced participant capacity under concurrent approvals.
- Signed QR attendance rendered as a real QR code with one-tap portal URL and Asia/Kolkata attendance-date validation.
- Real Google Drive uploads for CNE material, institutional Library, Gallery, and Chairperson media.
- Automatic document extraction for TXT and Drive-convertible PDF/DOC/DOCX/PPT/PPTX, source-specific D1 chunks, extraction error/retry states, and Drive Library change synchronization.
- Evidence-grounded Gemini MCQ generation with atomic generation lock, strict model allowlist, no public web search, no silent model fallback, and atomic question persistence.
- Atomic post-test attempt/answer persistence and server-side scoring without pre-submit answer exposure.
- D1-backed Dashboard, reports and diagnostics response alignment.
- CMS edit/publish/order controls for Home content.
- Asynchronous Sheets backup with durable D1 queue and scheduled retries.
- CSP, HSTS (production), frame/content-type/referrer/permissions headers.
- Static production audit script and GitHub Actions workflow (`npm install -> audit -> typecheck -> build`).

Validation expected before go-live:
```bash
npm install
npm run audit
npm run typecheck
npm run build
```
A real staging deployment must additionally verify Cloudflare D1, Google Apps Script/Drive/Sheets, Officers synchronization and Gemini using non-production test data before connecting real institutional data.
