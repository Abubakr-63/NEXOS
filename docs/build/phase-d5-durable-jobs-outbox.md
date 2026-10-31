# D5: durable preflight admission and transactional outbox

**Latest local status:** the explicitly approved D5 migration was applied to local nexos_development with all original rows intact and Prisma status up to date. Post-migration runtime checks are blocked by unavailable local services following an interruption; no restart/retry was attempted under the stop-on-failure instruction. See [approved local execution and guard report](phase-d5-local-migration-applied.md). The earlier approval-gate status below is historical. Production job wiring remains disabled.

Date: 2026-10-31, Asia/Tashkent. Branch: `ai/codex-backend`.

Status: implementation demonstrated against disposable PostgreSQL/Redis; **existing-database migration and activation await explicit approval**. This is a safe migration-gate delivery, not a claim that production D5 or Android compilation is complete. PR #1 stays draft and unmerged.

Follow-up: [existing-data backup/restore rehearsal and risk assessment](phase-d5-backup-migration-rehearsal.md) validates the exact proposal on a copy of the real database. It records a corrected raw-SQL serialization retry gap, 86 passing unit tests/eight E2E tests and the remaining existing Windows startup-deadline failure in the broader integration suite (35/36). The live migration remains pending; original rows and `.env` remain intact.

## Inventory and scope

D2 provides reviewed target/source declarations, with compilation and flashing eligibility false. D3's `foundation.ts` and Redis handoff tests cover connectivity probes, deduplication, retries, cancellation, stalled delivery and worker supervision. D4's executor modules provide a fixed Cuttlefish identity, bounded preflight protocol, attempt workspaces, fencing, cleanup confirmation and a gated Linux/rootless-Docker transport. Their test Redis attempt store was not durable production admission.

D5 adds `apps/worker/src/durable/jobs.ts`, `outbox.ts` and `queue.ts`. PostgreSQL owns admission, attempts, cancellation and outcomes. BullMQ owns delivery; its completion record cannot establish successful execution. The D4 coordinator now accepts an execution-authority interface, allowing the new PostgreSQL implementation to reuse the existing protocol. It also respects a shorter persisted readiness deadline.

These are explicit internal service factories, not a new production entrypoint. Neither the API nor `worker/main.ts` invokes them. The public authenticated build POST retains its existing 503. No shared Zod/OpenAPI contract or frontend implementation changes. Default readiness denies admission. Only `ISOLATION_PREFLIGHT` is supported, always `compiled:false`; `CHECKED` means isolation preflight completed, never an Android ROM. No ZIP or artifact is published.

## Exact additive database proposal

Review `packages/database/prisma/schema.prisma` and the exact SQL in `packages/database/prisma/migrations/20261030190000_durable_build_jobs/migration.sql`.

- Two enums: job states `QUEUED`, `PREPARING`, `RUNNING`, `CHECKED`, `FAILED`, `CANCELLED`, `RECOVERY_REQUIRED`; outbox states `PENDING`, `DISPATCHING`, `SENT`, `DEAD`.
- `DurableBuildJob`: UUID identity, owner/project/revision references, owner-scoped idempotency key and request digest, immutable validated configuration snapshot/digest, target/readiness digests, readiness expiry, lifecycle timestamps, cancellation flag, failure code, attempt/fence/stage counters and delivery generation. A unique nullable pointer identifies the current attempt.
- `DurableBuildAttempt`: UUID, job, attempt number, fence, unique worker-instance identity, state, database-time lease/deadline, cleanup confirmation and outcome timestamps. Unique `(jobId, number)` and `(jobId, fence)`.
- `DurableBuildOutbox`: UUID, unique `(jobId, generation)`, state, dispatch count, due time, claim UUID/lease, sent/dead timestamps and fixed failure code. Indexes support due dispatch, expired leases and monitoring.

The SQL is transaction wrapped. It creates only these objects and their indexes/FKs; it does not rewrite existing columns, seed data or change existing rows. SQL CHECKs prohibit real compilation, bound attempts to two, delivery generations to 0..8, dispatch attempts to eight, stages to 0..3 and attempt leases to deadline + five seconds. Prisma relation arrays on existing models are virtual, not new database columns.

**Deletion effect:** owner/project/revision FKs use RESTRICT. Once a durable job references them, their deletion requires a separately reviewed retention policy; existing cascade deletion paths may be blocked. Attempts/events cascade only when their parent job is explicitly deleted. This phase installs no deletion/retention task. The current-attempt FK uses SET NULL. Existing records without jobs remain compatible.

## Admission and authority

`admit(actorId, input)` receives actor identity from a trusted authenticated caller, never the request body. There is currently no HTTP adapter. It accepts exactly projectId, revisionId, targetId and idempotencyKey; unknown command/environment/owner fields are rejected. It loads the actual owner-scoped revision, parses the existing configuration schema and allows only D4's fixed Cuttlefish target.

A trusted backend readiness callback must return a preflight-only proof bound to configuration and target digests, an evidence digest and an unexpired deadline no more than one day away. This is an injectable qualification boundary, not a signed external certificate verifier. Production evidence generation and host qualification remain absent; default callback returns null. Execution rechecks the snapshot digest, target and expiry. Public Android-build readiness remains false.

A SERIALIZABLE transaction and fixed advisory transaction lock serialize admission/global reservation decisions. Owner+idempotency uniqueness handles replays; identical authorized requests return the original job, changed requests conflict. Authorization precedes replay. Job, generation-zero event and existing AuditLog entry commit together; an SQL failure returns no admission. Serialization/unique conflicts retry at most three times after the initial transaction. Database errors become fixed codes.

Admission bounds active jobs at 16 globally/four per owner. Execution reserves one job globally using the database, independently of Redis namespace or number of workers. PREPARING, RUNNING and RECOVERY_REQUIRED retain that reservation. Each claim creates a new UUID attempt, incremented fence and unique per-worker-instance owner. Maximum two attempts; lease three seconds, execution at most 30 seconds or earlier readiness expiry, cleanup allowance five seconds. Database `clock_timestamp()` governs lease decisions. Normal mutations check current attempt, worker, fence, attempt number, active state and unexpired lease under row lock.

Progress is ordered ALLOCATED → ISOLATED → PREFLIGHT_RUNNING. CHECKED requires all stages, deadline validity and confirmed cleanup. Queued cancellation is immediately terminal; active cancellation persists until cooperative stop/cleanup or recovery. Cancellation wins if committed before completion; already committed terminal outcomes remain unchanged. Database loss prevents authority renewal/publication and D4 aborts execution. Stale writes cannot replace a later attempt/outcome.

## Delivery, retries and recovery

The queue is `romhub-durable-preflight`, with an operator-supplied namespace, local/global concurrency one, three delivery attempts, bounded exponential BullMQ retry and retained completed/failed identities. Payload contains only version, ISOLATION_PREFLIGHT kind, job UUID and generation. Stable delivery ID is `<job UUID>-g<generation>`. The consumer validates payload/name/identity/options, then checks PostgreSQL state/generation before calling the coordinator.

`dispatchOnce()` claims one due PENDING or expired DISPATCHING event using `FOR UPDATE SKIP LOCKED`. It records a UUID token, five-second dispatch lease and incremented count, commits, publishes outside the transaction, then acknowledges with a token/lease check. Multiple dispatchers cannot own the same current claim. Redis failure preserves intent and schedules 250ms, 500ms, 1s, 2s, 4s, 8s, 16s, capped 30s backoff. After eight failed/abandoned dispatch attempts, DEAD is explicit and the still-queued matching job becomes FAILED/DELIVERY_EXHAUSTED. Raw Redis error text is not persisted.

If a dispatcher dies after publishing but before acknowledgment, an expired claim republishes the same identity. PostgreSQL claims/outcomes make duplicates safe. Delivery is **at least once**, not exactly once; no transaction spans PostgreSQL and Redis.

`repairDelivery(jobId)` reconciles a PostgreSQL-QUEUED job whose current event is SENT but Redis confirms its delivery missing/completed/failed/unknown. It advances the generation and inserts another event atomically with compare-and-lock protection. Concurrent repairs produce one new event. Redis lookup failure does not infer loss or advance the generation. Eight generation advances are allowed; exhaustion is an explicit terminal failure. This also repairs queue-message loss and delivery retries exhausted before a claim; it must be run by an operator-owned periodic scanner after activation.

`recoverExpiredJobs()` examines a bounded batch (default four, maximum 16). Expired attempts become RECOVERY_REQUIRED. The existing transport must positively confirm cleanup of the old attempt before a new generation/event is committed. Unconfirmed cleanup retains the global reservation. Confirmed cleanup either cancels, fails on attempt/generation exhaustion, or queues a fresh attempt with a new fence. Duplicate old delivery/completion cannot change it. Concurrent cleanup operations rely on the existing idempotent attempt cleanup and fenced state transition.

`monitor()` exposes state counts, oldest pending timestamp, expired dispatch/attempt counts and at most 20 DEAD IDs/fixed failure codes. It excludes configuration, credentials and lease tokens. Alerting, pagination, scheduling these bounded methods, retention, backup and operator dead-letter decisions remain deployment work. There is no automatic reset/requeue of DEAD jobs.

## Migration validation and approval gate

The exact proposal was applied only to newly created disposable `nexos_d5_test_27f6e30e` on helper-owned PostgreSQL 5433. It was first populated with the existing baseline catalog and synthetic user/project/revision/audit data, then migrated. Digests of all 28 existing models matched before/after migration; new job/event counts were zero. Redis integration uses a separate authenticated instance on 6381, not the development 6380 instance. Tests assert the disposable database name against the actual server and use isolated queue namespaces. Fault injection is denied outside the test DB/environment.

The existing `nexos_development` database remains on its original three migrations. The proposed tables are absent there. Repeated before/after checks compared existing-model hashes, migration history and the original `.env` hash. Prisma client generation changes local generated metadata only; the unchanged API continues querying existing tables. Do not run root `db:migrate` / `prisma migrate deploy` with the development environment until explicit approval: it would apply the pending proposal.

After approval: verify the target database and a recoverable backup, stop prospective durable producers/consumers, review the exact SQL/checksum, deploy this migration only to the approved target, verify old-record compatibility and table checks, and keep public execution disabled. Approval to migrate does not qualify a Linux host or authorize public build activation. Backups must preserve secrets privately.

Rollback preference is stop new durable services and revert application usage while retaining job/history tables. There is no automatic destructive down migration. Dropping new tables would destroy job/audit relationships and operational evidence; any later removal requires separate approval, backup and dependency review. Prisma CHECK constraints are hand-written SQL and must be retained in future migrations.

## Security and remaining execution requirements

No user text becomes a command, path, image, environment or Docker option. D4's Linux transport still owns fixed commands, image allowlisting, resource controls, private workspace/artifact paths and process termination. This phase did not qualify a Linux host, image, external reaper or durable disk policy. The existing Windows API/frontend remain operational, and Windows never compiles AOSP. Integration transports report preflight protocol results only; the killed-worker test executes a controlled protocol fixture, not Android tools.

Before first real Cuttlefish build: obtain migration approval; coordinate versioned API contracts with Gemini; implement trusted readiness/host qualification; wire a supervised dispatcher/consumer/reconciler and metrics; qualify Linux rootless containers, immutable image, quotas, cleanup/reaper and crash recovery; review immutable source acquisition and storage budget; introduce a separately reviewed real-build kind/eligibility and artifact verification/publication policy. Only then attempt a bounded real compilation. No large Android downloads occurred here.

## Verification ledger

Private logs and environment files are under ignored `.local/d5/`; credentials are not included here. Final suite results and preliminary failures are recorded below before delivery.

- `pnpm.cmd exec prettier --write apps/worker/src/durable/*.ts tests/durable-*.ts`: format backend additions.
- `pnpm.cmd --filter @rom-hub/worker build` and `pnpm.cmd --filter @rom-hub/api build`: passed.
- `pnpm.cmd test`: 85 passed, zero failed/skipped.
- `pnpm.cmd typecheck`: all seven workspace tasks passed.
- `pnpm.cmd lint`: all seven workspace tasks passed (existing worker lint script is TypeScript; configured ESLint tasks also ran).
- `pnpm.cmd audit --json` and `pnpm.cmd audit --prod --json`: zero advisories in both reports; no dependency versions upgraded. Only a direct link to existing Prisma 6.19.0 was added for the worker.
- `node --env-file=.local/d5/test-final.env scripts/with-env.mjs pnpm test:integration`: initial 35/36 passed; the existing Redis-unavailable API child missed its five-second exit deadline under concurrent Windows load. No assertion was weakened.
- `node --env-file=.local/d5/test-final.env scripts/with-env.mjs pnpm exec tsx --test --test-concurrency=1 tests/*.integration.ts`: **36 passed**, zero failed/skipped, including all seven D5 cases and existing authentication/project regressions.
- With command-local `NODE_ENV=production`, `API_ORIGIN=http://localhost:4200`, and the installed Prisma Windows engine paths: `pnpm.cmd exec turbo build --env-mode=loose`: all seven production-build tasks passed, five from cache. Only this worktree's API was briefly stopped to release the Prisma DLL, then restarted with its original `.env`; frontend process and database stayed untouched.
- With `PLAYWRIGHT_API_PORT=4200` and installed Edge via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`: `node --env-file=.local/d5/test-final.env scripts/with-env.mjs pnpm exec playwright test --config=apps/api/scripts/playwright-windows.config.ts tests/e2e/foundation.spec.ts tests/e2e/protected-routes.spec.ts`: **eight passed**, zero failed/skipped. These exercise real register/session/logout, protected routes and project draft persistence through Next's proxy, using the disposable database.
- `pnpm.cmd db:validate`: schema valid. `node --env-file=.local/d5/test-final.env .local/d5/check-proposal.cjs`: exact applied disposable migration checksum matches proposal SHA-256 `839b79dfc904a5a7e2925f16ea775b0eb7a8ce71ab1c8ef5bf03cc622155acc9`.
- `node --env-file=.env .local/d5/live-snapshot.cjs after`: `.env` unchanged, all 28 original model digests unchanged, original live migration history unchanged, proposed tables absent. No reset/drop/reseed/migration command was run against the live database.
- After push, a final live check observed independent authentication activity: Session count rose from six to seven and AuditLog from ten to eleven, with one `session.created` action since the baseline. Those two model hashes now differ; the other 26 (including users/projects/revisions), `.env` and migration history still match, and proposed tables remain absent. This live activity was left intact. Both direct API and frontend-proxied health/readiness returned 200.

Seven D5 real-service integration cases cover actual outbox INSERT failure/transaction rollback; readiness, ownership, concurrent idempotency, quotas and SQL constraints; concurrent dispatch/two-worker global isolation/duplicate delivery; TCP-proxy Redis outage after commit, retry and dispatcher restart with late-ack fencing; killed BullMQ child, actual lease expiry, cleanup gate, replacement consumer/new fence and stale mutation rejection; cancellation/completion race, readiness expiry and shortened timeout; lost-message concurrent repair, dead letters and sanitized monitoring.

Preliminary failures were investigated rather than suppressed: Prisma cannot deserialize PostgreSQL's void advisory-lock return (fixed query to return integer); Redis QUIT during the induced outage could reject and leave a client open (disconnect now runs in finally); the original crash fixture was strengthened to kill an actual BullMQ consumer. The first broad integration run passed 35/36, with the existing Redis-unavailable API-startup test exceeding its fixed five-second Windows child-exit deadline; all seven D5 cases passed. The complete sequential rerun passed 36/36. The timing-sensitive existing test remains unchanged; concurrent-load flakiness remains a Windows test-harness limitation.
