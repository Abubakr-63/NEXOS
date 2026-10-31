# D5 approved local migration and target guard

**Recovery follow-up:** [D5 runtime recovery](phase-d5-runtime-recovery.md) restores the native local services, verifies current Gemini proxy/auth/project behavior and confirms all original data intact. It records 88 unit/36 integration/eight E2E passing, production build/type/lint passing, and current moderate dependency audit findings. The interruption blocker below is historical and resolved.

Date: 2026-10-31 (Asia/Tashkent). Scope: the user's explicit approval for **only** `20261030190000_durable_build_jobs` on local **nexos_development**, with production job wiring disabled. Earlier [rehearsal](phase-d5-backup-migration-rehearsal.md) remains historical evidence; the local migration is now applied.

## Guard correction and tests

`apps/api/scripts/local-migration-target.cjs` exports the target query and reusable validation. The query uses `current_database()::text`, **`host(inet_server_addr())`** (supported text instead of native inet), `inet_server_port()::integer` and boolean recovery state. It rejects unexpected/null types instead of coercing them.

Only nexos_development, explicit local port 5433, development mode and matching configured/server loopback identities pass. Normalization supports exact 127.0.0.1, its defensive /32 representation, IPv6 ::1/expanded equivalents and IPv4-mapped 127.0.0.1 equivalents. Masks other than exact host /32 or /128, zones, unspecified/remote addresses, DNS names, shortened/integer/hexadecimal IPv4 forms, connection overrides and mismatched server identities fail closed. Raw URL authority is checked before URL canonicalization can hide ambiguous notation. Production callers and recovery/null recovery states are rejected. Query parameters are limited to an optional single schema=public on the original connection; bounded deployment timeout options are separately constructed by the private operator script.

`tests/local-migration-target.test.ts` adds two table-driven regressions covering valid IPv4/IPv6/CIDR/mapped forms, invalid ports/database names/types, null addresses, non-loopback peers and ambiguous configuration. `pnpm.cmd test`: **88 passed, zero failed/skipped**. `pnpm.cmd typecheck` and `pnpm.cmd lint`: all seven workspace tasks passed. The same guard was then exercised read-only on the actual server and returned exactly nexos_development / 127.0.0.1 / 5433 / recovery:false.

## Backup, quiet window and execution evidence

The original restricted private backup still matched its verified checksum; both archive listing and a full pg_restore read succeeded. Its prior actual restore proof remained valid. After pausing only this worktree's verified API process, a **fresh 63,245-byte** custom archive was captured with an exported read-only repeatable-read snapshot shared with before-row hashing. The new archive passed a full read. Both backups and manifests remain outside Git in the ACL-restricted private local backup directory; no database restore or additional database creation occurred in this retry.

Immediately before execution, repository/applied migration checksums matched, exactly D5 was pending, and both Prisma drift comparison and normalized PostgreSQL schema comparison against the existing three-migration baseline were clean. Target identity and original .env checksum matched. Session settings were verified as lock_timeout=5s and statement_timeout=30s. The API was paused; checks found no other active/idle-in-transaction activity and no concurrent advisory maintenance, incompatible relation locks or waiting locks on this database. No session was forcibly terminated to bypass a blocker.

The ignored private operator script invoked **Prisma migrate deploy** only after those gates. The migration directory contained precisely the existing three migrations plus approved D5. Deployment output records only D5 applied. Its SQL checksum remains `839b79dfc904a5a7e2925f16ea775b0eb7a8ce71ab1c8ef5bf03cc622155acc9`. No reset/drop/truncate/reseed or existing-data update command ran. Deployment plus record/status verification took approximately 4.56 seconds; this is not the SQL transaction's isolated duration.

The script completed before the tool interruption, writing its private success report after all record and final-status checks. On resumption those saved reports were inspected; the migration command was **not rerun**.

| Record set | Immediately before | Immediately after |
| --- | ---: | ---: |
| Users | 7 | 7 |
| ROM projects | 2 | 2 |
| Configuration revisions | 2 | 2 |
| Audit entries | 12 | 12 |
| Sessions | 6 | 6 |
| Applied migration records | 3 | 4 |

All **28 original application tables** have identical full-table row hashes/counts. All original migration-history rows are intact; D5 adds one row. Only the three expected DurableBuild tables were added, all empty. Final Prisma migrate status exited **0**, reporting **Database schema is up to date**. Original .env hash remained unchanged. Production worker/API durable-job factories remain unwired; no compilation or artifact is enabled.

## Interruption and remaining verification blocker

After the interruption, a read-only follow-up could not reach PostgreSQL 127.0.0.1:5433. Socket checks also found Redis6380, API4000 and frontend3000 unreachable. Other PostgreSQL processes were observed, but their presence is not evidence that the approved helper instance is available. The cause was not established; no migration failure or data loss is inferred from this outage.

In accordance with the user's stop-on-verification-failure instruction, no service/infrastructure restart, further migration, rollback or unsafe workaround was attempted. The API had deliberately been paused for maintenance and was not restarted against an unavailable database. Therefore **post-migration API readiness, authenticated session/login and project-functionality checks are blocked and have not passed in this run**. The prior migrated-copy E2E results remain historical, not a substitute for these outstanding local-runtime checks. Full production build/integration suites were not rerun in this guard-only attempt; the earlier Windows startup-deadline limitation remains documented in the rehearsal report.

Next authorized recovery work must first restore/confirm the existing local runtime, inspect actual migration status read-only, recheck row preservation against this run's manifests and then exercise API health/readiness/auth/project behavior. Do not reapply D5 or enable build-job wiring. No frontend/shared contract file was modified; PR #1 must remain draft/unmerged.
