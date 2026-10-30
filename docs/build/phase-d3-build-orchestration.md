# Phase D3 — Build job orchestration and worker lifecycle

Date: 2026-10-29. **Orchestration foundation only. Android compilation, artifacts, flashing, public build submissions and production deployment remain disabled.**

## 1. Inspection and scope decision

The repository already uses BullMQ 5.81.5 in `apps/worker` with queue `romhub-foundation`, concurrency two and a `healthcheck` processor. No API producer, durable build job/attempt, outbox or build status/cancel endpoint exists. The old worker accepted arbitrary healthcheck payloads and logged raw exception messages. Its Redis URL parser did not honor the database path or decode credentials. Signal handlers called worker.close but had no shutdown deadline.

`ROMProject` and `ConfigurationRevision` store drafts. Legacy Artifact/Release records are release metadata, not execution history; they were not reused as fake build jobs. PostgreSQL remains authoritative for accounts, sessions, project ownership and configuration revisions. Redis also supports authentication IP/account limiters; those modules and their namespaces were not changed.

The existing `POST /api/v1/projects/:id/builds` authenticates, checks origin and project ownership, validates the stored draft and returns the existing HTTP 503. D2's candidate has verified source declarations but literal false build/flash eligibility. There is no safe public build submission to activate.

**Selected allowed path:** implement isolated internal orchestration components, harden the existing worker, preserve public contracts, and propose durable persistence separately. This is not a second backend or competing queue system. The only producer is explicitly test-gated; no REST job feature, API queue provider or frontend was added. No migration was run.

## 2. Implemented components

- Shared strict Zod payload: version 1, kind `CONNECTIVITY_PROBE`, UUID request ID and opaque UUID owner ID. Unknown keys, scripts, full project configurations and other job kinds are rejected.
- Strict probe result: kind `CONNECTIVITY_PROBE`, `compiled: false`, status `checked` or `canceled`. Artifacts and a true compiled flag cannot fit this result contract.
- A private test producer/controller using the existing BullMQ queue name, isolated by `nexos-test-d3-<16 hex>` prefixes. It requires `NODE_ENV=test` and this prefix format. Hooks also require that test environment. Main does not accept a test-prefix environment variable.
- Real Redis status/cancellation and ownership comparisons, bounded admission and idempotent request handling. These are internal test-subject ownership checks, not a new public authentication system.
- A reusable worker factory and hardened production entrypoint. It performs only a Redis metadata read, never shell execution, source provisioning, compilation or artifact generation.
- Four new unit and four real-Redis integration tests, including an actual killed child worker and a TCP-proxy outage affecting worker and producer connections.

Worker now links the existing `@rom-hub/contracts` workspace package. No third-party package was added/upgraded; BullMQ remains 5.81.5 and existing security patches/overrides remain intact. Offline installation used `--ignore-scripts` only to establish the workspace link.

## 3. Actual state machine and trustworthy status

Only infrastructure probes execute. There is no Android BuildJob object to mark completed.

| State | Actual meaning / transitions |
| --- | --- |
| queued | BullMQ waiting/delayed/prioritized/waiting-children; may become running, failed or canceled |
| running | Worker has claimed the probe under its BullMQ lock; may retry to queued, complete, fail or acknowledge cancellation |
| completed | Validated probe result and BullMQ terminal completion; proves a connectivity check, never an Android compilation |
| failed | BullMQ terminal failure after permanent rejection, exhausted attempts or excessive stalls |
| canceled | A cooperative cancellation was acknowledged as a terminal probe; no completed-build claim |

`canTransitionProbe` defines the allowed policy and terminal states. Runtime state comes from BullMQ, not an independently writable in-memory status store; retries can return active work to waiting/delayed. No preparing state is fabricated because there is no source preparation. No percentages or artifacts are returned.

The status projection includes discriminator/compiled false, submittedAt, last-attempt startedAt, finishedAt, attemptsMade and cancelRequested. A completed queue record with an invalid result returns a controlled unavailable error instead of being trusted. Redis outages do not become fabricated queued/completed states. Unknown or wrong-owner handles receive the same ProbeAccessError. These internal errors are not new HTTP response contracts.

## 4. Admission, deduplication and capacity

Admission uses exactly sixteen retained job IDs (`probe-0` through `probe-15`). A SHA-256 request-ID hash picks the first slot and deterministic linear probing examines at most sixteen slots. BullMQ's atomic add with an existing job ID does not replace its payload. The controller reads the authoritative job afterward—BullMQ's returned add object alone can contain the caller's submitted data for a duplicate ID.

Concurrent producers converge on the same immutable slot for a repeated request. A matching request under another owner cannot obtain the handle. Once sixteen unique jobs have been admitted, further unique requests fail with ProbeCapacityError. This remains true after completion/failure/cancellation: records are retained, not automatically deleted and re-admitted. Partial submission/response failure is resolved by retrying the same request ID, not inventing another job.

This fixed capacity intentionally sacrifices continuous test throughput to avoid a check-count-then-add race or a homegrown admission lease. It is **not** a proposed production quota. There is no public producer; public build requests still fail closed. Per-user compute/time/disk quotas and authenticated job admission belong to the durable design below.

Retained job data is bounded (strict small schema), attempt count is two, cancellation markers have at most sixteen slot fields, and event streams use approximate MAXLEN 128 (Redis may retain a small extra block). There is no per-client unbounded Redis key generation inside a queue. Jobs/markers have no automatic TTL: hard slot retention preserves deduplication until explicit test teardown. Tests remove only their exact random prefixes, never FLUSHDB or shared queues. Trusted code with raw Queue/Redis access is outside this controller's admission boundary; production ACLs/network isolation remain required.

## 5. Worker execution, retry and recovery

Workers are created with autorun false. Readiness first establishes the live Redis connection and sets BullMQ global concurrency to two, then starts consumption. Each worker also has local concurrency two. Two workers cannot independently multiply that global limit. [BullMQ global concurrency](https://docs.bullmq.io/guide/queues/global-concurrency).

Unsupported names/payloads/job IDs throw an UnrecoverableError with a fixed message; they are not retried. Transient probe failures are replaced with a fixed safe error, with two total attempts and a fixed 100 ms retry delay for test-produced probes. No external side effect needs compensation, and replaying the metadata read is idempotent. Older untyped healthchecks now fail closed; there was no repository producer relying on their arbitrary payload format.

Production locks renew with a 30-second duration; stalled checks run every 30 seconds, with maxStalledCount one. A killed worker's expired lock permits a replacement to retry the read. This is at-least-once delivery, not exactly-once execution. Duplicate execution must be harmless; an Android compiler will require durable attempt fencing and isolated outputs before this pattern can be extended. [BullMQ stalled jobs](https://docs.bullmq.io/guide/jobs/stalled), [idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs).

There is no timeout pretending an unclaimed waiting job executed or failed: it remains queued while Redis retains it. Retained slots prevent unbounded stale queues. Production reconciliation/age policies need durable history; Redis loss is not silently reconstructed as success.

The process installs SIGINT/SIGTERM handlers, makes shutdown idempotent, waits for active work and closes its queue connections. A 10-second deadline terminates a stuck process with exit 1, leaving unacknowledged work for lock recovery. Startup has a five-second deadline and exits nonzero with a fixed event if readiness cannot be established. The integration suite tests factory shutdown waiting for actual active work; it does not certify an external supervisor's signal delivery or production failover.

## 6. Cancellation semantics

The controller checks request/owner access, then a small Lua command atomically rechecks the job payload and terminal sorted sets before setting a bounded cancellation marker. Terminal jobs reject a new cancellation request. Waiting and running probes accept a cooperative request; status remains queued/running with cancelRequested until terminal acknowledgement.

The worker checks the marker before and after its metadata read. An accepted marker before BullMQ's terminal acknowledgement wins the completed-versus-canceled status projection, including the small race after the last worker check. It does not assert that a Redis read already performed was undone. Terminal failure remains failure rather than being masked as cancellation. No active queue lock is stolen and no job is deleted to simulate cancellation. Future compiler cancellation must separately terminate the isolated process tree, fence publication and persist the terminal decision.

## 7. Redis failure and logging policy

Redis URL parsing permits standalone redis/rediss only, database paths 0–15, decoded credentials and no query/fragment options. rediss uses certificate verification, with a DNS server name where applicable. Cluster/Sentinel and actual deployed TLS/ACL behavior were not certified. Production replicas must use the same endpoint/database/queue policy; authentication limiters keep their existing configuration.

Producer operations fail with controlled ProbeUnavailableError; they do not switch to memory or accept fictitious jobs. Live readiness handles reconnection rather than relying on BullMQ's cached initial readiness promise. Producer/auxiliary commands have a two-second command timeout and bounded retry behavior; worker blocking/lock connections retain BullMQ-compatible retry settings. Queue close explicitly disconnects its client, including an outage path. Startup/readiness is not a declaration of PostgreSQL health: worker performs no database operations.

Structured worker logs contain fixed event names only (`worker.error`, `probe.failed`, `probe.acknowledged`, startup/shutdown events). They contain no error.message, job data, owner/request identifiers, session data, connection URL or credentials. Known processor failures stored in Redis also use fixed messages. Production upstream/supervisor/Redis logging and ACLs still require independent deployment review.

## 8. Persistence limitation and exact proposed schema (NOT IMPLEMENTED)

Redis is queue state, not a durable user-visible history or audit ledger. Persistence/failover configuration, snapshots and AOF affect queue durability but do not solve database/queue dual writes, ownership snapshots, durable idempotency or stale-worker publication. No public build status endpoints should be introduced on Redis alone.

Proposed **additive** PostgreSQL models, for separate explicit approval:

| Model | Proposed fields and constraints |
| --- | --- |
| BuildJob | id UUID PK; ownerId FK User; projectId FK ROMProject; revisionId FK ConfigurationRevision; idempotencyKey varchar(64); requestDigest char(64); configurationDigest char(64); targetProfileId text; targetProfileVersion integer; evidenceDigest char(64); sourceLockDigest char(64); state enum QUEUED/PREPARING/RUNNING/COMPLETED/FAILED/CANCELED; version integer default 1; cancelRequestedAt/queuedAt/startedAt/finishedAt timestamptz nullable; createdAt/updatedAt timestamptz. UNIQUE(ownerId,idempotencyKey), indexes(ownerId,createdAt,id) and(state,updatedAt). Revision ownership/project relationship checked transactionally; stored approved snapshot must remain available. |
| BuildAttempt | id UUID PK; jobId FK BuildJob; number integer; fenceToken bigint; workerIdentity text; executorDigest char(64); state enum CLAIMED/PREPARING/RUNNING/COMPLETED/FAILED/CANCELED; leaseUntil timestamptz; startedAt/finishedAt nullable timestamps; failureCode nullable constrained code, never raw exception/log text. UNIQUE(jobId,number), UNIQUE(jobId,fenceToken), index(state,leaseUntil). |
| BuildOutbox | id UUID PK; jobId FK BuildJob; eventVersion integer; kind enum DISPATCH/CANCEL; state enum PENDING/CLAIMED/PUBLISHED; attempts integer default 0; nextAttemptAt/claimedUntil/publishedAt nullable timestamps; createdAt timestamp; failureCode nullable constrained code. UNIQUE(jobId,eventVersion,kind), index(state,nextAttemptAt). Minimal queue envelope contains identifiers/version only. |

Schema approval must resolve deletion/retention policy explicitly. Proposed restricted deletion of referenced jobs/revisions is not assumed compatible with future account/project deletion. No new fields, back-relations, constraints or enums were added to existing Prisma models here.

Submission design: authenticate/origin-check; load owned revision; validate approved target/evidence and compiler gate; enforce per-owner/global reservation; transactionally create idempotent BuildJob + AuditLog + BuildOutbox. A dispatcher adds a stable queue ID and marks the outbox published; duplicates are harmless. A worker claims a database attempt with compare-and-swap/fence token, and commits transitions only while holding the current lease. Queue delivery alone cannot authorize execution. Reconciliation handles stale outbox rows, missing Redis jobs and expired attempts. Cancel follows the same durable authorization/CAS/outbox path. Completed requires real executor/output evidence; boot/hardware verification remains a separate gate.

Migration procedure: review concrete Prisma/SQL and contracts; take and test an encrypted backup/restore; rehearse on an isolated copy; add new tables/indexes without rewriting or reassigning existing records; deploy readers/dispatchers with admission off; verify privileges, constraints, preserved digests and failure recovery; enable internal execution only after its independent gate. Rollback first disables admission, drains/stops dispatchers and reconciles leased attempts, then rolls back binaries while retaining new history tables. Do not drop tables containing history or run destructive down/reset scripts. Production backup/restore and deployment approval are separate prerequisites.

**Approval is required before implementing this schema or real build endpoints.** This phase proceeds no further than the isolated components above.

## 9. Files changed in D3

- `packages/contracts/src/jobs.ts` and additive export in `packages/contracts/src/index.ts`.
- `apps/worker/src/foundation.ts`, `apps/worker/src/main.ts`, `apps/worker/package.json`.
- `package.json`: integration script includes both existing API and new worker integration files.
- `pnpm-lock.yaml`: worker's existing-contracts workspace link; earlier security changes preserved.
- `tests/worker-orchestration.test.ts`, `tests/foundation.integration.ts`, `tests/helpers/foundation-crash.cjs`.
- This report.

Prior uncommitted work was preserved. The existing `tests/foundation.test.ts` is unchanged in the final tree. No API controller, UI, schema, existing project, catalog, credential or environment file was changed. Ignored `.local/d3-*` files retain verification evidence only.

## 10. Verification

| Verification command | Exact final result |
| --- | --- |
| `pnpm typecheck` | Passed: root tests checked and seven workspace tasks successful |
| `pnpm lint` | Passed: seven workspace tasks; worker/API lint scripts are TypeScript checks, web uses ESLint |
| `pnpm test` | 61 passed, 0 failed/skipped; includes all 57 prior cases and four new worker unit cases |
| `pnpm test:integration` | 23 passed, 0 failed/skipped, about 53.2 seconds; 19 existing API/catalog cases plus four new real-Redis worker cases |
| `pnpm test:e2e` | 6 passed, about 14.0 seconds, Chromium with production application servers |
| `pnpm build` | Seven tasks successful, two cached; API, worker, contracts and Next application build passed |
| `pnpm audit --json` | Zero advisories at every severity; 636 dependencies |
| `pnpm audit --prod --json` | Zero advisories at every severity; 267 dependencies |

New tests verify transitions and terminal states; payload/result rejection; Redis database/credential/TLS options; disabled production test producer/hooks; D2 build eligibility false; atomic capacity and duplicate submissions through independent controllers; wrong-owner status/cancel rejection; two workers under a shared concurrency limit; transient retry versus permanent unsupported-build rejection; cooperative queued/active cancellation; active-work graceful close; actual SIGKILL followed by lock-expiry recovery; and producer/worker reconnect through an isolated TCP proxy. A recovered or completed probe still has compiled false. These are real standalone Redis integration tests, not mocks or Android build tests. TLS certificate exchange, Redis failover/data loss and an external supervisor were not exercised.

Existing regressions cover auth/password/session/cookies/proxies, Redis authentication protections, ownership isolation, build503, shared/OpenAPI contracts and preserved draft behavior. Production API route/response contracts were not changed. Test queues use isolated prefixes, and only those fixtures were removed. The actual PostgreSQL/Redis services were not reset, stopped or reconfigured for the outage test.

Preliminary failures and corrections: TypeScript caught use of raw ioredis eval/ping methods against BullMQ's current client interface; the code now uses its named-command adapter and metadata read. The first outage test exposed cached readiness and a queue-close reconnect leak, both corrected and retested. A test filename collision temporarily replaced five existing cases; the original file was restored byte-for-byte and four new cases moved to `worker-orchestration.test.ts`. The final 61-case run includes every original case. One failed isolated outage fixture namespace was identified and removed explicitly; no shared queue was cleared.

Integrity evidence: before implementation and after all suites, count plus SHA-256 of sorted serialized rows matched for **all 28 Prisma models**. All existing users, sessions, projects, revisions and catalog records remain unchanged. Tests clean only their own account/project fixtures using the existing harness. No Prisma schema or migration file changed.

The full root `.env` digest matches the pre-D3 snapshot. It remains ignored and untracked; the HMAC secret was not rotated. Value-based scanning of nonignored repository files, D3 logs and browser static assets found zero occurrences of the existing HMAC key, database URL or its password. This is a bounded check, not a guarantee about external logging systems or all possible secrets.

The previous local API/web processes were stopped for production build/browser tests and restarted with explicit ports afterward. Read-only checks returned HTTP 200 for `/api/v1/health`, `/api/v1/ready` and `http://localhost:3000`. Database/environment preservation comparisons were repeated after restoration and still matched. No production worker was started to consume the shared queue during verification; only isolated test consumers ran. Build the application before integration tests, which launch the compiled API and compiled crash-fixture worker.

## 11. Remaining prerequisites and D4 recommendation

D2 source declarations are not a complete immutable source lock, verified toolchain or supported physical-device recipe. No source was downloaded in D3. No shell/user script, compiler, firmware generator, image, emulator, artifact delivery or flashing operation was executed by a worker. Application TypeScript/Next production builds are unrelated to Android compilation.

Before isolated compilation: separately approve durable orchestration persistence/contracts; complete source/transitive prebuilt/toolchain/signature/license closure; provision resource-qualified dedicated workers; verify sandbox/guest isolation, restricted egress, no API/database/HMAC secrets in build guests, bounded CPU/RAM/disk/time, fencing/cancellation and recovery. Outputs require independent validation and virtual boot evidence before any build-verification claim. Public deployment remains NO-GO.

Recommend D4 remain a separately approved isolation/executor feasibility phase, with persistence approval as an explicit dependency. Do not infer that a successful infrastructure probe authorizes a compiler. **Stop after D3; no D4 implementation has begun.**
