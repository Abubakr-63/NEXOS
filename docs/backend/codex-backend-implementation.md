# Codex backend implementation and integration handoff

## Current Windows runtime update — 2026-10-30

The backend is now operational on Windows at `http://127.0.0.1:4000`, with health/readiness 200 and authenticated Redis/PostgreSQL on isolated ports 6380/5433. A real browser using the active `http://localhost:3000` frontend passed registration, login, session refresh, persisted draft display, logout and anonymous rejection. The three Windows unit failures below are fixed: final verification is **78 unit tests, 24 integration tests and eight relevant E2E tests passed**, plus TypeScript/lint, production build and zero-advisory full/production audits.

See [Windows runtime runbook and executed-command ledger](windows-local-runtime.md) for exact startup commands, new local-only environment setup, migration/seed isolation, Windows DLL/build-mode constraints, resolved preliminary failures and Gemini coordination. No frontend implementation, Zod/OpenAPI response contract or migration source changed. PR #1 remains unmerged. The earlier worker milestone and its then-current limitations are preserved below as history; its unavailable-infrastructure test results are superseded by this update.

Date: 2026-10-30 (Asia/Tashkent).

## Isolation and verified starting state

- Baseline: `1c7f4031306ca513d6609a57a90e999b0fee2332` (`main`, `origin/main`). Remote main was also checked with `git ls-remote` and matched. No Gemini branch was available, so this is the verified common repository baseline, not independent confirmation of Gemini's private editor state.
- Original checkout was clean. Created branch `ai/codex-backend` in `C:/Users/admin/Desktop/NEXOS-codex` and opened that directory in a separate VS Code window. All implementation commands use this worktree; the original checkout remains on main.
- Actual source confirms versioned scrypt and legacy password upgrades, transactional registration, owner-scoped sessions/projects, cookie/origin checks, Redis authentication admission, Zod response/request contracts, cursor pagination and OpenAPI generation. Historical reports were not treated as current test results.
- D2 retains reviewed Cuttlefish source declarations with build/flash eligibility false. D3 already implements bounded, idempotent test-only connectivity probes, two-worker global concurrency, retries, poison-job rejection, cancellation and stalled-job recovery tests.
- `POST /api/v1/projects/:id/builds` authenticates and validates ownership/configuration, then returns the existing 503. No public producer, durable build execution history, isolated compiler or validated artifact exists. No collaboration request directory existed at the baseline.

## Delivered milestone: worker process supervision

An unexpected rejection of `Worker.run()` previously produced only a log; the process could remain alive without consuming. Unexpected resolution was not reported at all. Both outcomes now notify the production supervisor unless shutdown has started. Redis error events remain recoverable events; an ordinary connection interruption does not itself force a restart.

The production entrypoint uses one supervision controller:

- Registers SIGINT/SIGTERM before service creation. Repeated signals request cleanup once and allow active work to drain.
- Reports `worker.ready` only after readiness resolves while still active.
- Construction/readiness failure, startup timeout and fatal consumption-loop termination request cleanup and exit 1. Exceptions, connection URLs and payloads are never logged by this controller.
- Startup deadline remains five seconds. Cleanup has a ten-second deadline, including after startup failure. A stuck startup can therefore take up to approximately fifteen seconds before forced process exit, rather than the previous immediate five-second exit.
- Cleanup failure and timeout emit `worker.shutdown_failed` / `worker.shutdown_timeout`, exit 1, and do not acknowledge work as successful. Late readiness cannot report a stopped worker as ready.
- Signal listeners/timers are released at termination. Close is idempotent. The queue cleanup is attempted even if BullMQ worker close rejects; readiness rejects after close starts and checks again before starting consumption.

A restart policy belongs to the external service supervisor: restart on nonzero exit with bounded backoff and alert on repeated exits. This change does not install or certify that supervisor. Deadlines terminate the worker process; they do not cancel arbitrary external operations. The current processor has only idempotent Redis reads. Future compilers require separate process-tree termination, attempt fencing and isolated output publication.

## Files

- `apps/worker/src/foundation.ts`: fatal-loop notification, readiness/close race guards, cleanup in finally.
- `apps/worker/src/runtime.ts`: supervised startup, signals, draining and bounded termination.
- `apps/worker/src/main.ts`: wire the existing foundation worker into supervision.
- `tests/worker-runtime.test.ts`: seven supervision scenarios using controlled services.
- `tests/worker-runtime-process.test.ts`: two actual compiled-process scenarios, malformed configuration and a silent local TCP endpoint in place of Redis.
- `tests/foundation.integration.ts`: one additional real-Redis regression covering unexpected loop resolution and rejection, notification and readiness after close. This new real-Redis test has not passed locally; infrastructure is unavailable.
- This report and `docs/collaboration/requests/backend-to-frontend.md`.

No frontend source, shared package/schema, OpenAPI artifact, lockfile, root configuration, environment example, Prisma schema or migration was changed.

## Verification and reproducibility

Node 24.15.0, locked pnpm 10.18.3. Fresh frozen-lockfile installation completed. On this Windows machine use `npm.cmd`, not the execution-policy-blocked npm.ps1 launcher. A cached pnpm bin directory was placed on PATH for commands only. Client generation uses the installed Prisma Windows binaries via command-local `PRISMA_SCHEMA_ENGINE_BINARY` and `PRISMA_QUERY_ENGINE_LIBRARY`; no environment file was written. Read the installed Next TypeScript guide before implementation; no Next API or frontend changes were needed.

| Check                                                 | Current result                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused worker tests                                  | 13 passed, zero failures: four existing orchestration checks, seven new supervision tests, two new compiled-process tests. Rebuilt worker before running.                                                                                                                                                                                                   |
| Root TypeScript plus workspace typecheck              | Passed, seven workspace tasks. Root typecheck repeated after final code/test edits.                                                                                                                                                                                                                                                                         |
| Workspace lint                                        | Passed, seven tasks. API/worker convention uses TypeScript; frontend uses existing ESLint.                                                                                                                                                                                                                                                                  |
| Changed TypeScript formatting and git diff whitespace | Passed.                                                                                                                                                                                                                                                                                                                                                     |
| Production build                                      | Passed, seven tasks, using `pnpm exec turbo build --env-mode=loose` and command-local installed Prisma engine paths. Ordinary build initially failed because Turbo strict env filtering removed those paths and Prisma's engine fetch reset. API, worker and Next application compilation succeeded. This is an application build, not Android compilation. |
| Full unit suite                                       | 77 cases: 74 passed, three failures. Source-evidence hashes and exact OpenAPI snapshot fail under existing `core.autocrlf=true`; read-only LF normalization matches all seven source hashes and the generated OpenAPI exactly. Existing environment-runner test also fails on Windows (child exit 1). Relevant baseline files are unchanged.                |
| Integration suite                                     | Attempted with deliberately unreachable loopback-only test URLs, never a user database. PostgreSQL/Redis-dependent cases failed; retrying clients kept the process alive, so its identified process tree was terminated. No complete passing integration result, including the new real-Redis case, is claimed.                                             |
| E2E                                                   | Attempted against the same unreachable test infrastructure. Web-server startup failed (Windows exit 3221226505); no browser-case pass claimed.                                                                                                                                                                                                              |
| Full dependency audit                                 | Zero advisories in every severity, 644 dependencies in audit metadata.                                                                                                                                                                                                                                                                                      |
| Production dependency audit                           | Zero advisories in every severity, 268 dependencies in audit metadata.                                                                                                                                                                                                                                                                                      |

Docker/Redis were not found and WSL reports not installed. No existing environment secrets were copied into this worktree. There was no usable isolated migrated test database/Redis pair. The full integration and browser checks must be rerun against coordinator-provisioned isolated infrastructure before merge. The loopback TCP process test certifies bounded startup failure, not Redis persistence, TLS, failover or actual queue processing.

## Exact integration contract

- API operations added/changed: none. Builds retain the existing authenticated 503 response and error envelope.
- Shared schemas/OpenAPI: unchanged. No new public lifecycle, progress, cancellation or artifact/download response.
- New environment variables: none. Existing `REDIS_URL` and queue `romhub-foundation` remain in use.
- Infrastructure: existing supported Redis instance for the worker; PostgreSQL remains required by the API. Worker performs no database operations. Existing local/global concurrency is two; production probe behavior and strict `compiled: false` results are retained.
- Migrations: none created or applied; no database reset, seed or destructive operation. Existing user/project data was not accessed by this implementation. Do not interpret that as a database content-digest audit.
- Compatibility: no frontend source changed and no combined Gemini/backend branch test occurred. No frontend compatibility claim is made.

## Remaining work before real AOSP compilation

Retain Cuttlefish x86_64 userdebug as a feasibility candidate, not an enabled build target. Complete immutable source/prebuilt/toolchain closure and license/signature review. Qualify a dedicated Linux executor for disk/RAM/CPU, isolation, restricted egress, quotas, deadlines, cleanup and secret separation; this Windows workstation is not a native AOSP executor.

Coordinate D3's proposed durable BuildJob/BuildAttempt/outbox contract before shared schema work. Review idempotency conflicts, ownership snapshots, legal transitions, leases/fencing, reconciliation after Redis loss, bounded retry classification and cancellation before exposing public jobs.

Artifact admission must bind outputs to the approved configuration/source/executor/attempt digests, record size and SHA-256 in trusted metadata, quarantine incomplete outputs, independently validate required outputs and virtual boot evidence, and publish only after terminal fencing checks. Use opaque server-generated storage keys, owner-authorized short-lived downloads and private storage. Define per-owner retention/expiration, deletion reconciliation and failure cleanup before enabling downloads. No artifact storage or endpoint was enabled here.

Recommended next phase: provision isolated Redis/PostgreSQL verification, resolve coordinated Windows launcher/byte-fixture portability, rerun integration, then review the durable orchestration contract and Linux executor qualification. No large source download, toolchain installation, Android compilation, public deployment, merge or push rewriting is part of this milestone.

## Git delivery

Branch: `ai/codex-backend`. Implementation commit: `175f0258cf2e7c06a62aba41cbe3e1048487ba98`, pushed to origin. Draft PR targeting main: [PR #1](https://github.com/Abubakr-63/NEXOS/pull/1). It is unmerged; draft status reflects the outstanding infrastructure/integration checks. This report is updated in a subsequent documentation commit; use `git rev-parse origin/ai/codex-backend` for the final branch tip.
