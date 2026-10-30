# Phase C4 — Pagination and query contracts

Work date: 2026-10-29, Asia/Dushanbe. C1–C3 and the Final Security Gate reviewed first. Public production remains NO-GO.

## Pre-implementation compatibility plan

Confirmed risks: owned project lists truncate at100, revision/admin lists at50, and active session lists are unbounded. Existing frontend callers send no pagination opt-in. Replacing their {items} envelopes, changing the project's updatedAt ordering, or silently capping session defaults would change existing behavior. Those default changes are explicitly deferred.

Implement additive **`pagination=cursor`** on the same four routes, with bounded limit/lookahead and optional opaque cursor. Only opted-in responses add pagination metadata. Legacy responses retain {items} and existing limits; timestamp ties gain a unique-id tie-breaker. Bare legacy limit/cursor parameters remain ignored unless the mode is explicitly selected, consistent with their previous unknown-query behavior. Invalid explicit pagination modes fail400.

Paginated projects/sessions/audit use immutable createdAt DESC/id DESC, revisions number DESC/id DESC. Project cursor mode deliberately differs from legacy updatedAt DESC; the mode makes this order explicit. No mutable-order snapshot is promised. Live keyset traversal has no repeats from ordinary edits; deletions/expiry disappear, new records before the boundary are not retroactively included. Inserts/backdated rows after a boundary may appear. No database snapshot is held across requests.

Cursors are encrypted/authenticated, endpoint/user/project scoped, and expire15 minutes after first-page issuance (not refreshed by each page). Use a domain-separated derived key from the existing mandatory HMAC secret; no new secret, rotation or dependency. Cursor validation/authentication must never bypass ownership or leak raw IDs. No total/count query for new pagination. Existing catalog offset envelopes/totals/defaults stay intact. No new filter/sort controls or UI work.

## 1. Collection inventory and confirmed risks

All routes are existing `/api/v1` operations. Empty collections keep items arrays; no null collection response is introduced.

| Collection | Historical limit/order/filter | Access and consumers | Database work / C4 disposition |
| --- | --- | --- | --- |
| GET `/projects` | Latest100; updatedAt DESC. No query filters. Silent truncation. | Session/current owner; Studio projects view. | Owner-filtered findMany/take100. Preserve default; add opt-in createdAt keyset. Add id DESC tie-breaker to legacy order. |
| GET `/projects/:id/revisions` | Latest50; number DESC. Silent truncation. | Auth-first project owner; no current frontend request. | Project-filtered findMany/take50; unique(projectId,number). Add opt-in number keyset; id DESC secondary order. |
| GET `/auth/sessions` | All active sessions, createdAt DESC; **unbounded**. | Current user only; settings session management. | userId/expiry filter/projection excludes tokenHash. Add bounded opt-in keyset; preserve uncapped legacy result to avoid hiding revocable sessions. |
| GET `/admin/audit` | Latest50; createdAt DESC. Silent truncation. | ADMIN only; no current frontend request. | Global audit findMany/take50. Add scoped opt-in keyset; retain legacy50. |
| GET `/devices` | Offset page1/limit12 defaults, maxlimit50/page10000; id ASC. q/manufacturerId; inherited valid kind is still ignored. | Public; creation search/pagination, Studio first page. | findMany+count transaction; includes manufacturer/variants, no N+1. Existing offset envelope/total preserved; bounded input does not eliminate full search/count cost. |
| GET `/legacy/catalog-projects` | Same offset bounds/defaults, id ASC; q/name and kind. No status/demo filter. | Public legacy catalog; no current frontend fetch. | findMany+count transaction retained. No new count operation. |
| GET `/manufacturers` | All manufacturers with active non-demo devices; unique name ASC. No truncation. | Public; project creation. | Unpaged select id/name plus exists filter; small curated catalog. No historical default cap introduced. |
| GET `/android-bases` | All SOURCE_AVAILABLE; name/androidVersion ASC. No truncation. | Public; project creation. | Unpaged source catalog; **id ASC added as final tie-breaker** for multiple refs of one version. Existing primary ordering/filter unchanged. |

Nested legacy detail arrays (PUBLISHED releases/device links) remain unpaged as well. They are not silently replaced with envelopes. Small curated catalog lists and legacy detail need a separately reviewed cap/continuation and client policy if their volume grows. Existing list defaults that were truncated remain explicitly documented; C4 does not claim their UI can now expose every record.

## 2. Opt-in contract and rationale

Example: `GET /projects?pagination=cursor&limit=30`, then the same route with `&cursor=<opaque token>`.

Legacy request response remains exactly `{items:[...]}`. Opt-in response is `{items:[...],pagination:{limit:number,hasMore:boolean,nextCursor:string|null}}`. Empty/final pages have hasMore=false/nextCursor=null. Metadata is an **explicit opt-in response variant**, not a silent replacement of an array or a default envelope change. The compatibility issue and decision were recorded above before implementation.

| Route | Opt-in default/max | Fixed cursor order | Scope |
| --- | --- | --- | --- |
| projects |100/100 |createdAt DESC,id DESC |endpoint + authenticated owner |
| sessions |50/100 |createdAt DESC,id DESC |endpoint + authenticated user |
| revisions |50/50 |number DESC,id DESC |endpoint + project owner + project id |
| audit |50/50 |createdAt DESC,id DESC |endpoint + currently authorized admin identity |

No total/count or OFFSET is added. Each page fetches limit+1, returns limit, and uses only the last **returned** row as the next boundary. The lookahead row is not lost. Continuation compares values with a lexicographic less-than predicate; it does not require the old anchor row still to exist. Auth/role/ownership precede query parsing and cursor decoding on private routes. Owner/project filters come from verified identity, never client filters or the cursor alone.

**Consistency model:** live READ COMMITTED keyset traversal, not an across-request snapshot. With unchanged sort keys, surviving rows below successive boundaries do not repeat or disappear because of offset shifts. Application edits change updatedAt, not createdAt, so paginated projects do not move when edited. Newly created rows/revisions before the current boundary require a fresh traversal; backdated/equal-time inserts with keys after a boundary may appear later. Deleted/revoked/expired rows disappear and are not promised to be returned. Sessions are filtered active at each request. If privileged out-of-band operations mutate sort keys, no snapshot/no-repeat guarantee is made. PostgreSQL timestamps use millisecond precision, preserved exactly by the cursor ISO date.

For equal timestamps, the deterministic tie order (and cutoff subset) can differ from the previous unspecified tie order. Primary ordering and historical caps remain unchanged; no record is deleted, and full traversal is available through opt-in pagination.

Legacy projects keep updatedAt order because changing that default would change the user's workspace. Cursor mode intentionally uses immutable creation order. No unverified guarantee of a stable mutable-update-time snapshot is offered.

## 3. Shared query and response ownership

New `packages/contracts/src/pagination.ts` exports route-specific query schemas plus metadata. They share only a small bounded-query constructor, not a generic query/ORM framework. Public index re-exports them; responses.ts defines four separate paginated response schemas/types while preserving all four legacy strict schemas.

- Mode must be exact `pagination=cursor`; unsupported explicit modes400.
- With no mode, prior unknown query parameters (including bare limit/cursor) remain ignored. No legacy request suddenly receives pagination metadata.
- In cursor mode, limits are decimal digit strings, trimmed, positive, defaulted and capped as above. Empty/zero/negative/fraction/exponent/hex/oversize/repeated arrays are400. Leading zero forms are not an advertised alternate representation.
- Cursor is optional; present tokens must be nonempty, <=2048 characters, versioned base64url with no whitespace/padding. Structural, authentication, expiry and scope errors return the same controlled400 `Invalid or expired pagination cursor` after decoding. Schema-level malformed values use the existing path-prefixed Zod400 array. No raw cursor/ID/crypto detail is returned.
- Unknown filter/sort/operator fields are stripped as before. These collections deliberately expose **fixed** sort fields/directions, not arbitrary Prisma orderBy or owner filters. No new q/filter semantics invented for private collections.
- Existing catalog offset coercion/search/unknown-key rules remain unchanged, including C3 NUL guards. The valid inherited devices kind remains ignored; applying it now would invent semantics or silently change results. Invalid kind remains400.

## 4. Cursor implementation and security

`apps/api/src/pagination.ts` uses Node's AES-256-GCM, a fresh random96-bit nonce per issued token, authentication tag and versioned AAD. Key derivation is HMAC-SHA256 with domain `nexos:pagination:cursor:v1` over the existing mandatory HMAC secret, so raw account HMAC material is not reused as an AES key. Token payload scope, position IDs/timestamps and expiry are encrypted/authenticated; cursors are not plain base64 database IDs or credentials. No new Redis keys, secrets or dependency are introduced.

Lifetime is15 minutes from first issuance and **not extended** during continuation. Requests must still authenticate; tokens grant no independent access. Cross-user, endpoint and project replay fails400, and non-admin audit access fails403 before decode. Missing runtime key is an internal error, not misclassified client input; startup still uses existing mandatory environment validation. Tokens produced for pathological oversized internal identifiers are refused rather than emitting an unusable >2048-character cursor. Malformed client tokens remain bounded400.

All replicas need the same existing HMAC secret/configuration and synchronized clocks. No rotation occurred. A future HMAC-key change also invalidates outstanding cursors; multi-key cursor rotation is not implemented. Query logging already removes query values, including cursor tokens, and error handling never logs their content. Cursor validity is not a substitute for an index or production abuse controls.

## 5. Exact implementation / frontend compatibility

Backend changes are confined to four existing list handlers, immutable boundary/crypto helpers, stable tie-breakers and Android-base final ordering. There are no extra per-item lookups, queue operations, new routes or dynamic SQL. Revisions retain the existing owner lookup; all paginated collections perform one list query after constant authentication/ownership work.

**No frontend file was changed.** Existing consumers do not opt in, so their requests, envelopes, selected fields, settings session list and interactions remain unchanged. New pagination controls/infinite scroll or changing clients to consume only the first bounded page would need explicit UI approval. They were not implemented.

Files modified by C4:

1. `apps/api/src/app.ts` — four opt-in branches, legacy deterministic ties, base tie-breaker.
2. `apps/api/src/pagination.ts` — bounded opaque cursors, scopes, expiry and seek/page helpers.
3. `packages/contracts/src/pagination.ts` — shared mode/limit/cursor contracts.
4. `packages/contracts/src/index.ts` — pagination export.
5. `packages/contracts/src/responses.ts` — opt-in response schemas and inferred types.
6. `tests/pagination.test.ts` — four focused unit tests.
7. `tests/api.integration.ts` — one isolated real PostgreSQL/Redis pagination case.
8. `docs/backend/phase-c4-pagination-query-contracts.md` — plan, inventory and report.

Earlier uncommitted phase work was preserved. No schema/migration, dependency/lock/patch, environment, auth/session policy or limiter policy file was changed.

## 6. Regression evidence

Four new unit tests cover legacy query ignoring, opt-in defaults/maxima/unknowns, invalid numeric/repeated/malicious/cursor formats, encrypted payload privacy/authentication/scope, expiry and non-renewal, empty/final pages, independent seek predicates and wrong-position errors, oversized minted-token rejection, and missing-key internal-error classification.

One added real PG/Redis integration case creates only synthetic owners/data:105 tied-time projects,55 revisions,105 additional active sessions plus the fixture login and an expired session, and55 tied-time audit records for a synthetic admin. Assertions cover:

- Exact legacy {items} shape and100/50 limits; legacy session list returns all106 active sessions; bare invalid limit/cursor still ignored.
- Complete, unique traversal of105 projects,106 sessions and55 revisions across pages. Empty owned projects/revisions and explicit end metadata.
- Deterministic timestamp/id ties and unique revision order; audit continuation beyond50 without changing role checks.
- Input maxima/repeated/malformed modes/tokens, real expired authenticated token400, cross-user/endpoint/project cursor400, unauthorized401, foreign project404 and non-admin403.
- Updating an unseen project does not move its creation key; deleting the boundary row still permits continuation; deleting an unseen row removes it; a newer project before the boundary does not unexpectedly enter continuation.
- Delegate spies verify take=limit+1 and no skip for each traversed list. No new count calls exist in the branches. This bounds rows returned, **not worst-case rows scanned/sorted**.
- Device manufacturer+q+offset filters, second-page total/end behavior, page maximum and unchanged ignored-kind/unknown-key behavior.

The first added-test root typecheck reported an inferred any[] fixture-user array; adding its explicit type resolved the harness issue. Focused real integration passed before and after expanded edge assertions. Only final successful checks below count as verification.

## 7. Full verification and integrity

| Executed check | Result |
| --- | --- |
| `pnpm typecheck` | PASS: root test check plus seven workspace tasks, six cached on final run. |
| `pnpm lint` | PASS: seven tasks, four cached; existing web ESLint/backend TypeScript convention. |
| `pnpm test` | **46 passed,0 failed**, no skipped/cancelled;42 existing +4 new. |
| `pnpm test:integration` | **17 passed,0 failed**, no skipped/cancelled;16 existing +1 new real PG/Redis case. |
| Focused C4 integration | **1 passed,0 failed**, additionally rerun after expanding scope/expiry/filter assertions. |
| `pnpm test:e2e` | **6 passed**, Chromium against production API/web through Next proxy. |
| `pnpm build` | PASS: seven tasks, five cached on final run; earlier C4 build rebuilt contracts/API/web with three cached tasks. No clean-cache rebuild claim. |
| `pnpm audit --json` | Exit0, **zero critical/high/moderate/low/info advisories**,636 dependencies in metadata. |
| `pnpm audit --prod --json` | First attempt exit1 due to **EHOSTUNREACH**, no advisory result. Explicit retry exit0, **zero advisories in all severities**,267 dependencies in metadata. Failed registry request is not counted as a passed audit. |
| `pnpm db:status` | Three migrations found; up to date. No migration executed. |
| Read-only pre/post model counts/digests | **All28 unchanged** after all synthetic-fixture cleanup. Existing users/projects/sessions/catalog/audit records preserved; schema/migrations untouched. |
| Environment/HMAC integrity | Existing environment byte-for-byte unchanged, ignored/untracked, mode0600. Zero known HMAC/database secret matches in157 nonignored repository files,10 verification logs and20 static client assets at scan time. No key value printed/rotated. Bounded known-value scan, not universal secret detection. |
| Restored local API/web | Direct health4000/readiness4000, frontend3000 and proxied readiness3000 all **HTTP200**; unauthenticated paginated project request401. |
| `git diff --check` | PASS. |

The full regression suite retains B1 password/legacy/CAS, B2 atomic-registration rollback/duplicates, B3 cookie/HTTPS/exact-proxy trust, B4 IP Redis atomic/outage/recovery and Retry-After, B6.3 account HMAC/outage/recovery, C1/C3 malformed-input/error sanitization and C2 response compatibility tests. Existing fixtures plus the added pagination fixtures use synthetic accounts only, not real user credentials or stored session tokens. Existing rows were read-only checked by digest; real API create/get/session behavior uses isolated fixtures.

Development API/web were paused for build/E2E and restored with explicit `PORT=4000 pnpm dev:api` and `PORT=3000 pnpm dev:web`. PostgreSQL/Redis remained running with existing storage. No database reset, queue erasure, secret regeneration, dependency upgrade or public deployment occurred.

## 8. Performance recommendations and limits requiring later approval

- **Projects:** legacy ownerId/updatedAt index remains useful for old order; cursor mode needs a reviewed `(ownerId,createdAt DESC,id DESC)` index for large owners. None added. LIMIT bounds returned rows but may still scan/sort all an owner's matching rows with current indexes.
- **Sessions:** existing `(userId,expiresAt)` helps ownership/active filtering; assess a complementary `(userId,createdAt DESC,id DESC)` index plus expiry distribution under realistic load. Legacy session default is intentionally still unbounded; a quota/cap/cleanup/UI policy needs separate approval.
- **Revisions:** existing unique `(projectId,number)` supports ordered seek well; number is unique within a project, making the id tie-breaker defensive. No new count/index needed.
- **Audit:** createdAt index helps range/order; assess `(createdAt DESC,id DESC)` if tie volume/sorts justify it. No unbounded total introduced.
- **Devices/legacy catalog:** offset caps bound parameters but deep offsets, contains search and existing count can scan broadly. Existing joins/unique indexes help equality, not every case-insensitive substring. Preserve total/contains semantics now; review query plans and optional trigram/index strategy separately before growth. READ COMMITTED item/count queries and offset pages are not a concurrent snapshot and can drift under writers. Catalogs are currently small curated data, so no replacement contract was forced.
- **Other unpaged catalogs/detail arrays:** retain all records until a bounded-compatible client plan exists. No claim that all historical unbounded work was eliminated.

No EXPLAIN/large-production-load or infrastructure capacity certification was performed. Cursor state is stateless and bounded per request, but existing rate/retention/operational limits from the final gate remain. There is no database snapshot token, jump-to-page/total, arbitrary sort/filter, cursor revocation store, or multi-key rotation mechanism. A long traversal may expire and must restart explicitly; no automatic retry was added.

## 9. Recommendation and stopping point

**C5 is ready for approval after the final green verification above.** Recommended scope: document both legacy and opted-in variants, fixed ordering/live consistency, encrypted cursor expiry/scope,400/401/403/404/429/503 contracts and defaults, then add route-to-OpenAPI drift tests. C5 should not silently cap session defaults, change publication/query semantics or add pagination UI.

C5 has **not** started. No production deployment occurred. Public production remains **NO-GO** pending the separate deployment/operational gate. Stop after C4 and await approval.

