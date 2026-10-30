# Phase B6.1 — Security triage and safe remediation

Reviewed 2026-10-28. Scope: backend findings from Phase B5 only. This is source review and automated security regression verification, not a penetration test or production deployment certification.

## Assessment

Two confirmed application defects are fixed: request logs retained query values, and control characters in project identifiers reached Prisma and produced HTTP 500. A narrowly scoped Swagger YAML dependency patch resolves one moderate advisory. Ten advisories remain (7 high, 3 moderate); neither the advisory count nor an installed dependency alone establishes application exploitability. Account-aware authentication abuse protection remains a design proposal. **Phase C should remain blocked pending review and approval of the remaining remediation.**

No frontend, schema, database reset, authentication contract, hashing policy, cookie, session or existing rate-limit threshold changes were made. Existing fixture-independent data preservation checks matched the baseline: 1 user, 1 project, 6 configuration revisions.

## Dependency assessment

The original snapshot is `phase-b5-dependency-audit.json`; the post-change snapshot is `phase-b6-1-dependency-audit.json`. Ranges and fixed versions below follow the advisory metadata. All original eleven findings are listed, including the resolved finding.

Dependency paths and environments:

- **F**: direct `apps/api > fastify@5.11.3`, also `@nestjs/platform-fastify@11.2.8 > fastify@5.11.3`. Runtime in both production and development. Updating only the direct dependency can leave the adapter's actual server vulnerable or introduce two copies.
- **P**: transitive `packages/database > prisma@6.19.0 > @prisma/config > effect/deepmerge-ts`. Production audit also reports `apps/api > @prisma/client > prisma > @prisma/config`. These packages are in the production dependency graph, but the identified use is configuration/generation/migration tooling in development, CI and deployment; this does not establish request-time execution.
- **Z**: direct API and shared contracts dependency `zod@3.25.76`; production and development validation runtime.
- **Y**: transitive `apps/api > @nestjs/swagger@11.4.7 > js-yaml`, originally 5.3.0, now 5.4.1. Production and development documentation serialization.

| Package/version; severity; advisory | Path | Affected → fixed | Reachability assessment | Safest remediation and compatibility risk |
| --- | --- | --- | --- | --- |
| effect 3.18.4; High; [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) | P | `<3.20.0` → `>=3.20.0` | Effect fiber/RPC AsyncLocalStorage contamination; no NEXOS Effect RPC server identified. Tooling remains in scope. | Prefer a Prisma-supported release carrying the fix; otherwise separately test a scoped same-major override. Configuration compatibility must be demonstrated; deferred. |
| deepmerge-ts 7.1.5; High; [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | P | `<8.0.0` → `>=8.0.0` | Recursive object graph merging can exhaust stack. API JSON cannot encode cycles and no public merge entry point was found. | Vendor-compatible Prisma update preferred. Major deepmerge override may change configuration semantics; deferred for approval. |
| fastify 5.11.3; Moderate; [GHSA-w2qp-rph6-63g4](https://github.com/advisories/GHSA-w2qp-rph6-63g4) | F | `<5.12.1` → `>=5.12.1` | Root primitive schema coercion bypass. Controllers parse Zod objects; affected Fastify root schemas were not found. | Coordinate adapter and direct Fastify patch to at least 5.12.5; test request validation and plugin compatibility. Deferred, not a direct-only bump. |
| fastify 5.11.3; Moderate; [GHSA-3m5p-2c4r-xxw2](https://github.com/advisories/GHSA-3m5p-2c4r-xxw2) | F | `>=5.8.3 <5.12.1` → `>=5.12.1` | Hop-count proxy trust spoofing. B3 accepts exact trusted IPs, rejects numeric hop counts. | Same coordinated patch; current configuration avoids the identified precondition. Deployment proxy validation remains required. |
| js-yaml 5.3.0 → 5.4.1; Moderate; [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) | Y | `>=5.0.0 <=5.4.0` → `>=5.4.1` | Empty YAML merges can evade merge limits and consume CPU. Swagger dumps generated documents; no public untrusted YAML loader was found. | **Applied** exact-parent override to 5.4.1. Same-major patch; generated YAML/JSON equality and tiny merge-limit regression passed. Low demonstrated compatibility risk. Remove override when vendor incorporates the fix. |
| fastify 5.11.3; Moderate; [GHSA-4mh8-r7rc-xpvc](https://github.com/advisories/GHSA-4mh8-r7rc-xpvc) | F | `<5.12.5` → `>=5.12.5` | HTTP/2 trailer response exception; this API does not enable HTTP/2. | Same coordinated patch. Do not enable HTTP/2 before remediation and regression coverage. |
| fastify 5.11.3; High; [GHSA-667r-xxjv-c9mm](https://github.com/advisories/GHSA-667r-xxjv-c9mm) | F | `<5.12.2` → `>=5.12.2` | Async schema result collision can replace request body. No `$async` request schema was identified. | Same coordinated patch, with validation and error regression tests. |
| fastify 5.11.3; High; [GHSA-p68q-wchp-6fh7](https://github.com/fastify/fastify/security/advisories/GHSA-p68q-wchp-6fh7) | F | `>=4.0.0 <5.12.2` → `>=5.12.2` | Malformed URL can reach encapsulated private not-found handlers without authentication. No private fallback serving protected data exists here. Malformed URI probes return controlled errors. | Same coordinated patch; regression tests must include encoded URLs and fallback dispatch, not merely successful login. |
| fastify 5.11.3; High; [GHSA-hwr6-493r-vm6h](https://github.com/advisories/GHSA-hwr6-493r-vm6h) | F | `<5.12.2` → `>=5.12.2` | Boolean false request schemas skipped. No such schemas were found; explicit Zod parsing remains active. | Same coordinated patch and negative validation tests. |
| fastify 5.11.3; High; [GHSA-9q9j-q6p8-xq58](https://github.com/advisories/GHSA-9q9j-q6p8-xq58) | F | `<5.12.2` → `>=5.12.2` | Header schema dependencies mishandle case. No affected header dependency schemas found; Origin and authorization checks are explicit. | Same coordinated patch, preserving proxy and Origin tests. |
| zod 3.25.76; High; [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Z | `<4.6.6` → `>=4.6.6` | Oversized constrained collections can exhaust memory. Public input reaches Zod. The API's 32 KiB body limit and bounded application collections mitigate exposure but do not prove absence of resource exhaustion. | Coordinated Zod 4 migration requires approval. Test contracts, inference, issue shapes and error mapping. API-only upgrade risks ZodError identity mismatch with shared contracts and incorrect 500 responses. High compatibility risk. |

Only Y was patched. The [5.4.1 release](https://github.com/nodeca/js-yaml/releases/tag/5.4.1) documents the merge-limit fix. No forced audit fixes, blanket upgrades or major migrations were performed. The exact-parent override must be reviewed when Swagger changes. Absence of a currently identified trigger is a reachability assessment, not a guarantee against future routes or configuration changes.

## Confirmed application fixes

### Request logging

The Fastify/Pino request serializer previously retained the raw URL including its query string. It now records only the path before `?` or `#`, together with method, host, client address and port. Existing cookie/authorization redaction, request IDs, response status and response timing remain. No query parameter names or values are retained by this serializer, including repeated and encoded names.

Actual subprocess logs were captured for successful, unmatched, malformed-URI and invalid-JSON requests. Unique query markers did not appear. Existing tests also check credentials, stored hashes and session tokens are absent. This does not sanitize arbitrary path segments, upstream reverse-proxy logs or future custom logging calls; operators must apply equivalent policies there.

### Project identifiers

Authentication still runs first. The shared project ownership lookup then rejects empty identifiers and ASCII controls U+0000–U+001F/U+007F with HTTP 400 and `Invalid project identifier`, before Prisma. All project operations using that lookup receive the protection. Valid foreign project IDs remain 404; unauthenticated requests remain 401. Opaque legacy identifiers remain accepted; no new CUID/UUID requirement or schema change was introduced.

NUL and other control-character cases now produce controlled 400 responses across read, patch, revisions, validation and build endpoints. Invalid UTF-8 remains a router-level client error. Arbitrary nonexistent identifiers remain 404. The previous NUL-triggered database error was reproducible, not a hypothetical finding.

## Account-aware protection — proposal only

Existing protection remains 60 requests per rolling 60 seconds per normalized IP, with a 60-second block, atomically enforced in Redis. Trusted-proxy extraction and IPv6 /64 normalization remain unchanged. This bounds a single network but cannot prevent distributed attacks against one account. Lowering the IP threshold would increase shared-NAT false positives; it does not solve distributed credential stuffing. No new limiter, secret or environment setting is active in this phase.

Proposed policy for approval and measurement:

1. Keep the existing IP policy. After existing HTTPS/Origin and syntactic login validation, reserve account admission before database lookup or password hashing. Count every syntactically valid login, including correct passwords and unknown accounts; failed-only counters updated after hashing have concurrency gaps.
2. Candidate aggregate account token bucket: burst 5, refill one token per 60 seconds, inactivity TTL 15 minutes. Candidate account/network pair bucket: burst 3, same refill, TTL 5 minutes. These are proposed laboratory thresholds, not production defaults or measured capacity. Do not refund/reset on success, which could erase concurrent failures. Generic 429 and Retry-After use the maximum token deficit, normally at most 60 seconds; denied requests must not extend expiry.
3. Use exactly the existing login email normalization (lowercase), without new trimming, provider dot/plus rules or Unicode transformations. Login currently uses email, not username. Do not mix registration username/email buckets into login protection: that could let signup traffic lock existing accounts. A registration-specific policy needs separate approval.
4. Derive keys using HMAC-SHA256 over purpose/version plus normalized email with a shared 256-bit server secret. Proposed name `AUTH_ACCOUNT_HMAC_KEY` is documentation only. Pair keys additionally include the current normalized network. Never put raw email, passwords, session tokens or the HMAC secret in Redis or logs. Identical handling for known and unknown accounts avoids an existence lookup oracle; activity/history inference is still possible.
5. Use a single Lua operation with Redis TIME and integer token accounting to check and reserve both account buckets atomically. Existing IP admission can remain a preceding independent atomic check; no refunds are necessary. Both account decisions must succeed before mutation/admission. Current deployment is standalone Redis. Future Redis Cluster requires an intentional shared hash slot for the transaction, with hotspot implications, rather than assuming cross-slot scripts work.
6. TTLs bound retention and each bucket is constant-size, but TTL alone does not bound total memory. Design a hard namespace cardinality budget with atomic admission indexing and bounded expired-index pruning. A 10,000-active-account budget is a proposed lab starting point only; measure actual memory before selecting production values. Create pair state only on admission, never refresh/create it on denial. Aggregate burst/refill plus five-minute pair expiry bounds admitted pair fan-out (conservatively about 11 active pairs per account). Reject new identities with controlled 503 if capacity is exhausted, while processing existing identities. Do not evict arbitrary active protection keys. Attackers can still fill this budget and deny new identities; edge controls and monitoring remain necessary.
7. Redis errors fail closed with controlled 503; no process-local fallback. Readiness must cover script/ACL access. The design does not promise continuity after Redis data loss without durable/HA operational guarantees.

Trade-offs requiring explicit approval: aggregate limiting resists multi-IP attacks but enables targeted victim login starvation, even if each Retry-After is bounded. Attackers can continuously consume replenished tokens. Shared IP limits still affect NAT users; account buckets add independence between different accounts but do not remove that existing trade-off. A softer account signal reduces lockout risk but provides weaker resource protection. No CAPTCHA, MFA or account recovery redesign is included.

Migration: approve policy, benchmark memory/KDF capacity, introduce privacy-safe aggregate shadow metrics (no email/digest metric labels), evaluate false positives, then explicitly enable enforcement consistently across replicas. HMAC rotation needs an overlapping conservative policy or a coordinated TTL drain; do not silently reset all account budgets. Existing sessions remain untouched. Required future tests include multi-instance/multi-IP account races, casing equivalence, known/unknown consistency, shared NAT, refill boundaries, denied-request TTLs, cardinality exhaustion, outage/recovery and secret rotation. These proposed-policy tests have not been run because the policy is not implemented.

## Verification actually executed

| Command/check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | 22 unit tests passed |
| `pnpm test:integration` | 10 integration tests passed; real PostgreSQL and Redis |
| `pnpm test:e2e` | 6 Playwright tests passed against production application servers |
| `pnpm build` | Passed, 7 workspace tasks |
| `pnpm audit --json` | Exit 1: 7 high, 3 moderate, 0 critical |
| `pnpm audit --prod --json` | Exit 1: same remaining counts |
| `git diff --check` | Passed |
| Existing-data preservation digest | Unchanged: 1 user, 1 project, 6 revisions |

Integration coverage includes logging markers on error and success paths, authentication-first invalid-ID rejection, cross-user isolation, registration rollback/concurrency, login/session regression, production cookies/proxy spoofing, and distributed Redis outage/recovery checks from B1–B5. The new YAML test uses a tiny bounded payload and verifies empty merges respect the configured merge limit. Generated Swagger YAML parses identically to JSON. Tests create and clean their own uniquely identified fixtures; no reset or truncation was used. Audits remain failing and must not be described as clean.

## Exact Phase B6.1 files

- `apps/api/src/main.ts`: safe request URL serializer.
- `apps/api/src/app.ts`: control-character project identifier rejection after authentication.
- `package.json`: exact-parent Swagger YAML override.
- `pnpm-lock.yaml`: resolved dependency patch (the working tree also contains earlier phase changes).
- `tests/api.integration.ts`: log, identifier and Swagger compatibility regressions.
- `tests/dependency-security.test.ts`: resolved version and merge-limit regression.
- `docs/backend/phase-b6-1-dependency-audit.json`: post-patch audit metadata.
- `docs/backend/phase-b6-1-remediation.md`: this report.

Other existing dirty files belong to earlier phases and were preserved. No active environment variable or database schema change was required.

## Remaining findings and recommended B6.2

1. **High priority:** approve and test coordinated Nest adapter/Fastify remediation to a compatible version incorporating all fixes (Fastify at least 5.12.5). Verify both direct and adapter-resolved copies, negative validation paths and fallback dispatch before applying it.
2. **High priority:** approve coordinated Zod migration or a vendor-supported backport. Preserve shared contracts and controlled errors; resource-test bounded hostile collections. Do not upgrade only the API copy.
3. **High security objective, policy approval needed:** refine and shadow-test the account-aware design, including explicit victim-lockout and cardinality-budget decisions. IP-only protection is insufficient against distributed targeted attacks.
4. **Tooling exposure:** obtain a compatible Prisma configuration dependency update for Effect and deepmerge-ts; verify generation/configuration/migration status without destructive migrations. Avoid unsupported major transitive overrides.
5. Validate real deployment HTTPS termination, trusted-proxy allowlists/header sanitation, Redis ACL/network/persistence/memory settings and upstream log policy. Automated local tests do not establish these production properties. Remove the YAML override when the supported Swagger release resolves it naturally.

Phase B6.1 stops here. Remaining advisories, account-aware policy and deployment assumptions require review before security clearance or Phase C approval.

Final local startup note: a subsequent attempt to restore `pnpm dev:api` failed closed with `Authentication Redis startup check failed`. The frontend at port 3000 was also unavailable at that check. The development watcher was stopped. Earlier completed test results above are retained; they do not establish current dependency availability. Restore the configured Redis service before starting the API, then verify `/api/v1/ready`. No authentication fallback was enabled.
