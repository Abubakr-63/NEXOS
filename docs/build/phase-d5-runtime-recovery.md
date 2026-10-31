# D5 post-migration runtime recovery and verification

Verified 2026-10-31, Asia/Tashkent. Branch `ai/codex-backend`; starting commit `9ba75670614a500b82f2e886d57d114ed06478fe`. This supersedes the runtime blocker in [the local deployment report](phase-d5-local-migration-applied.md). **D6 and production build-job wiring were not started.**

## Diagnosis and recovered services

The runbook uses native Windows PostgreSQL/Redis processes, not Docker containers. Docker CLI/Desktop/service were not found; `wsl --status` reported WSL not installed. Container state/logs are therefore not applicable. The unrelated Windows PostgreSQL service on 5432 remained running and untouched.

PostgreSQL's existing helper-cluster log records an interrupted/unclean shutdown, followed by normal WAL replay/checkpoint and readiness on 5433. A short-lived recovery attempt was observed before this run's explicit recovery; another interrupted recovery was logged. There was no conflicting listener on the helper ports when recovery was required. OS last boot predates the outage (2026-10-29), so a machine reboot was not established. The supported diagnosis is **stopped/interrupted native development processes**; the exact terminating actor is unknown. There is no evidence of a Docker/WSL failure, migration SQL failure or changed database files/records. No speculative causal claim is made from the timing alone.

The documented `node apps/api/scripts/windows-local.mjs start` was launched hidden from this worktree with private output logs, using existing configuration/data only. It restored the helper-owned PostgreSQL5433 and authenticated Redis6380. PostgreSQL performed its own recovery; no reset, restore, volume recreation or seed was run. `windows-local.mjs status` reports **PostgreSQL running; Redis PONG**. Existing cluster/AOF directories, credentials and .env were preserved.

| Service | Action and final state |
| --- | --- |
| Helper PostgreSQL5433 | Started against existing `.local/windows-runtime/postgres`; exact database nexos_development / host127.0.0.1 / port5433 / recovery:false; final PID12932 |
| Development Redis6380 | Started against existing authenticated config/AOF; PONG and API readiness pass; final PID12316 |
| API4000 | A backend debug launcher came up independently during diagnosis. It was paused once to release Prisma's DLL for build. The documented `node --env-file=.env apps/api/dist/main.js` then became available from another launcher and was reused, avoiding duplicates; final PID8980 |
| Gemini frontend3000 | Initially absent, then independently started from NEXOS-gemini; never launched/stopped/modified by this run; final server PID12012 |
| Isolated test Redis6381 | Existing test config/data started only for test execution, then authenticated SHUTDOWN SAVE after integration/E2E; no listener remains |
| Test API4200/web3100 | Temporary Playwright-managed servers only; both stopped after tests |

Those PIDs are observations, not reusable commands. Before starting anything, inspect the port/current process. Existing runtime commands, from NEXOS-codex:

```powershell
node apps/api/scripts/windows-local.mjs status
node apps/api/scripts/windows-local.mjs start
# Only if no API is already listening on 4000:
node --env-file=.env apps/api/dist/main.js
```

If Gemini's frontend is absent in a later session, Gemini can use its own terminal, without copying backend secrets or editing the backend .env:

```powershell
Set-Location C:\Users\admin\Desktop\NEXOS-gemini
$env:API_ORIGIN = 'http://127.0.0.1:4000'
pnpm.cmd --filter @rom-hub/web dev --port 3000
```

That frontend command was **not executed** by this recovery run. There is no newly installed service/autostart supervisor; long-term process hosting remains an operational consideration.

## Migration, constraints and preservation

Read-only comparisons use the approved deployment's private after-record manifest, not a new seed or an empty database. After crash recovery, after live fixture cleanup and after the isolated suites, **all recovered table counts/full row hashes matched that manifest exactly**, including every pre-existing user/project/revision/audit/session row. The original .env hash also matches.

| Development records | Recovered baseline | Final |
| --- | ---: | ---: |
| Users | 7 | 7 |
| ROM projects | 2 | 2 |
| Configuration revisions | 2 | 2 |
| Audit entries | 12 | 12 |
| Sessions | 6 | 6 |
| Durable jobs / attempts / outbox | 0 / 0 / 0 | 0 / 0 / 0 |
| Applied migration rows | 4 | 4 |

All six original sessions are unexpired, with unchanged stored hashes/metadata and unchanged authentication configuration. Existing users' raw credentials/cookies were not reused; the real session path was exercised with new synthetic accounts. No pre-existing project or audit entry was edited/deleted.

Prisma status reports **Database schema is up to date**, exit0. D5 has exactly one finished, non-rolled-back history row. Its original reviewed SQL was not edited or re-executed. New-table metadata matches the previously migration-tested restored database exactly: 52 columns, 13 indexes, 11 enum labels, five CHECK constraints, six foreign keys, three primary keys and PostgreSQL18's 38 NOT NULL constraint entries. This checks actual definitions/defaults, not merely existence/counts.

The production API/worker still does not import/wire durable admission/consumer factories. Authenticated build POST remains **503 unavailable**, and all new durable tables remain empty even after exercising that endpoint. No Android source/SDK download, compilation, fake ROM ZIP, artifact publication or flashing was triggered.

## Live auth/project and frontend proxy checks

The actual development API and active Gemini proxy passed 21 HTTP assertions: register201; login201; persisted cookie session/me200; owner-scoped projects200; draft creation201; reload/save/revisions200; wrong password401; rejected Origin403; non-admin403; another owner's known project404; build503; logout201; revoked-session/anonymous access401; authenticated auth/me through Gemini's localhost3000 proxy200. Session cookies remain HttpOnly, SameSite=Lax, host-only and Path=/ under the existing local HTTP mode. No security setting was relaxed.

The successful synthetic fixture's measured peak delta was **+1 user, +1 project, +2 revisions, +2 sessions, +2 audit entries**, with no durable rows created. Exact fresh fixture identity was checked before cleanup; only its own audit/session/project/user rows were removed. Final counts and original row hashes all returned to the baseline above.

An initial private harness attempt omitted the required JSON content type/body on a bodyless POST, correctly receiving403 before the expected build503. Its fixture was fully cleaned and counts restored. The harness was corrected to send JSON `{}` for bodyless POSTs; no application code/security assertion changed. Both temporary identities across the two attempts were cleaned. The initial harness failure is retained in private logs, not hidden as an application success.

Final repeated probes: direct API `/api/v1/health` and `/api/v1/ready` **200**; Gemini-proxied health/readiness **200**; anonymous proxy auth/me/projects **401**. Readiness exercises both PostgreSQL and authenticated Redis. No unexpected migration/startup errors remain in the recovered API. This verifies the current proxy integration; unseen future Gemini UI changes still need their own review.

## Executed checks

Private logs/manifests are under ignored `.local/d5-recovery/`. All fixture/queue/crash tests ran on **nexos_d5_test_27f6e30e + Redis6381**, never the live database/Redis6380. Existing fixture guards, unique queue prefixes and bounded cleanup were retained. No destructive live queue command ran.

| Command/check | Result |
| --- | --- |
| `pnpm.cmd test` | **88 passed**, zero failed/skipped |
| `pnpm.cmd typecheck` | Seven workspace tasks passed, root TypeScript passed |
| `pnpm.cmd lint` | Seven workspace tasks passed; existing worker/API lint scripts use TypeScript |
| `pnpm.cmd exec turbo build --env-mode=loose` with command-local production mode, API_ORIGIN4200 and installed Prisma Windows engine paths | Final **seven tasks passed**, five cached |
| `pnpm.cmd db:status` with installed schema-engine path | Exit0, four migrations, up to date |
| `node --env-file=.local/d5/test-final.env scripts/with-env.mjs pnpm exec tsx --test --test-concurrency=1 tests/*.integration.ts` | **36 passed**, zero failed/skipped; includes all seven real D5 cases and the previously timing-sensitive Windows startup check |
| Edge Playwright foundation/protected-routes via backend Windows config, test API4200/web3100, same isolated environment | **8 passed**, zero failed/skipped |
| Private live HTTP fixture, target/preservation and metadata-definition checks | All passed after correcting the harness request; final live data exactly preserved |
| `pnpm.cmd audit --json` | **Not clean: 3 moderate findings**, zero high/critical |
| `pnpm.cmd audit --prod --json` | **Not clean: 2 moderate findings**, zero high/critical |

The first production-build attempts encountered Windows EPERM replacing Prisma's loaded DLL while test/API clients were active. After those tests completed and the known backend debug process was paused, the explicitly production-configured build passed. An intermediate retry without those command-local production settings also failed at the same DLL step; it is not counted as production validation. No DLL lock was bypassed, no unrelated process was killed and no API was duplicated. The prior startup-deadline flakiness is historical; it passed unchanged this run, with no tests weakened or skipped.

## Remaining dependency findings and handoff

The current audit output supersedes older zero-advisory reports. Findings involve [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and [glob AbortSignal cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Full-graph count includes affected minimatch versions in tooling; production findings include `@fastify/static → glob13.0.6 → minimatch10.2.6`. The registry recommends patched ranges minimatch>=11.0.1 and glob>=14.0.2. Exploitability was not asserted or dismissed in this recovery task. A compatibility-reviewed dependency remediation is still needed; no unrelated major override/dependency/lockfile or frontend change was introduced during concurrent Gemini work.

Runtime recovery and D5 regression verification are complete; dependency audits are explicitly not green. Documentation-only backend changes are delivered on ai/codex-backend. Keep PR#1 draft/unmerged. Stop here: no D6, production job wiring or real Android compilation.
