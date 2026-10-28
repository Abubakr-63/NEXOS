# Phase B1: versioned password hashing

Implemented 2026-10-28. Scope is password derivation, verification and opportunistic hash upgrades only. This addresses Phase A finding H1; other findings remain separate tasks.

## Previous format and compatibility

The original writer used Node's implicit scrypt defaults: N=16384, r=8, p=1, 64-byte output and a random 16-byte salt encoded as lowercase hex. Crucially, that hex **string** was passed as the UTF-8 salt, not decoded back to bytes. Stored format was `scrypt:<32 hex salt characters>:<128 hex digest characters>`. It identified the algorithm, salt and digest but had neither version nor cost fields.

Legacy verification now explicitly selects those exact original costs and salt representation. All correctly generated legacy records remain verifiable; no database conversion or forced reset is needed. Malformed or unknown formats fail closed. Supporting legacy records does not mean accepting arbitrary salts, partial hex, appended fields, unknown versions or caller-selected parameters.

## New policy

Node's existing built-in scrypt implementation is retained; no dependencies were installed. The chosen profile is one of [OWASP's listed scrypt configurations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt): **N=32768, r=8, p=3**, approximately **32 MiB per derivation**. It trades additional CPU work for a lower memory footprint than the 128 MiB profile. Node 22 has built-in scrypt; changing to Argon2 would require a dependency/runtime decision outside this focused upgrade.

- Random 16-byte salt, 64-byte derived key, hexadecimal encoding.
- Stored format: `scrypt:v1:N=32768,r=8,p=3:<32 hex salt characters>:<128 hex digest characters>`.
- Explicit `maxmem=64 MiB` per derivation allows overhead above the roughly 32 MiB work area. This is a crypto allocation guard, not a process memory limit.
- Parameters are immutable for this version. The parser allowlists only the exact legacy and v1 formats; it never executes arbitrary stored cost values. A future policy needs an explicit format/reader change.
- Valid digests are compared with `timingSafeEqual`. Hashing errors do not fall back to weaker parameters.
- Password input semantics are unchanged; no trimming, normalization or prehashing was introduced. Passwords remain request-local and are never persisted or logged. Hashes remain only in the existing passwordHash field.
- Unknown/no-password accounts run a current-policy dummy verification before rejection. Dummy data is public structural filler, not a credential. Legacy and malformed records have different execution costs; this does not promise indistinguishable timings for every account state.

Original default costs and memory behavior: [Node 22 crypto documentation](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

## Login upgrade and concurrency

1. Registration calls the existing hashPassword function, which writes v1. Registration transaction/session flow is unchanged.
2. Login verifies the exact stored record using its original policy. Incorrect passwords never trigger upgrade writes.
3. A verified legacy password is derived under v1 with a fresh random salt.
4. Prisma performs a single atomic update with **both user ID and the exact previously verified passwordHash in the WHERE predicate**. This compare-and-swap cannot replace a newer hash, including a concurrent password change.
5. If another writer wins, login reads and verifies the latest hash before creating its ordinary session. Concurrent upgrades of the same password can both log in; a different newer password rejects the stale credentials.
6. If derivation/update throws, the opportunistic upgrade is abandoned; the already verified login proceeds through the existing session path. A hash-free event containing only `password.rehash_failed` and request ID is logged. A later login retries. Database/session creation failures still behave as before; no authentication bypass or weaker verification fallback is introduced.
7. Current v1 records need no upgrade and cause no password update. Session tokens, cookies, expiry, rotation, revocation and existing independent sessions are untouched.

The compare-and-swap protects password writes. It is not a redesign of password-reset/session-invalidation transactions: there is currently no password reset/change API. A future implementation must separately define that policy and its transaction boundaries. Credentials changing after the final verification remain a general authentication race requiring that future design; B1 does not claim to solve it globally.

## Resource tradeoffs and rollout

Local Node v22.23.1 benchmark, five sequential derivations per policy:

| Policy                 | Median | Range      | Approximate scrypt work memory |
| ---------------------- | ------ | ---------- | ------------------------------ |
| Legacy N=16384,r=8,p=1 | 82 ms  | 74–83 ms   | 16 MiB                         |
| v1 N=32768,r=8,p=3     | 222 ms | 185–442 ms | 32 MiB                         |

This is a small local sample taken during development, not an isolated load/capacity benchmark. Host load and hardware affect results. A legacy successful login pays legacy verification plus new derivation once; later logins pay current verification. Concurrent upgrade losers may additionally verify the winning v1 hash. With the usual four libuv threads, four concurrent work areas are roughly 128 MiB before Node/application/crypto overhead. Worker-pool size, process replicas and request queues affect the actual resource budget. No thread-pool, rate-limit, proxy, session or deployment configuration was changed. Capacity/abuse hardening remains a separate phase.

Deploy only binaries that can read **both** formats. A pre-B1 binary cannot read v1 hashes, so rollback to that binary or a mixed fleet containing it is unsafe after new writes begin. Use a coordinated backend replacement or a separately planned readers-first rollout; preserve both-format readers for rollback. There is no bulk rewrite. Dormant legacy accounts retain the old cost until their next successful login. Hash-upgrade failures retain that old cost and should be monitored via the sanitized event.

## Files and verification

- `apps/api/src/security.ts`: explicit policies, strict versioned/legacy parsing, generation, verification and rehash predicate; sessionDigest unchanged.
- `apps/api/src/password-upgrade.ts`: guarded atomic update and non-destructive failure outcomes.
- `apps/api/src/app.ts`: current dummy verification and login-only upgrade integration; registration continues to call the same hashing function.
- `tests/passwords.test.ts`: new policy, valid/invalid passwords, independent original-writer legacy fixture, malformed/unknown records, no-write current records and failed update tests.
- `tests/api.integration.ts`: real registration storage, failed legacy login, HTTP concurrent legacy upgrades, persistent independent sessions, unchanged current hashes, PostgreSQL compare-and-swap races and preservation of newer password changes. Existing ownership/session/project tests retained.
- This document.

No database migration, schema/environment change, bulk account update, dependency change, frontend change or forced logout is required. Database tests operate on their own uniquely named accounts and clean up only those fixtures. The failed-write unit test uses a rejecting database stub; actual concurrent compare-and-swap behavior is tested against PostgreSQL. Allocation/OS failures were not induced.

Executed successfully for B1:

- `pnpm typecheck` and `pnpm lint`.
- `pnpm test`: **17 unit tests passed**.
- `pnpm test:integration`: **4 tests passed** with real PostgreSQL and API requests; includes two simultaneous successful legacy HTTP logins and guarded database update races.
- `pnpm test:e2e`: **6 Chromium E2E tests passed**, including account/session/logout and persistent project flows through the Next proxy.
- `pnpm build`: **7 workspace build tasks successful**.
- `git diff --check`: clean; development API restored and frontend-proxied readiness returns 200.

No requested verification command was blocked. Production load testing, mixed-version deployment testing and forced crypto allocation failures remain unexecuted. Stop after B1; no B2 recommendations were implemented.
