# NEXOS — Final Security Gate Before Phase C

Reviewed **2026-10-29**, Asia/Dushanbe. Evidence: current source, Phase A–B6.6 reports, fresh automated checks, real local PostgreSQL/Redis, isolated synthetic accounts, and read-only infrastructure observations. This is a local engineering security gate, not a penetration test or production certification.

## 1. Executive summary and decisions

| Gate | Decision | Meaning |
| --- | --- | --- |
| **Phase C: API Contracts** | **GO** | Existing security controls pass the local regression suite. Proceed only with contract inventory, validation/error boundaries, schemas, documentation and compatibility tests for existing functionality. The open findings below remain tracked. |
| **Public production deployment** | **NO-GO** | Actual TLS/proxy/certificate, Redis capacity/ACL, backup/restore, abuse-load, monitoring and recovery evidence is missing. Local development settings are not a production security profile. No public-release risk waiver is granted. |

**Phase C has not been started.** This gate recommendation does not authorize a public deployment or implement the next phase.

Both dependency audits freshly report **zero advisories**. The complete available scripts pass: **34 unit tests, 13 integration tests, 6 E2E tests, TypeScript, lint and production build**. The new adversarial integration case was additionally rerun after adding its error-log assertions and passed. All **28 PostgreSQL model count/digests remain unchanged** after fixture cleanup. The HMAC/environment file remains byte-for-byte unchanged, ignored/untracked and mode 0600. Local API health/readiness, frontend availability and readiness through the Next proxy return 200.

Zero advisories do not establish complete application security. Review confirmed **three additional non-project input boundaries returning generic 500 for NUL input**. They do not disclose database details, bypass authentication or mutate sessions in the tested cases, but must be normalized to controlled client errors during approved contract work. Enumeration, retention, worker configuration and operational risks also remain open.

No production code, dependency, database schema or secret was changed by this gate. Only test coverage and these report/audit artifacts were added.

## 2. Security history and original finding disposition

Reviewed: `phase-a-audit.md`, `password-hashing.md` (B1), `atomic-registration.md` (B2), `https-proxy.md` (B3), `distributed-rate-limiting.md` (B4), B5 verification/audit, all B6.1–B6.6 reports and their advisory/compatibility snapshots. Historical findings below are reconciled against current source and fresh results, rather than treating an old report's deferral as a current fix.

“Accepted for Phase C only” means this gate permits restricted development with a documented limitation. It is **not** an invented product-owner acceptance or a production waiver. Every finding not fixed remains explicitly open.

### Phase A findings

| Original finding | Final status and evidence |
| --- | --- |
| **H1 — weak implicit scrypt policy/unversioned hashes** | **Fixed/verified by B1.** Explicit v1 N=32768,r=8,p=3, fresh salts, strict format/cost allowlist and timing-safe digest comparison. Current/legacy, malformed records and compare-and-swap races pass. Dormant legacy records retain old costs until successful login; timing/resource limitations remain below. |
| **H2 — unsafe production-mode/HTTPS configuration** | **Code fixed/verified by B3; deployment remains open.** Production requires explicit HTTPS origin and exact trusted proxy IPs; authenticated operations enforce trusted HTTPS; secure cookie creation/deletion passes. Actual deployed TLS/certificates/ingress are not verified. |
| **H3 — process-local auth limits/proxy ambiguity** | **Distributed/proxy defects fixed by B3/B4/B6.3.** Shared IP and account admission tested against real Redis. Scrypt capacity, global high-cardinality IP traffic, shared-IP fairness and production topology remain open; do not mark all abuse resilience complete. |
| **H4 — partial account registration** | **Fixed/verified by B2.** User, prior-token rotation, initial session and audit are one transaction; cookie emitted after commit. Real rollback/fault and duplicate-race coverage passes. Lost COMMIT acknowledgments are not tested. |
| **M1 — sparse OpenAPI contracts/security declarations** | **Unresolved; primary Phase C scope.** Fresh Swagger JSON has zero component schemas and a cookie scheme, but limited request/response/per-operation security detail. API.md supplements it but does not close drift risk. |
| **M2 — project/revision list truncation without pagination metadata** | **Unresolved.** Latest 100 projects/50 revisions limits remain. Data is not deleted. Review a backward-compatible pagination/truncation contract during Phase C. |
| **M3 — JSON catalog references/storage revision bounds** | **Unresolved.** API selection checks and deprecated-reference preservation exist, but privileged out-of-band catalog changes can orphan JSON references. Revision input intentionally preserves prior integer acceptance rather than declaring a PostgreSQL Int bound. Schema/normalization changes require separate approval. |
| **M4 — foundation worker Redis URL parsing** | **Unresolved.** Worker still omits database index and does not strictly validate protocol/decode URL credential fields. It has a rediss TLS branch, but the API's B4 parser is not shared by the worker. Do not activate non-probe jobs based on API verification. |
| **M5 — session/audit retention** | **Unresolved.** Expired sessions are rejected, but no scheduled cleanup or session-volume/audit-retention policy exists. No active sessions or audit data were removed as a shortcut. |
| **L1 — PostgreSQL URL without database pathname** | **Fixed/verified in A.** Sanitized validator rejects missing database path; infrastructure tests pass. |
| **L2 — error events lacked request correlation** | **Fixed/verified in A.** Generic client errors and server events retain request IDs, without raw exception message/body/URL credentials. |
| **Concentrated app.ts architecture** | **Deferred maintainability finding.** Accepted for restricted contract development at current size; no rewrite/extraction is necessary for this gate. |
| **Optional storage/search local defaults** | **Open deployment limitation.** Optional loopback scaffolding is not a reviewed shared production service. No artifact/storage/publication feature was activated. |

### B5/B6 application and operational findings

| Finding | Final disposition |
| --- | --- |
| **B5 M1: no account dimension** | **Account layer implemented/verified in B6.3.** Lowercase HMAC identity, atomic pre-KDF admissions and bounded state work. Five-second recovery windows intentionally permit some attack traffic; capacity/abuse risks are not closed. |
| **B5 M2: raw query-string logs** | **Fixed/verified B6.1.** Request serializer removes query/fragment portions. Actual captured success, missing-route, parser/URI-error logs omit markers and supported auth secrets. Raw path segments, upstream collectors and worker logs are separate concerns. |
| **B5 M3: global Redis growth/eviction risk** | **Partially mitigated, still open.** Account index caps normal active identities at 10,000; individual states expire. IP keys have bounded per-key size/TTL but no fleet-wide cardinality cap. Local Redis still has no memory ceiling. |
| **B5 M4: enumeration differences** | **Unresolved/explicitly limited.** Generic login errors and current-policy dummy hashing reduce basic enumeration. Registration 409 and legacy/current/malformed hash cost differences remain; no statistical timing-resistance claim. |
| **B5 M5: session/audit storage growth** | Same open retention finding as A M5; account admission is not a retention mechanism. |
| **B5 L1: NUL project identifier 500** | **Fixed/verified B6.1 for project routes.** Control characters return 400 after authentication; foreign valid IDs still return 404. This does not cover every identifier in the application. |
| **B5 L2: OpenAPI detail** | Open, same as A M1; Phase C addresses it. |
| **B6.2: stopped Redis/PostgreSQL/web/API and PORT collision** | **Recovered/verified.** Existing storage/services reused. Explicit API PORT=4000/web PORT=3000 avoids inherited root PORT ambiguity. Automatic service supervision remains an operator requirement. |
| **B6.3 trade-offs: recovery windows, capacity, fail-closed availability** | **Accepted only for restricted Phase C development.** Recovery avoids indefinite token starvation; admits botnet work during windows. New identities can receive 503 at capacity. Redis faults fail auth closed. Production load/fairness acceptance remains required. |
| **B6.4–B6.6 compatibility risks** | **Addressed for current consumers.** Prisma Map patch and Zod message/normalization compatibility tests pass; future owner upgrades require review. Oversized-array issue reduction is intentional and tested. |

### Every original dependency advisory

| Advisory | Verified resolution |
| --- | --- |
| GHSA-38f7-945m-qr2g — Effect context contamination | Effect **3.20.0**, exact Prisma-config owner scope; config tests pass. |
| GHSA-ggr8-5vv4-36mx — recursive deepmerge stack exhaustion | deepmerge-ts **8.0.2**, exact Prisma-config owner override plus loader compatibility patch; actual loader, cycles/prototype/Map tests pass. |
| GHSA-mrhx-c7xc-m3w5 — Zod collection resource amplification | Zod **4.6.6**, API/contracts/tooling; 98-case corpus and bounded collection tests pass. |
| GHSA-w2qp-rph6-63g4 — primitive schema coercion | Fastify **5.12.6** in both direct and Nest-adapter paths. |
| GHSA-3m5p-2c4r-xxw2 — hop-count proxy spoofing | Fastify **5.12.6**, plus exact-IP B3 trust policy and spoof tests. |
| GHSA-4mh8-r7rc-xpvc — HTTP/2 trailer exception | Fastify **5.12.6**; API still does not enable HTTP/2. |
| GHSA-667r-xxjv-c9mm — async validation collision | Fastify **5.12.6**. |
| GHSA-p68q-wchp-6fh7 — malformed URL/fallback auth | Fastify **5.12.6**, no private fallback serving data; malformed URI regressions pass. |
| GHSA-hwr6-493r-vm6h — false schema bypass | Fastify **5.12.6**, direct negative-schema regression passes. |
| GHSA-9q9j-q6p8-xq58 — header schema normalization | Fastify **5.12.6**. |
| GHSA-r3ph-w7gj-g6xm — empty YAML merge resource use | Swagger's js-yaml **5.4.1**; merge-limit and OpenAPI YAML/JSON tests pass. |
| Additional B6.2 GHSA-389g-gv7q-r4x8 — header propertyNames normalization | Fastify **5.12.6**; header deny-list regression passes. |

## 3. Verified security properties and limits

| Property | Evidence from current code and executed tests | What is not established |
| --- | --- | --- |
| Password storage | Versioned explicit scrypt, 16-byte random salt, 64-byte digest, strict hexadecimal/cost parser and timingSafeEqual. N=32768,r=8,p=3 matches an [OWASP scrypt profile](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). | No production capacity benchmark or offline cracking assessment; old hashes remain until upgraded. |
| Legacy upgrades | Wrong passwords do not rewrite; successful legacy login upgrades with fresh salt; database compare-and-swap preserves newer passwords; malformed policies fail closed. | No new password-reset/change API, global invalidation design or forced migration of dormant accounts. |
| Registration | One PostgreSQL transaction covers user/session/audit and old presented-token removal; cookie after commit; unique constraints handle races. | No actual crash during COMMIT/ambiguous acknowledgment test. HTTP delivery is not part of the DB transaction. |
| Sessions | Random opaque 32-byte tokens, SHA-256 digests at rest, absolute expiry, presented-token rotation, logout and owner-scoped revocation; only public user fields returned. Tampered/extended/truncated/random/large cookies and Bearer substitution are rejected. | Existing human-account credentials were not used. No session-volume/retention policy or proof of production browser cookie delivery. |
| Cookies/CSRF/CORS | Local HTTP behavior and production Secure/HttpOnly/Lax/Path=/host-only creation/clearing pass. Missing/null/suffix/combined Origin and JSON-prefix invalid media type fail without deleting the fixture session. | No real deployed TLS/hostname/SameSite browser test. CORS is not a substitute for auth or server-side Origin checks. |
| HTTPS/proxy | Production mode/origin/proxy validation; insecure/untrusted forwarded requests fail; exact trusted peers work; forwarding chains stop at untrusted hops; spoofed role/owner headers do not authorize. | Actual reverse proxies must overwrite incoming forwarding headers and restrict direct API access. |
| IP rate limiting | Atomic Redis TIME Lua; 60/60s/action/network, bounded 60s block; /64 and mapped IPv4 equivalence, two clients/processes, Retry-After, expiry and non-extension tested. | No global distinct-IP memory bound, edge attack capacity, Redis failover durability or Cluster support. |
| Account protection | Purpose-separated HMAC-SHA256 over existing normalized email; five-credit burst/one-per-minute refill, fixed cooldown/recovery, 15-minute state TTL and 10,000 normal index cap; two APIs and many trusted networks share enforcement. | Not a strict five-per-minute ceiling: recovery admits traffic. Capacity/ACL failures and partial script errors have documented availability/index caveats. Real deployed replica key consistency is not verified. |
| Redis outage | Real Redis TCP fault proxy makes both auth endpoints/readiness return controlled 503; no local fallback; liveness/public reads/logout remain available in a running process; recovery retains counters. | The Redis server itself was not crashed/flushed. No replication-loss, disk-loss, production ACL/TLS or memory-pressure fault test. |
| Enumeration | Known/unknown generic 401/429 behavior matches equal attempt histories; unknown accounts pay dummy current KDF cost; no account existence lookup before account admission. | Registration uniqueness is observable; legacy/malformed costs and budget history can reveal state. No statistical timing attack was performed. |
| Authorization | Owner checks on all project operations, session ownership, admin role gate, unknown/SQL-like/control IDs and actual persistence/concurrent revision behavior pass. | Not an exhaustive IDOR or privilege-escalation penetration test. |
| Input/error compatibility | Zod 4 corpus, real HTTP 400 envelopes, unknown properties, coercion/defaults, nested arrays/refinements and bounded oversized input pass. Unexpected errors omit SQL/credentials and preserve correlation. | Three additional identifier boundaries remain 500, below. Browser local-file JSON.parse remains independently unbounded. |
| Logging/secrets | Actual API subprocess captures and new error-event captures omit synthetic auth secrets; current environment credentials/HMAC absent from scanned source/log/client assets; .env ignored/untracked/0600 and byte-identical. | No complete Git history, external log collector, host/process inspection or worker-log secrecy certification. |

## 4. New adversarial coverage and exact residual behavior

Added one test in `tests/api.integration.ts`, using a fresh generated account and isolated Redis namespace. It verifies malformed session cookies, cookie-only auth, Origin variants, unsupported JSON-prefix content type, forged role/owner headers, continued session validity after invalid requests, idempotent missing-session revocation and actual logout/rejection afterward. Error-event assertions accept only event/requestId/error-class metadata and check fixture secrets are absent. No real human credentials were used.

The following were reproduced through the real compiled Nest/Fastify/Prisma path:

| Input boundary | Current result | Security consequence / disposition |
| --- | --- | --- |
| DELETE `/api/v1/auth/sessions/%00` with a valid synthetic session | Generic **500**, request ID; fixture session count unchanged | Low robustness gap; auth still required, no deletion/bypass observed. Add reviewed path validation after auth. |
| GET `/api/v1/legacy/catalog-projects/%00` | Generic **500**, request ID | Low robustness gap in public lookup; no raw DB message/data disclosure. Add explicit slug validation. |
| GET `/api/v1/devices?manufacturerId=%00` | Generic **500**, request ID | Low query-boundary gap; add NUL validation before PostgreSQL. |

These currently expected 500 responses are captured as residual findings, not endorsed as a desirable contract. Tests must be updated when an approved fix changes them to controlled 400 responses. No database query text, Prisma detail, token, HMAC or email appears in their client response; logged events expose only sanitized class/request metadata. A valid session remains usable afterward. No production fix was essential to determine this gate, so application behavior was preserved.

## 5. Exact fresh regression and audit results

| Command/check | Result |
| --- | --- |
| `pnpm typecheck` | **PASS**; fresh root test typecheck plus seven cached workspace tasks |
| `pnpm lint` | **PASS**; seven workspace tasks using existing web ESLint/backend TypeScript conventions |
| `pnpm test` | **34 passed, 0 failed** |
| `pnpm test:integration` | **13 passed, 0 failed**; real PostgreSQL and Redis |
| Focused `--test-name-pattern='final gate rejects'` rerun | **1 passed, 0 failed**, after adding final log assertions to that same new case |
| `pnpm test:e2e` | **6 passed**; Chromium with production API/web servers |
| `pnpm build` | **PASS**; seven tasks, six cached; no claim of a clean-cache rebuild |
| `pnpm audit --json` | **Exit 0; 0 critical/high/moderate/low/info findings** |
| `pnpm audit --prod --json` | **Exit 0; same zero totals** |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` | **PASS**; no dependency update/lifecycle install forced |
| `pnpm db:status` | Three migrations applied, up to date; **no migration run** |
| 28-model count/digest comparison | **Unchanged**, after all fixture cleanup |
| HMAC/environment/source/log/client checks | Existing file unchanged/ignored/untracked/0600; **0 known-secret matches** in inspected outputs |
| Local API health, direct ready, proxied ready and web root | **HTTP 200** after restoring services |
| `git diff --check` | **PASS** |

The complete suite was executed, not inferred from prior reports. Cached task reuse is disclosed. No backup restore, real TLS handshake or production traffic test was performed.

Fresh audit metadata, exact version inventory, test totals, residual statuses and SHA-256 fingerprints of relevant non-secret code/config inputs are in `final-security-gate-audit.json`. The repository contains earlier uncommitted work; this gate applies to the reviewed working tree/fingerprints, not an assertion that HEAD alone represents an approved release image.

## 6. Dependency and compatibility review

Active resolved versions: **Zod 4.6.6**, **Fastify 5.12.6**, **deepmerge-ts 8.0.2**, **Effect 3.20.0**. Swagger uses **js-yaml 5.4.1**; ESLint also uses **4.3.2**. Those intentional YAML major-version paths are not duplicate vulnerable versions under the reviewed advisories; both audits are zero. Orphan package caches/old report strings are not active dependency resolutions.

Overrides were reviewed individually:

- Fastify selector targets old 5.11.3 edges; direct API and Nest adapter resolve the same fixed module and plugin/runtime regressions pass.
- Swagger YAML override is exact-parent scoped; generated JSON/YAML and merge-limit regressions pass.
- Effect override is exact Prisma-config owner/same-major; configuration behavior passes.
- Deepmerge override and reproducible pnpm patch are exact Prisma-config owner scoped. The supported Map customization preserves legacy shallow entries; recursive/prototype/cycle handling remains in the fixed vendor library. No unsafe fast merge entry point is used.
- Zod direct pins and exact react-hooks-owner override cover every identified consumer. Shared error-class identity and real lint paths use patched v4, not the bundled v3 compatibility entry point.

No insecure override or conflicting vulnerable active copy was identified in this reviewed graph. This is not a statement about OS/container images, undisclosed advisories or every vendored byte. Rebase/remove exact-version overrides/patches on owner updates; ship manifest, lockfile and patch together and rerun compatibility tests. No dependency was upgraded in this gate.

## 7. Unresolved risks ranked for decision-making

**Critical:** none confirmed in the reviewed flows. Absence of a finding is not proof of absence.

| Severity | Open risk | Required disposition |
| --- | --- | --- |
| **High — production evidence** | Actual HTTPS termination/certificate verification, proxy sanitation/private ingress, PostgreSQL/Redis network policy and operational recovery are unverified. The local services use development settings. | **Blocks public deployment.** Obtain deployment-specific evidence; not a reason to block restricted API-contract development. |
| **High — public abuse/capacity** | KDF/admission queue capacity is unmeasured; recovery windows permit botnet work; IP cardinality has no global bound; normal account capacity can be exhausted; Redis maxmemory=0 locally. | Edge controls, measured memory/concurrency/latency, non-evicting capacity/OOM behavior and abuse alerts before public rollout. No load certification or complete credential-stuffing resistance claimed. |
| **Medium** | Registration 409, hash-cost timing differences and account-budget history enumeration. | Explicit product/security policy before public exposure; preserve current v1 behavior until approved. Existing generic login defenses are partial mitigation. |
| **Medium** | No session quota/expiry cleanup/audit retention policy. | Design bounded cleanup and monitoring while preserving active sessions/audit obligations; no data deletion in this review. |
| **Medium** | Worker DB-index/protocol/credential handling and raw error.message logging have not received API-equivalent hardening. | Keep non-probe jobs disabled; review worker config/logs before activation. No actual worker secret leak is asserted without evidence. |
| **Medium** | Sparse OpenAPI/security schemas, list truncation, JSON-reference/storage-bound mismatch and concentrated app.ts. | Phase C contract work with compatibility tests; normalized DB references or module refactors require separate justification/approval. |
| **Low** | Three NUL boundaries above return sanitized 500 rather than client errors. | First validation-boundary follow-up in approved Phase C scope; preserve auth-first behavior and opaque legacy identifiers. |
| **Low/operational** | Browser file import reads full JSON before schema checks; local PORT inheritance/manual process supervision; optional storage/search development defaults. | Document deployment/user-file limits and explicit service configuration; do not promote scaffold defaults to production. |

The GO decision accepts these **only within the restricted Phase C development scope**. Unresolved findings are not closed by a passing audit and have not been waived for production.

## 8. Local observations versus deployment-only requirements

Read-only local observation: PostgreSQL and Redis listen on loopback (5433/6379). API/web dev listeners bind all interfaces (4000/3000); no statement about external firewall/internet reachability is inferred. The local database role is not superuser/createdb/createrole/replication, but full least-privilege grants were not certified. Its current connection has no TLS. Redis has AOF enabled, noeviction, maxmemory=0, protected-mode=no, no TLS port and no client credentials configured. Loopback publication is a local development boundary, **not** a reviewed production profile. No setting was silently changed.

| Production requirement | Evidence still required before a separate production GO |
| --- | --- |
| HTTPS termination/certificates | Actual hostnames, trusted certificate chain/SAN, renewal/expiry alerts, failed untrusted/expired-cert tests, HTTPS-only routing/HSTS policy and deployed browser cookie behavior. No real certificate handshake was tested here. |
| Proxy trust | Document real edge→Next/API path; exact trusted peers; overwrite client forwarding headers; private upstream ingress. Test spoofing end to end, not just Fastify injection. |
| PostgreSQL transport/roles | Private access, separate migration/application privileges as appropriate, protected credentials and certificate validation on network connections. For this Prisma 6 connector, review sslmode=require, sslaccept=strict and CA/hostname behavior; do not assume libpq flags are interchangeable. See [Prisma v6 connector TLS settings](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql). |
| Backups/recovery | Encrypted retained backups, access controls, stated RPO/RTO and a successful isolated restore rehearsal. Transaction rollback/digest checks do not establish recovery capability. See [PostgreSQL backup/restore](https://www.postgresql.org/docs/current/backup.html). |
| Redis isolation/TLS/ACL | Private network and credentials, appropriate rediss/CA verification, minimum command/key permissions for both real and probe scripts, no administrative commands exposed to app users. Test bad certificates/ACL failures and actual auth paths; probe-key permission alone cannot certify every data-key pattern. See [Redis security](https://redis.io/docs/latest/management/security/). |
| Redis budget/durability | Measured maxmemory with noeviction/headroom for shared workloads; monitor key count, latency, eviction/OOM/reconnects; test failover/persistence-loss consequences. [Redis eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/) explains memory-limit/policy behavior. |
| Replica identity | Same secret reference/version, Redis endpoint/database, RATE_LIMIT_NAMESPACE and policy across all replicas; drain old-only limiter instances. Verify through secure deployment metadata, not secret dumps. Cluster/Sentinel support is not certified. |
| Secret management | Service access controls, protected injection/logging/backups, audited secret-manager access and reviewed rotation/incident runbooks. Preserve HMAC identity across ordinary restarts; online dual-key rotation is not implemented. No secret was rotated here. |
| Health/readiness | Deploy actual liveness and DB/Redis readiness checks; test routing/removal behavior and recovery. Removing all unready instances can also remove public-read availability. |
| Migration/rollback | Run reviewed Prisma migrate deploy against a backed-up target; test schema changes in an isolated copy. Use expand/contract or reviewed forward repair/restore; no destructive reset/down script. Rollback binaries must still read B1 v1 hashes and compatible stored configuration. |
| Monitoring/response | Alerts/runbooks for 401/409/429/503, unusual 500s, rehash failures, transaction errors, queue/DB pools, scrypt latency, Redis capacity and certificate expiry. Restrict/retain logs; review upstream query/header redaction and worker error handling. |
| Release artifact | Reviewed immutable code/lock/patch/runtime inventory, CI evidence and environment/base-image review. This local working-tree gate is not an image/OS vulnerability assessment. |

No production infrastructure was supplied or invented, no live production credentials were used, and none of the deployment-only rows is represented as completed.

## 9. Recommended Phase C scope and implementation order

This is a recommendation only; no Phase C implementation began.

1. Freeze the existing `/api/v1` inventory: actual POST 201 semantics, user/items/direct-project envelopes, string-versus-array errors, owner/admin boundaries, cookie requirements, CORS/Origin policy and 429/503 Retry-After behavior. Do not globally wrap/rename responses.
2. Define shared path/query validation and error contracts for existing routes. Prioritize the three observed NUL gaps; preserve authentication-first checks, foreign-object 404 and valid opaque legacy IDs. Propose explicit revision-storage bounds with compatibility impact documented.
3. Define request/response/wire-format schemas for auth, sessions, devices, Android bases, projects/configurations/revisions and compatibility results. Preserve schemaVersion-1 defaults, deprecated references, UNKNOWN support status and secret-free projections. No speculative user directory, build producer or new product endpoint.
4. Generate/document OpenAPI request/response/error/security/parameter/header examples from the same contracts. Add drift tests against real responses and the existing validation corpus rather than creating an independent competing validation system.
5. Review pagination/truncation and tie-breaker contracts for the existing project/revision lists. Introduce optional/backward-compatible behavior only with explicit review; no schema change is implied by this gate.
6. Rerun ownership, auth/session, rate-limit, malformed-input, compatibility and secret/data-preservation tests as contract work lands. Keep workers/compilation/artifact publication out of this phase. Conduct a separate production gate after resolving/accepting the release blockers with real deployment evidence.

## 10. Files changed and stopping point

- `tests/api.integration.ts`: one additional adversarial security/remaining-error confidentiality regression; no production behavior changed.
- `docs/backend/final-security-gate.md`: this report and GO/NO-GO decisions.
- `docs/backend/final-security-gate-audit.json`: fresh audit/version/test/residual-finding metadata and non-secret source fingerprints.

Earlier uncommitted phase changes were preserved. No frontend UI/CSS/layout/icon, schema, existing data, secret, dependency version or product feature was changed in this gate.

**Final: GO for Phase C API Contracts; NO-GO for public production deployment. Stop here and await the next explicit implementation instruction.**
