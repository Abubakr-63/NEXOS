# Phase B6.2 — Environment recovery and dependency remediation

Reviewed 2026-10-28 (Asia/Dushanbe). Read Phase B6.1 before implementation. Scope is local service recovery, compatible dependency remediation and regression verification. No Phase C or account-aware limiter implementation.

## Outcome

Local PostgreSQL, Redis, NestJS API and Next.js frontend are running. API liveness/readiness, frontend HTTP and readiness through the frontend proxy all succeeded after remediation. The audit decreased from **7 high and 3 moderate** to **2 high, 0 moderate, 0 low, 0 critical**, in both full and production audits. The remaining high advisories require major dependency changes and are deferred. **Phase C remains blocked pending explicit security review/approval.**

No frontend source/design, authentication logic, API response contract, PostgreSQL schema, active environment file or existing database records were changed. No queues, sessions or database storage were erased to recover services.

## 1. Environment diagnosis and recovery

Initial inspection found no listeners on ports 3000, 4000, 5433 or 6379. The repository PostgreSQL helper reported stopped. The existing `rom-hub-redis` Podman container was exited with code 0, no runtime error, and restart policy `no`. Its logs show SIGTERM followed by AOF fsync, final snapshot and graceful shutdown at 20:10:21 +05 on October 28. The logs do not identify who sent SIGTERM; a crash, data corruption or credential problem was not established. The persisted `rom-hub-redis-data:/data` mount remained present.

Used the existing recovery mechanisms, not a replacement deployment:

```sh
podman start rom-hub-redis
pnpm db:local:start
pnpm db:status
```

The Redis container mechanism and Compose alternative are already documented in `distributed-rate-limiting.md`; `infrastructure/docker/compose.yaml` defines the same Redis 7 Alpine/AOF service. This local instance uses Podman, so the existing named container was started instead of creating a second service. `podman exec rom-hub-redis redis-cli ping` returned PONG. PostgreSQL reused `.local/postgres/data`, verified a real connection on 127.0.0.1:5433, and reported all three migrations applied. No migration/reset/seed was run.

A second concrete startup issue was discovered: root `.env` sets `PORT=4000`, and the web script's existing env loader also imports it. An initial web startup therefore occupied port 4000 and caused the API to fail with EADDRINUSE. Both owned startup processes were stopped and restarted with explicit per-process ports; no frontend code or environment values were edited:

```sh
# Separate terminals, from the repository root:
PORT=4000 pnpm dev:api
PORT=3000 pnpm dev:web
```

Final observations:

| Check | Result |
| --- | --- |
| Existing Redis container | Running; PONG |
| PostgreSQL on 5433 | Real connection verified; migrations up to date |
| `http://localhost:4000/api/v1/health` | HTTP 200, status ok |
| `http://localhost:4000/api/v1/ready` | HTTP 200, status ready |
| `http://localhost:3000` | HTTP 200 |
| `http://localhost:3000/api/v1/ready` | HTTP 200, status ready |

Development servers were temporarily stopped for the production build/E2E server ownership and restored afterward. No automatic boot service or restart policy was silently installed. After a host shutdown, start the existing dependencies again using the commands above. Production service supervision remains an operator decision.

## 2. Exact dependency changes and compatibility evidence

Only root `pnpm.overrides` and the lockfile were changed for dependencies. Existing js-yaml 5.4.1 remediation remains intact. No new dependency family or major version upgrade was introduced.

| Dependency | Before → final | Scope and rationale |
| --- | --- | --- |
| Fastify | 5.11.3 → **5.12.6** | `fastify@5.11.3: 5.12.6` replaces both the direct API copy and Nest adapter's exact pinned copy. Nest adapter stays 11.2.8. A direct-only bump would leave the actual adapter server behind. Both resolve the identical patched module, asserted by tests. |
| Effect | 3.18.4 → **3.20.0** | `@prisma/config@6.19.0>effect: 3.20.0` limits the same-major update to Prisma configuration. Prisma/client remain 6.19.0; deepmerge-ts remains 7.1.5. |

Fastify 5.12.5 was the minimum resolving the original seven Fastify findings. The intermediate audit identified a newly applicable low advisory, GHSA-389g-gv7q-r4x8, affecting 5.12.2–5.12.5; the final selection was therefore 5.12.6. This is a targeted same-major maintenance update, not an unrestricted latest-version upgrade. The [Fastify 5.12.5 release](https://github.com/fastify/fastify/releases/tag/v5.12.5) and individual advisories document the earlier fixes; the [header propertyNames advisory](https://github.com/fastify/fastify/security/advisories/GHSA-389g-gv7q-r4x8) identifies 5.12.6 as its fix.

The [Effect 3.20.0 release](https://github.com/Effect-TS/effect/releases/tag/effect%403.20.0) documents scheduler isolation of AsyncLocalStorage between fibers. This is the minimal fixed version identified by the advisory. No Effect RPC server is present in NEXOS; the reachable usage is Prisma configuration tooling. A scoped override was accepted only after configuration loading, invalid configuration handling, client generation, schema validation, migration status, type checking and the application regression suite succeeded. These checks demonstrate this repository's exercised compatibility, not compatibility with every possible Prisma configuration or an independent RPC exploit reproduction.

Overrides remain explicit maintenance obligations: review them when upgrading their parent packages, prefer upstream-supported resolutions when available, and remove redundant overrides once the vendor dependency incorporates the fix. `pnpm install --frozen-lockfile --offline --ignore-scripts` also passed, confirming the final manifests and lockfile resolve reproducibly without network or lifecycle scripts. This was a lockfile check, not a substitute for the earlier real generation/build commands.

## 3. Advisory-by-advisory disposition

The original reachability analysis remains in B6.1. The eight original advisories below no longer appear in the final audit:

| Advisory | Severity before | Fixed version selected | Disposition |
| --- | --- | --- | --- |
| [GHSA-38f7-945m-qr2g](https://github.com/Effect-TS/effect/security/advisories/GHSA-38f7-945m-qr2g) | High | Effect 3.20.0 | Resolved in Prisma configuration chain; no request-time Effect RPC path identified. |
| [GHSA-w2qp-rph6-63g4](https://github.com/fastify/fastify/security/advisories/GHSA-w2qp-rph6-63g4) | Moderate | Fastify 5.12.6 | Root primitive coercion fix included. |
| [GHSA-3m5p-2c4r-xxw2](https://github.com/fastify/fastify/security/advisories/GHSA-3m5p-2c4r-xxw2) | Moderate | Fastify 5.12.6 | Hop-count proxy spoofing fix included; B3's explicit IP trust policy retained. |
| [GHSA-4mh8-r7rc-xpvc](https://github.com/fastify/fastify/security/advisories/GHSA-4mh8-r7rc-xpvc) | Moderate | Fastify 5.12.6 | HTTP/2 trailer exception fix included; NEXOS still does not enable HTTP/2. |
| [GHSA-667r-xxjv-c9mm](https://github.com/fastify/fastify/security/advisories/GHSA-667r-xxjv-c9mm) | High | Fastify 5.12.6 | Async schema result collision fix included. |
| [GHSA-p68q-wchp-6fh7](https://github.com/fastify/fastify/security/advisories/GHSA-p68q-wchp-6fh7) | High | Fastify 5.12.6 | Malformed URL/fallback authentication fix included. |
| [GHSA-hwr6-493r-vm6h](https://github.com/fastify/fastify/security/advisories/GHSA-hwr6-493r-vm6h) | High | Fastify 5.12.6 | Boolean-false schema fix included and directly regression tested. |
| [GHSA-9q9j-q6p8-xq58](https://github.com/fastify/fastify/security/advisories/GHSA-9q9j-q6p8-xq58) | High | Fastify 5.12.6 | Header schema normalization fix included. |

Also resolved the intermediate **low** [GHSA-389g-gv7q-r4x8](https://github.com/fastify/fastify/security/advisories/GHSA-389g-gv7q-r4x8): header `propertyNames` enum/const case normalization. A focused test now rejects a canonical-case denied header and permits an ordinary request. This schema feature is not currently used by NEXOS controllers, but leaving an introduced advisory was unnecessary when a compatible patch was available.

Remaining findings:

| Advisory/package | Installed; affected → fixed | Exposure and safe next step |
| --- | --- | --- |
| High [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), Zod | 3.25.76; `<4.6.6` → `>=4.6.6` | Direct API/shared-contract validation is production-reachable. Oversized constrained collections can exhaust memory. The existing 32 KiB API body limit and constrained collections mitigate exposure but are not proof of immunity. A coordinated Zod 4 migration changes validation/error semantics and needs separate approval; upgrading only the API copy risks shared ZodError identity mismatches. No approved same-major fix was identified. |
| High [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), deepmerge-ts | 7.1.5; `<8.0.0` → `>=8.0.0` | Transitive `prisma@6.19.0 > @prisma/config > deepmerge-ts`; also reported in production graph through @prisma/client. Cyclic graph merging can exhaust the stack. No public API cyclic-object merge path was found; JSON cannot represent cycles. Tooling/deployment exposure remains. Prefer vendor-compatible Prisma remediation; overriding to major 8 without broader configuration review is deferred. |

Full and production audits both exit **1** because these two high advisories remain. The public-metadata snapshot is `phase-b6-2-dependency-audit.json`. Audit reductions do not constitute a penetration test or proof of production exploitability/absence thereof.

## 4. Tests actually executed

All final commands below used the final Fastify 5.12.6 / Effect 3.20.0 resolution:

| Command/check | Exact result |
| --- | --- |
| `pnpm typecheck` | Passed; 7 workspace tasks plus root TypeScript |
| `pnpm lint` | Passed; 7 workspace tasks (backend uses its existing TypeScript lint script; web uses ESLint) |
| `pnpm test` | **24 passed, 0 failed** |
| `pnpm test:integration` | **10 passed, 0 failed**, real PostgreSQL and Redis |
| `pnpm test:e2e` | **6 passed**, Chromium/Playwright, production web/API servers |
| `pnpm build` | Passed; 7 workspace tasks |
| `pnpm audit --json` | Exit 1; 2 high, 0 moderate/low/critical |
| `pnpm audit --prod --json` | Exit 1; same counts |
| `pnpm db:generate` | Prisma Client 6.19.0 generated successfully after Effect patch |
| `pnpm db:validate` | Schema valid |
| `pnpm db:status` | Three migrations, up to date |
| Frozen offline lockfile installation | Passed |
| `git diff --check` | Passed |

Focused dependency tests assert both Fastify resolution paths, reject boolean-false bodies, reject invalid object bodies, permit valid bodies, reject malformed URI encoding, enforce case-normalized header propertyNames, and load valid/reject invalid Prisma configuration with the patched Effect copy. The B6.1 YAML test remains passing.

Existing suites exercise B1's current/legacy hashing, automatic upgrade and compare-and-swap races; B2 transaction rollback and duplicate registrations; B3 cookie creation/deletion, HTTPS validation and spoof-resistant proxy handling; B4 real Redis multi-instance limits, expiration, failure-closed outage and recovery; B6.1 sanitized access logs and malformed identifiers; session/logout/revocation and project ownership isolation. Redis network failure is simulated through a test TCP proxy without stopping/flushing the actual Redis server. Not every upstream advisory was independently exploited in this task; application integration compatibility and the explicit dependency regressions are the verified claims.

During test development, checks initially failed while installation had not yet linked the new versions, and a temporary Prisma-config test bug/cache assumption was corrected. Those intermediate failures are not presented as final successes; the final full suite above passed.

## 5. PostgreSQL preservation and authentication verification limits

Before integration/E2E, read-only digests were recorded for all 28 Prisma model delegates, including sessions, catalog and audit records. After both suites, every count/digest matched: **28 models checked, zero changed models**. The earlier B5 baseline also still matched: **1 user, 1 ROM project, 6 configuration revisions**. Raw records, password hashes, session hashes and database credentials were not included in this report. No reset, truncate, schema migration, seed or pre-existing-account mutation was used.

Registration, login, session handling, saved project retrieval after reload and ownership isolation were verified using uniquely identified automated fixtures that the existing tests clean up afterward. Existing user/project records were read and digest-verified without modification. No plaintext credentials or reusable session cookie for the pre-existing account were supplied, so an interactive login or authenticated HTTP retrieval under that specific existing account is **not claimed**. Its data is intact; fixture-based authentication regressions passed. No fake session or password reset was used to circumvent that limitation.

## 6. Files modified in B6.2

- `package.json`: two targeted overrides, retaining B6.1's YAML override.
- `pnpm-lock.yaml`: Fastify and Effect resolutions and corresponding dependency edges.
- `tests/dependency-security.test.ts`: adapter/direct Fastify security checks and Prisma configuration compatibility test.
- `docs/backend/phase-b6-2-dependency-audit.json`: post-remediation public audit metadata.
- `docs/backend/phase-b6-2-remediation.md`: this report.

The working tree already contained earlier phase changes; they were preserved. Ignored `.local` files contain verification logs and digest-only snapshots, not additional application changes. No frontend source or dependency manifest, database schema, backend auth implementation or active environment variable was changed in this phase.

## 7. Recommended B6.3 scope — not implemented

1. Prioritize approved, coordinated Zod 4 remediation across API and shared contracts. Include hostile collection/resource tests, ZodError mapping and API response compatibility, with explicit review of major-version behavior changes.
2. Find/test vendor-supported Prisma configuration dependency remediation for deepmerge-ts, preserving schema/client generation and configuration semantics. Do not force a major transitive override without approval.
3. Review the already documented account-aware protection policy, particularly victim lockout, Redis cardinality budget and shadow rollout. Do not infer approval to implement it from this recovery task.
4. Decide a documented per-service port convention and optional local service supervision so inherited PORT values and stopped dependencies do not recur. Preserve deployment-specific proxy, Redis ACL/memory/durability and upstream logging validation as operational gates.

**Phase C remains blocked.** Two high advisories, distributed account-attack protection gaps and deployment-specific validation remain unresolved. Stop after B6.2; B6.3 and Phase C require a new approved task.
