# D5 existing-data migration rehearsal

Reviewed 2026-10-31 (Asia/Tashkent), on `ai/codex-backend`. **Live migration remains unapproved and unapplied.** This report supplements [D5 architecture](phase-d5-durable-jobs-outbox.md). No frontend/shared contract or live `.env` changes.

## Exact SQL effects

The unchanged proposal is `20261030190000_durable_build_jobs/migration.sql`, SHA-256 `839b79dfc904a5a7e2925f16ea775b0eb7a8ce71ab1c8ef5bf03cc622155acc9`.

It is additive in schema/data terms:

| Object | Effect |
| --- | --- |
| DurableBuildState / DurableOutboxState | Create two enums |
| DurableBuildJob / DurableBuildAttempt / DurableBuildOutbox | Create three empty tables, each with a primary key |
| Secondary indexes | Create ten indexes, five unique, on the new tables only |
| Foreign keys | Add six constraints on new tables: three references to existing User/ROMProject/ConfigurationRevision, three between the new tables |
| CHECK constraints | Five constraints enforce preflight-only compiled:false, counter bounds and dispatch/attempt lease rules |
| Prisma migration history | Successful deploy appends one bookkeeping row; existing migration rows remain intact |

There is no DROP, TRUNCATE, DELETE, UPDATE, existing-column alteration, data backfill or seed. All ALTER TABLE targets are new tables. BEGIN/COMMIT wraps the schema changes. Existing rows, columns, indexes and public contracts are retained.

Additive does not mean behavior-neutral: PostgreSQL installs internal foreign-key triggers on the referenced existing tables. Once a durable job references an owner/project/revision, RESTRICT prevents deletion of that referenced row. Primary-key updates cascade to the new references. Deleting a new job cascades its attempts/events; removing a current attempt nulls the new job pointer. No new jobs are produced by the current API/production worker, so the new tables remain empty before separately approved wiring. There is no cascade from this migration that deletes existing users/projects/audits.

## Live status and drift

The existing database has exactly these three finished, non-rolled-back migrations, with repository SQL checksums matching:

- `20261027142119_foundation`
- `20261027150000_romcraft`
- `20261028160000_real_catalog`

`prisma migrate status` returns exit 1 because D5 alone is pending. A read-only `prisma migrate diff` from the live datasource to the committed pre-D5 schema returns exit 0 (empty difference). To cover PostgreSQL objects not represented by Prisma, a separate empty `nexos_d5_drift_eb527137` database received only the original three migrations. Its normalized full schema dump matches live exactly, excluding random pg_dump restrict tokens and owner/ACL emission. Restored existing-table owners/ACLs and database locale/ACLs were separately checked and match live. No unrecognized user schema exists beyond public. No drift was detected at this review point.

## Backup and restore proof

A PostgreSQL 18 custom-format backup was written outside the repository under `%LOCALAPPDATA%/NEXOS/private-backups/`, in a unique D5 review directory. Its exact local path, SHA-256, restore commands, row hashes and private diagnostics are retained locally, not in Git. Size: **63,224 bytes**. Directory inheritance is disabled; only the current Windows account and SYSTEM have access. Backup files inherit that restricted ACL. The archive was never uploaded or committed.

`pg_dump --format=custom --snapshot=<exported snapshot> --lock-wait-timeout=5s` shared a retained REPEATABLE READ, READ ONLY transaction with the source row-hash capture. This avoids comparing two different points while the frontend is active. `pg_restore --list` succeeded, followed by an actual `pg_restore --exit-on-error --single-transaction` into a newly created, guarded **`nexos_d5_test_eb527137`** database. No live restore/reset/reseed occurred.

Before migration, all **29 existing tables / 55 rows** matched the exported source snapshot exactly, and normalized restored schema matched live. The snapshot includes seven users, two ROM projects, two configuration revisions, six sessions and eleven audit records. No identities, passwords, session tokens or record contents are included in this report.

The unchanged migration was then deployed only to the restored clone. PostgreSQL migration history measured approximately **74.5 ms** for D5. All **28 application tables** remained exactly identical; all original migration-history rows remained present, with only D5's additional history row. New job/outbox tables were empty. The applied checksum matches the proposal.

After integration and E2E tests, **every original row hash is still present and unchanged**, including all original users/projects/revisions/sessions/audits. Existing catalog tests deliberately retained one additional synthetic manufacturer/device/variant in the isolated clone; they did not alter original catalog rows. Thus 25 application tables are still exact full-table matches and three contain additional test fixtures. There are no surviving D5 test jobs/events. The backup archive checksum still matches its creation manifest.

This is a verified single-database logical recovery point on the existing PostgreSQL 18 installation. Restore used existing cluster roles, notably the original database owner; a different machine/cluster needs compatible roles, extensions and PostgreSQL tooling. It is not a cluster/WAL/PITR backup or an off-device disaster-recovery copy. A whole-database restore would discard later writes and must never be used automatically as a rollback.

## Tests and correction found during rehearsal

All commands ran in NEXOS-codex; clone tests used private `.local/d5-review/clone.env` plus the separate authenticated Redis on **6381**, not the development Redis 6380. Test accounts are random/synthetic; copied real credentials/accounts were not used for login or modified.

The first restored-copy run passed 35/36 tests and exposed a real concurrent outbox retry gap. Raw PostgreSQL serialization failures were emitted by Prisma as **P2010 / SQLSTATE 40001**, rather than P2034. The transaction wrapper now retries only 40001 serialization and 40P01 deadlock forms of P2010, alongside its existing classified errors, with the same maximum three retries. Other raw SQL failures remain non-retryable/sanitized. A regression test verifies successful retry, exhaustion after four total transactions and no retry for unrelated SQL errors. SQL/schema/security checks are unchanged.

| Command/check | Actual result |
| --- | --- |
| `pnpm.cmd test` | 86 passed; no failures/skips |
| `pnpm.cmd typecheck` / `pnpm.cmd lint` | All seven tasks passed in each |
| `pnpm.cmd --filter @rom-hub/worker build` | Passed |
| `node --env-file=.local/d5-review/clone.env scripts/with-env.mjs pnpm exec tsx --test --test-concurrency=1 tests/*.integration.ts` | After retry fix: all seven D5 cases pass; broader suite **35 passed / 1 failed / 0 skipped** on both subsequent runs |
| Relevant Playwright foundation/protected-routes E2E on clone, API4200/web3100 | **8 passed**, including registration, session lifecycle/protected routes and real draft persistence through Next |
| Production `pnpm.cmd exec turbo build --env-mode=loose` with command-local production/Prisma Windows engine settings | Final run: all seven tasks passed, six cached |
| Final private backup/live/clone record and metadata checks | Passed; original rows intact; backup hash and live `.env` unchanged; live still three migrations and no D5 tables |

The remaining broad-suite failure is the existing API Redis-outage startup check at `tests/api.integration.ts`: its child must exit within five seconds of process creation, including Windows/Nest/Prisma startup. This previously documented timing issue recurred after the retry correction. A separate isolated closed-Redis startup diagnostic exited **1 in 4,749 ms**, emitted the expected sanitized authentication-Redis failure and did not emit its credential URL. This supports startup overhead/deadline sensitivity, but does **not** make the failed suite green. No security assertion or timeout was changed, no test was skipped, and the failure remains disclosed.

Initial full build encountered the known Windows EPERM on replacing the Prisma DLL held by the running API. Only this worktree's verified API process was stopped briefly, the production build passed, and the API restarted with the original `.env`. PostgreSQL, Redis and the frontend process were not stopped. No dependency changed; prior D5 full/production audits remain zero-advisory results, not newly executed audits for this documentation-only/dependency-unchanged review.

## Locks, downtime and rollback risk

A rollback-only lock probe executed the same D5 statements in the isolated baseline database, inspected locks before ending its transaction, and then rolled everything back. It observed SHARE ROW EXCLUSIVE locks on **User, ROMProject and ConfigurationRevision**, and ACCESS EXCLUSIVE locks on the new tables. An ordinary User SELECT completed; a second connection's no-op User UPDATE hit its configured 250 ms lock timeout. No live lock probe or write was used.

Foreign-key creation therefore can briefly block registration/account updates and project/revision writes. Ordinary reads may continue. The measured 74.5 ms is not a live-duration guarantee: long transactions, load and competing DDL can prolong waiting. No table rewrite or index build over an existing populated table is required. Recommend a short quiet maintenance/write-pause window, bounded session lock/statement timeouts (for example 5s/30s), and blocker monitoring. Do not promise zero downtime. PostgreSQL documents these locks and their conflicts in [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html) and [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

Failure before COMMIT rolls back D5 schema changes; Prisma may separately record a failed migration and require inspection/resolution before another deploy. Do not automatically mark it applied or blindly retry production DDL. After successful commit, preferred rollback is disable durable producers/consumers and retain the additive tables/history. Existing API code can continue using original models. There is no automatic down migration. Dropping tables would destroy future job history; restoring the backup would also lose subsequent user writes. Either destructive action requires separate explicit approval and a fresh recovery plan.

## Current frontend/API compatibility and final gate

The active frontend on localhost:3000 serves its homepage and proxies readiness successfully; direct API4000 and proxied health/readiness are 200. Anonymous auth/me and projects remain 401; CORS preflight returns 204 with exactly localhost:3000 and credentials enabled. The initial diagnostic used a nonexistent auth/session path and correctly returned 404; the actual auth/me path was then checked. No live login/test-account mutation was needed. The migrated clone passes the eight browser regressions using the backend worktree's existing frontend fixture. This does not certify unseen Gemini changes; Gemini's worktree was untouched.

Public builds remain the existing authenticated 503; default readiness denies preflight admission and production durable factories remain unwired. Normal registration/login/drafts continue to use existing tables and contracts. FK deletion restrictions become a compatibility concern once job wiring creates references and require a retention/deletion policy before activation.

**Do not apply D5 to nexos_development yet.** Review this evidence and the disclosed Windows test limitation, obtain explicit final approval, recheck drift/SQL checksum/blockers, and refresh the backup before any approved live deployment. Migration approval alone does not authorize production job wiring, real Android compilation or flashing.
