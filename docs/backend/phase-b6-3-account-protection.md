# Phase B6.3 — Account-aware login protection

Reviewed 2026-10-28, Asia/Dushanbe. Scope: an independent account-aware login admission layer, integrated with the existing Redis infrastructure. Phase C remains on hold. The Zod and deepmerge major-version changes are outside this phase.

## Decision and threat model

B5, B6.1 and B6.2 were reviewed before implementation. The existing distributed IP policy is unchanged: login and registration independently allow 60 requests per rolling 60 seconds per normalized client network, with a 60-second block. Fastify's B3 trusted-proxy policy remains the only source of client IP, including IPv4-mapped equivalence and IPv6 /64 aggregation. Accounts still authenticate with the existing lowercase email contract, versioned/legacy scrypt and database sessions.

IP-only protection lets a botnet combine independent network budgets against one account. B6.1 proposed an account token bucket plus account/network bucket. Its strengths were atomic admission before lookup/KDF, consistent normalization and HMAC privacy. Its principal weakness was that a fixed aggregate refill token can always be consumed by an attacker before the legitimate user. TTL and bounded individual Retry-After do not by themselves prevent indefinite login starvation. Additional account/network state would also increase memory and shared-network false positives.

The implementation keeps the aggregate admission layer and adds a deliberate recovery opportunity. It does not add another account/network bucket: the unchanged IP layer already constrains each network and the additional pair layer would not solve distributed starvation. This follows the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) to consider denial of service when designing account lockout. The concrete thresholds below are a local engineering policy, not thresholds prescribed or certified by OWASP.

## Policy

| Property | Implemented value |
| --- | --- |
| Scope | Login only; all syntactically valid login attempts, known and unknown accounts |
| Initial burst | 5 admissions per normalized email across all API instances/networks |
| Refill | One credit per 60 seconds, capacity five |
| Account cooldown | At most 25 seconds until a recovery opportunity; refilled credit can admit sooner |
| Recovery window | Five seconds; all IP-admitted requests can reach password verification during this window |
| Account value retention | 15 minutes after last admitted request |
| Capacity | At most 10,000 indexed active account identities per namespace during normal operation |
| Existing IP policy | Unchanged 60/60/60 per action/network |

Reservations happen before database user lookup and password hashing, after existing Origin/HTTPS/content-type and login-schema validation. Counting admissions rather than failures prevents parallel requests from all checking a zero failure count before any writes occur. Successful logins neither refund nor reset counters, so one successful request cannot erase concurrent abuse. Session creation, atomic registration, hashing, upgrades and session ownership rules are unchanged.

Exhaustion returns the existing generic HTTP 429 envelope with an integer Retry-After. A request cannot move a previously scheduled recovery deadline or extend an active recovery window. During recovery there is no single aggregate token for attackers to steal: multiple wrong guesses and the legitimate correct login can proceed simultaneously, subject to the existing IP limiter. At the end of recovery, an exhausted account waits for the next recovery period or credit refill. No persistent account lock flag, password reset or administrator unlock is involved.

**This intentionally is not a strict five-guesses-per-minute ceiling.** Under continuous attack, five seconds of recovery follow 25 seconds of cooldown; botnet guesses can pass during that window, and aggregate KDF work is not bounded across arbitrarily many networks during recovery. An attacker can still force legitimate users to retry, and shared-IP users remain subject to the original IP limit. The design reduces sustained guessing while avoiding an attacker monopolizing the only refilled token indefinitely. It cannot guarantee successful login under a volumetric attack or compromised infrastructure. MFA/step-up verification and edge capacity controls would be separate product/security work; none were added here.

## Redis implementation and privacy

`apps/api/src/account-protection.ts` contains the policy, purpose-separated HMAC function and Lua script. `RedisAuthLimiter` reuses its existing ioredis connection/lifecycle and timeouts; no dependency or Redis deployment was added.

Keys:

```text
<RATE_LIMIT_NAMESPACE>:account:v1:<HMAC-SHA256(normalized email)>
<RATE_LIMIT_NAMESPACE>:account:v1:active
```

The HMAC input includes the fixed purpose/version prefix `nexos:login-account:v1` and the existing lowercase email normalization. There is no trimming, Unicode transformation, plus-address stripping or provider-specific alias mapping. Raw email, username, password, session token and HMAC key never enter the Lua arguments, key/member names or stored state. A digest is pseudonymous security data, not anonymous data. Protect Redis access accordingly.

Each account has one constant-size JSON array containing four numeric values: credit, last admission timestamp, next recovery timestamp and recovery end. Credit uses integer millisecond units, replenished using Redis TIME, without application-instance clocks or client timestamps. No list of requests, passwords, networks or tokens is stored per account. A single Lua call performs the account read, capacity check, reservation, deadline transition and expiry/index updates atomically against concurrent callers.

Account writes use Redis SET with PX in one command. Scheduling the first cooldown preserves the existing TTL with KEEPTTL; repeated denials do not refresh TTL or move the deadline. This avoids a newly allocated account value being left without an expiry if a later script command fails. The active sorted set contains account-key names scored by expiry; expired members are pruned when admitting a new identity. Its normal inactivity TTL is also 15 minutes. At capacity, new identities receive controlled 503 with Retry-After: 1; existing identities continue through their own policy. A rejected identity does not allocate an account key.

The 10,000-entry bound limits normal account namespace growth, but it is not a production load/memory sizing certification. Attackers with many IPs can fill the capacity and deny previously unseen identities until entries expire; retaining enforcement is preferable to silently evicting protection. Monitor capacity and provide upstream abuse controls. Redis Lua is atomic with respect to concurrent execution, not transactional rollback on command errors: an index-write error after an account SET can leave an expiring unindexed value. Errors never grant authentication; account values remain individually bounded/expiring. Unexpected ACL/OOM conditions require operator remediation, not a claim of an infallible global memory bound under every infrastructure failure.

This two-key script targets the existing standalone Redis endpoint. Redis Cluster cross-slot execution is not supported and will fail closed; no Cluster topology was invented. A future cluster migration needs intentional key-slot/capacity design and tests. Redis 7 is the existing documented local service; KEEPTTL requires Redis 6 or later.

## Enumeration and error handling

The account layer performs no existence lookup. Equal valid request histories produce the same admission and generic error behavior for known/unknown emails and different email casing. Blocked requests do not reach the database or scrypt. Admitted unknown accounts still use the existing dummy hash. Invalid credentials remain generic 401. Existing registration 409 semantics remain unchanged; this phase does not claim to eliminate registration enumeration or statistical timing side channels. Account activity may be inferred from budget history even though existence is not consulted.

No account-specific metrics or log fields were added. Captured API logs are checked for email, HMAC digest, HMAC key, password, session tokens and query markers. Request IDs and operational error status remain. Logging elsewhere, Redis command capture, environment dumps and production telemetry must follow the same secret handling policy; they are not globally certified by these tests.

Redis connection/script/state errors return sanitized 503 and Retry-After: 1. There is no process-local account fallback. Startup/readiness now exercise the account script with separate bounded probe keys as well as the existing IP script. Public reads, authenticated session lookup, logout and revocation are not routed through this account layer. Redis outages still fail login/registration closed through the unchanged IP guard; the new account stage independently fails closed if IP admission succeeded but account state cannot be read.

## Configuration and rollout

New required server-only variable: **AUTH_ACCOUNT_HMAC_KEY**. It must be 64 hexadecimal characters encoding 32 cryptographically random bytes and be identical across API instances in one deployment. Missing/malformed values fail startup in every mode. The value is never included in the configuration error. There is no compiled-in default or per-process random fallback that would split identities across replicas.

Generate a value with the repository's documented environment provisioning or `openssl rand -hex 32`, and store it in the deployment secret manager/ignored local environment. Do not commit the output. For this local environment, a new random value was generated into the existing ignored mode-0600 `.env` without printing it. Tests use separately generated ephemeral keys shared by their own API instances.

Deploy the same key, RATE_LIMIT_NAMESPACE and policy to every instance. Drain old instances that lack this account layer before claiming fleet-wide enforcement. Production operators must check script ACLs (including SET with PX/KEEPTTL, GET, TIME, ZCARD, ZREMRANGEBYSCORE, ZADD and PEXPIRE, plus the existing IP commands), network isolation, noeviction, memory budget, persistence and latency. Existing B3 proxy/header sanitation requirements remain.

Do not casually rotate this key or namespace: changing either resets account identities and budgets without affecting sessions. No seamless online key-rotation protocol was added. Coordinate a controlled login-admission pause/drain for the 15-minute state lifetime, then deploy the new shared key consistently, or separately implement/review dual-key conservative accounting. Emergency key compromise response must explicitly accept the counter-reset trade-off. No session tokens or user passwords are reissued by this change.

Local commands remain:

```sh
podman start rom-hub-redis  # only if the existing container is stopped
pnpm db:local:start        # reuses existing local PostgreSQL storage
PORT=4000 pnpm dev:api
PORT=3000 pnpm dev:web
```

Use explicit web PORT because the root environment's existing PORT=4000 is also inherited by its env loader. No frontend script/design change was made.

## Verification actually executed

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed, root and seven workspace tasks |
| `pnpm lint` | Passed, seven workspace tasks; existing backend TypeScript lint and web ESLint |
| `pnpm test` | 26 passed, 0 failed |
| `pnpm test:integration` | 12 passed, 0 failed, real PostgreSQL and Redis |
| `pnpm test:e2e` | 6 Playwright/Chromium tests passed against production servers |
| `pnpm build` | Passed, seven workspace tasks |
| `pnpm audit --json` | Exit 1: 2 high, 0 moderate/low/critical |
| `pnpm audit --prod --json` | Exit 1: same two high advisories |
| Database preservation | All 28 model counts/digests unchanged after fixture cleanup |
| `git diff --check` | Passed |

New coverage:

- HMAC casing equivalence matches loginSchema; distinct keys/secrets/provider aliases remain distinct. Malformed configuration fails without exposing values.
- Forty simultaneous consumes across two independent Redis clients admit exactly five before cooldown; casing does not split the bucket.
- Constant four-number state, bounded TTL, non-refreshing denials, fixed recovery deadlines, concurrent recovery opportunities, refill, expiry/reset, independent account budgets and capacity rejection. Shortened timings/capacity are used only for storage mechanics tests.
- Two independent Nest/Fastify application instances, real database/Redis, configured trusted proxy peer and different client networks share the production policy. Five incorrect attempts followed by 429 match for known/unknown accounts. Invalid Origin/input allocates no account value; registration does not consume a login account budget.
- A real 25-second production cooldown then permits a correct login alongside simultaneous wrong guesses; existing sessions remain usable throughout. Capacity HTTP mapping is checked using real Redis and a test-only smaller capacity.
- Malformed test-owned Redis state returns sanitized 503 without cookie or Redis error disclosure even though IP admission still works.
- Existing B1–B4, query logging/input validation, project ownership and Redis network outage/recovery regressions continue to pass. The earlier broad auth test resets only its own fixture's budget between independent scenarios; dedicated account-policy tests enforce the unmodified production policy separately.

No mocked Redis replaced the storage/concurrency tests. Two in-process API application instances demonstrate shared enforcement; existing multi-process IP/outage tests also remain passing. This is not a public deployment test, exhaustive enumeration timing study, botnet load test or penetration test. Database tests create and clean only their own uniquely named fixtures. No pre-existing account, session or project was reset or deleted.

## Files modified in this phase

- `apps/api/src/account-protection.ts` (new): HMAC identity, policy and Lua admission state machine.
- `apps/api/src/rate-limit.ts`: shared-client account admission and startup/readiness probe; original IP script and thresholds retained.
- `apps/api/src/config.ts`: required HMAC key validation.
- `apps/api/src/app.ts`: login-stage admission before lookup/KDF, controlled 429/503.
- `.env.example`, `apps/api/.env.example`: new server-only key documentation, no secret values.
- `tests/account-protection.test.ts` (new): normalization/HMAC and configuration tests.
- `tests/api.integration.ts`: real account storage/concurrency/HTTP tests and log privacy assertions.
- `tests/transport.test.ts`, `tests/infrastructure.test.ts`, `playwright.config.ts`: isolated test key provisioning.
- `docs/backend/phase-b6-3-account-protection.md`: this report.

Ignored local environment/log/digest files were used for provisioning and verification. Earlier dirty files and dependency overrides were preserved. No dependency versions, Prisma schema, session format, hashing policy, public response shape or frontend code/design changed in B6.3. Login can now additionally return the existing standard 429/503 envelopes under account admission pressure.

## Remaining risks and phase boundary

The two high dependency advisories remain: production-reachable Zod 3.25.76 collection-validation risk and Prisma configuration's deepmerge-ts 7.1.5 recursive-object risk. Their major-version remediation still requires coordinated approval. Other residual risks include botnet traffic during recovery windows, active-account capacity exhaustion, shared-IP false positives, Redis durability/eviction or key misconfiguration, upstream logging and production proxy/ACL validation. The new account layer is additional defense, not a replacement for these controls.

Phase B6.3 stops here. Phase C remains on hold pending explicit approval and review of unresolved dependency and deployment risks.
