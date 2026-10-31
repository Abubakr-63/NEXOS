# Backend handoff to Gemini and integration coordinator

## D5 runtime recovery — 2026-10-31

The existing native backend is healthy at port4000 with PostgreSQL5433/Redis6380. The independently started Gemini frontend on localhost3000 successfully proxies health/readiness (200) and a synthetic authenticated auth/me request (200); anonymous protected requests remain401. Register/login/draft/reload/revisions/logout and owner/Origin checks pass, with all synthetic fixtures cleaned and original records unchanged. Backend .env/origin/cookies and shared contracts remain unchanged. Continue relative `/api/v1` requests with credentials; no frontend implementation change is requested. D5 is applied once locally, but public builds remain503 and production job wiring is disabled. [Current results and moderate dependency audit follow-up](../../build/phase-d5-runtime-recovery.md). PR#1 remains draft/unmerged; no D6 work started.

## D5 contract proposal — coordination required, not implemented HTTP endpoints

The backend now has internal PostgreSQL admission/outbox/attempt services, verified on disposable PostgreSQL/Redis. Existing development migration/activation awaits explicit approval. No `apps/web`, shared Zod or OpenAPI files changed. The public build POST remains authenticated 503; continue displaying compilation as unavailable. Existing cookies/origin/session requirements below still apply.

For a future coordinated **preflight** API, propose these shapes for review (paths/statuses are not available routes):

- `POST /api/v1/projects/:projectId/preflight-jobs`, cookie-authenticated and Origin-checked. Body exactly `{ "revisionId": "...", "targetId": "aosp16-r4-cuttlefish-x86_64-userdebug-v1", "idempotencyKey": "client-generated-1..64-alphanumeric-underscore-hyphen" }`. Server derives actor and project path; never accepts owner, command, environment, image or artifact path. Proposed first admission 201 and identical authorized replay 200. Changed request with the same owner-scoped key: 409.
- `GET /api/v1/projects/:projectId/preflight-jobs/:jobId` and `POST .../:jobId/cancel`, both owner-scoped; absent/nonowned/mismatched-project resources share 404. Cancel body empty. Queued cancellation completes immediately; active cancellation returns the persisted request until cleanup confirms termination. Repeat cancellation preserves terminal outcomes.
- Proposed response `{ "id": "uuid", "projectId": "...", "revisionId": "...", "kind": "ISOLATION_PREFLIGHT", "state": "QUEUED", "stage": 0, "compiled": false, "cancelRequested": false, "attemptCount": 0, "failureCode": null, "createdAt": "ISO8601", "updatedAt": "ISO8601", "finishedAt": null }`. Project/revision IDs follow existing contracts. Stage is integer 0..3. No configuration, lease token, worker identity or internal raw error is exposed. Response mapping and shared schemas require separate implementation/review.

Lifecycle: QUEUED → PREPARING → RUNNING → CHECKED/FAILED/CANCELLED. PREPARING/RUNNING may enter RECOVERY_REQUIRED; confirmed cleanup then queues a bounded retry or ends FAILED/CANCELLED. Terminal states cannot change. CHECKED means preflight only; **compiled is always false**, with no download/flash eligibility. Do not show it as a built ROM.

Use the existing `createAPIError` envelope and request correlation for future failures. Proposed HTTP mappings: 401 missing session; 403 rejected Origin; 404 absent/nonowned resource; 400 malformed/unknown fields; 409 idempotency conflict; 429 owner/global admission capacity; 503 missing readiness/database/delivery availability. Fixed machine-code mapping for BUILD_UNAVAILABLE, DATABASE_UNAVAILABLE, DELIVERY_EXHAUSTED, READINESS_EXPIRED, ATTEMPTS_EXHAUSTED and cleanup/timeout failures needs coordinated contract review; do not expose exception/Redis/SQL text. The internal TypeScript HandoffError is not a public API response contract.

Start with owner-scoped polling while visible: ~1s, back off to 5s, honor Retry-After on 429/503, stop on terminal state, pause in hidden tabs, abort on logout/navigation. No SSE/WebSocket delivery is implemented; any later event stream needs authentication, resume/cursor and ownership review. A project/job listing route and pagination/retention contract also need coordination. No UI changes are required now. Architecture and approval gate: [D5 report](../../build/phase-d5-durable-jobs-outbox.md).

## D4 executor foundation update

The backend branch now contains internal fenced handoff qualification and a Linux-only fixed-command isolation preflight adapter. It does not activate build submission, compilation, artifact downloads or flashing. No API/Zod/OpenAPI contract or frontend implementation changed; no new frontend behavior is required. Continue saving ordinary configuration drafts and presenting build POST's existing authenticated 503 as unavailable. CHECKED/compiled:false is an internal preflight result, never an Android build success.

Production jobs/outbox/admission and Linux host/image/reaper qualification remain future coordinated work. See `docs/build/phase-d4-isolated-executor-foundation.md` for exact coverage and limits. Do not build new job/status/cancel/download UI against these internal test types. PR #1 remains draft and unmerged.

Verified 2026-10-30 (Asia/Tashkent). Backend branch: `ai/codex-backend`; PR #1 stays unmerged.

The real local backend is running at **http://127.0.0.1:4000**. Health and readiness are both 200. The existing frontend at **http://localhost:3000** successfully proxies `/api/v1` requests. A live browser registered and logged in, retained its session on refresh, displayed a persisted ROM draft, logged out and was denied protected access afterward. Eight additional browser tests passed on isolated test ports; 78 unit tests and 24 real PostgreSQL/Redis integration tests pass.

## Frontend settings

- Browser origin: `http://localhost:3000`.
- Next server setting: `API_ORIGIN=http://127.0.0.1:4000` (current default localhost:4000 also reaches the API). Keep browser calls relative to `/api/v1` with existing same-origin credentials. Server session lookup must forward the existing romhub_session cookie.
- Backend `WEB_ORIGIN=http://localhost:3000`, PORT=4000, NODE_ENV=development for local HTTP. If frontend port/host changes, coordinate that exact Origin with the backend and restart it. Do not broaden CORS, remove Origin validation or weaken cookies.
- Session cookie remains host-only, HttpOnly, SameSite=Lax, Path=/; production still requires Secure/HTTPS and explicit trusted proxy IPs. Use localhost consistently in the browser.
- Existing auth register/login/logout successful statuses are **201**. Session/project reads use 200, project creation 201, missing/revoked session 401, rejected Origin 403. No Zod/OpenAPI or API response format changed.

No frontend implementation change is required for this runtime. Port 3000 was observed running from the original NEXOS checkout, not `NEXOS-gemini`; its process was left untouched. When Gemini starts its own server, use these settings and avoid a port collision with the existing process. Private/new Gemini changes still require combined verification; do not treat this as certification of unseen UI work.

## Backend changes requiring awareness

- The shared `scripts/with-env.mjs` now launches native Windows executables directly to preserve spaces/quotes/literal arguments; cmd shims retain their existing handling. This fixes the confirmed Windows launcher failure and has a regression test.
- LF rules are scoped to backend reviewed source fixtures and exact OpenAPI artifact bytes, with no semantic schema/artifact changes. No root .gitattributes, shared package, dependency lock, frontend file or migration changed.
- Backend-owned Windows runtime and Playwright helper files avoid modifying the shared test configuration. Production web builds need NODE_ENV=production even though the local runtime .env says development. Prisma generation/build requires stopping only this worktree's API on Windows to release its DLL.

PostgreSQL/Redis are isolated on 5433/6380. Separate local dev/test databases and generated secrets belong to the backend worktree; do not copy its database/HMAC credentials into frontend files or commit them. Start services with `node apps/api/scripts/windows-local.mjs start`, then API with `node --env-file=.env apps/api/dist/main.js` from NEXOS-codex. Both are currently running. Detailed setup and executed-command ledger: `docs/backend/windows-local-runtime.md`.

`POST /api/v1/projects/:id/builds` still returns the existing authenticated 503. Show compilation as unavailable; saved ROM configurations and completed connectivity probes are not Android builds or downloadable artifacts. No unrelated build feature was added.
