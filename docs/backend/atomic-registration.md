# Phase B2: atomic registration

Implemented 2026-10-28. Addresses Phase A finding H4 only. Phase B1 password hashing, existing sessions, authorization, routes and response contracts are preserved.

## Original failure boundary

`AuthController.register` previously called `db.user.create`, which committed independently, and then `Accounts.createSession`, which opened its own transaction for session rotation, insertion and audit creation. A failure in that second transaction left the newly created user in PostgreSQL. Retrying registration then encountered a unique email/username conflict.

## Current boundary

`apps/api/src/app.ts` now has a small Accounts.register operation:

1. The controller performs its existing Origin/JSON checks and strict registration-schema validation.
2. Derive the password hash using the unchanged B1 policy and generate the opaque session token **before** opening a transaction. Expensive scrypt does not occupy a transactional database connection.
3. One Prisma 6 interactive transaction creates the user, deletes the presented prior token if any, creates the initial session digest/expiry, and creates the existing `session.created` audit event. Every write uses that transaction client. There is no nested transaction or compensating deletion.
4. Await transaction commit, then issue the unchanged session cookie and return the existing `{user}` response with status 201. No credential is emitted on a rejected transaction.

The existing createSession login method and registration share only the session database writes and cookie-setting helpers. Login still owns its original session transaction, with the same random token generation, presented-token rotation, expiry and audit behavior. B1 legacy verification and guarded hash upgrades are untouched.

PostgreSQL's existing unique constraints remain authoritative for email and username, including concurrent attempts. P2002 continues to map to the existing sanitized 409 error envelope. Other transaction failures retain the generic error envelope and sanitized request correlation; raw database errors/hashes are not returned. No preflight uniqueness race or account deletion was introduced.

## Focused verification

The new test in `tests/api.integration.ts` initializes the real compiled Nest AppModule/Fastify routes with PostgreSQL. A test-only wrapper intercepts the transaction client in that one application instance. All other operations run on real PostgreSQL. No triggers, migrations, production failure switches, database resets or global fault hooks are used.

Injected failures:

- Before session insertion, after confirming the user exists inside the transaction.
- Immediately after real session insertion.
- During audit insertion, after confirming the session exists.
- Immediately before the transaction callback returns to commit, after confirming session and audit rows exist.

For each case, assertions prove that no new user/session/audit row survives, no Set-Cookie is emitted, the client receives only the generic error, and the presented previous session is restored and remains authenticated. The previous account's password hash remains unchanged.

Success and conflict assertions cover:

- Successful retry using the same identity, with exactly one initial session/audit event and a usable cookie.
- Current B1 hash storage and correct password verification.
- Original presented-token rotation semantics on successful registration.
- Duplicate identity, duplicate email with a different username, and duplicate username with a different email: sanitized 409, no extra cookie/session, no orphan account, existing account/session unchanged.
- Concurrent identical identity and concurrent shared-username/different-email registrations: one 201 and one 409, exactly one account/session/audit event.
- Existing suite coverage for login, B1 upgrades, session rotation/revocation/expiry, ownership, configuration persistence and builds remaining disabled.

Executed successfully:

- `pnpm typecheck`.
- `pnpm lint` (web ESLint and the repository's existing backend TypeScript lint checks).
- `pnpm test`: **17 unit tests passed**.
- `pnpm test:integration`: **5 integration tests passed**, including the new fault-injection and concurrency test.
- `pnpm test:e2e`: **6 Chromium E2E tests passed** through the Next proxy.
- `pnpm build`: **7 workspace build tasks successful**.
- `git diff --check`: clean.

Tests clean up only their own uniquely named fixture accounts and associated audit records. Existing accounts/projects are not deleted or reassigned.

## Limits and scope

Atomicity covers the PostgreSQL writes, not delivery of the HTTP response/cookie. A connection loss after a successful commit can leave the client uncertain even though both account and session exist; the account can use the normal login flow. Lost commit acknowledgments, abrupt process crashes and actual PostgreSQL outages were not induced. The pre-commit failure test exercises real rollback, not a simulated network failure during COMMIT.

Only `apps/api/src/app.ts`, `tests/api.integration.ts`, and this document changed in B2. No API contract, cookie name/options, hashing policy, database schema/configuration, dependency or frontend changes. No Phase B3 work was started.
