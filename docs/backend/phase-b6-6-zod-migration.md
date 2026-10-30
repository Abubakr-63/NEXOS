# Phase B6.6 — Controlled Zod security migration

Completed 2026-10-29, Asia/Dushanbe. B6.4, B6.5 and the latest dependency audit were reviewed first. The compatibility checklist and Zod 3 corpus below were prepared before changing dependency versions.

## Outcome

**Migrated Zod 3.25.76 to 4.6.6, the minimum fixed version for GHSA-mrhx-c7xc-m3w5.** Both full and production audits now exit 0 with **zero known advisories** in all severities. The existing deepmerge 8.0.2 override and Prisma compatibility patch remain intact and their security tests pass.

API/contracts and verified tooling consumers resolve the same fixed package version. Ordinary validation acceptance, normalization, serialized output and API issue paths/messages are preserved in a 98-case pre/post corpus. Oversized application arrays intentionally produce one size error without visiting elements or rebuilding the old per-element errors. Existing API error envelopes remain unchanged.

All requested checks pass: TypeScript, lint, production build, **34 unit tests, 12 integration tests and 6 E2E tests**. Counts/digests for all 28 PostgreSQL models match the baseline, and the existing saved project's normalized configuration matches its previous result. The HMAC environment file is unchanged. API readiness and frontend availability return HTTP 200 after restoring development servers.

**Dependency-remediation gates are cleared. The backend is ready for an explicit Phase C go/no-go decision; Phase C has not started.** This is local regression verification, not production deployment certification or a penetration test.

## 1. Original advisory and version choice

High [GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) affects versions **below 4.6.6**. Collection parsing can allocate excessive element issues and exhaust resources. Upgrading to an arbitrary early Zod 4 version would not resolve it. Version **4.6.6** is the advisory's minimum patched version and was selected/pinned exactly.

The NEXOS array is constrained to four application IDs. Previously, Zod 3 recorded a maximum-size error but continued traversing all elements. The migration now rejects an oversized constrained array before that traversal. The duplicate refinement also short-circuits on oversized arrays rather than constructing a Set over them. The size check still rejects those inputs; no previously invalid oversized value becomes valid.

No attack against production or unbounded heap-exhaustion test was run. The new bounded child test verifies this application's constrained collection path under a 64 MiB child heap. It does not establish safety of arbitrary future unbounded schemas, JSON.parse of huge files, or every possible malicious object.

## 2. Consumer inventory and pre-change compatibility checklist

| Consumer | Before / migration considerations | Verification |
| --- | --- | --- |
| `packages/contracts` | Direct Zod 3 dependency; all shared runtime schemas, inferred ROMConfiguration type and compatibility helper | Pinned 4.6.6; corpus, type checks, serialization and stored-config comparison |
| `apps/api` | Direct Zod 3 dependency and instanceof ZodError; shared parse calls in auth, catalog/device queries, project creation/update/read/validation/build | Pinned 4.6.6 together with contracts; class identity and real HTTP 400 response regressions |
| `apps/web` | Shared schemas in project-creation, project-details and studio; parse/safeParse before save/import and validation messages displayed | Receives patched version through contracts; no visual-component changes; typecheck/build/E2E |
| `apps/web/lib/project-api.ts` | ROMConfiguration type plus HTTP JSON casts; no runtime response schema | Inferred output remains compatible; no speculative response parser added |
| Worker / other packages | No Zod runtime import or independent schema found | Monorepo search and full workspace typecheck/build |
| ESLint tooling | eslint-config-next 16.4.3 → eslint-plugin-react-hooks 7.1.1 → Zod, plus zod-validation-error 4.0.2 peer | Owner declares `^3.25.0 || ^4.0.0`; exact-parent Zod pin to 4.6.6; real lint passes |
| OpenAPI | Nest Swagger derives its document independently; no zod-to-openapi/zod-openapi integration found | Generated JSON deep-equal to pre-migration baseline; existing YAML/JSON equality check passes |
| Tests | Shared schemas, HMAC normalization, API validation and persistence/auth flows | Existing tests plus focused corpus/resource/HTTP regressions |

`pnpm --recursive why zod` verifies direct/transitive paths all resolve **4.6.6**, including the lint peer. No global Zod override was introduced. The tooling pin is only `eslint-plugin-react-hooks@7.1.1>zod`; existing integration packages were not upgraded. Inspecting tooling entry points showed react-hooks uses `zod/v4` and `zod-validation-error/v4`, and the error package uses `zod/v4/core`. No application imports `zod/v3` or removed internal Zod 3 APIs. Historical reports, fixtures and the archived npm lockfile may still mention older versions; they are not active dependencies.

Checklist recorded before dependency changes:

- Upgrade API and shared contracts together; preserve one ZodError class.
- Preserve login/registration email/username normalization, password bounds and strictness.
- Preserve query defaults/coercion/optional fields and unknown-key stripping.
- Preserve ROM literals/enums, trimming, default description, array bound/refinement, strict objects and revisioned save semantics.
- Compare inferred outputs/inputs and project serialization, including existing saved data.
- Preserve error response shape, ordinary messages and paths without global locale changes.
- Reject oversized arrays without reconstructing unbounded element issues or scanning them in the duplicate refinement.
- Verify frontend consumers, Swagger, all security phases, dependency graph, database and secret preservation.

## 3. Compatibility code changes

### Local validation messages

New `packages/contracts/src/validation-errors.ts` supplies schema-local error options for the constructs used by NEXOS: required/type errors, literals/enums, string/number/array bounds, formats and unknown keys. Existing explicit duplicate-application text remains. These options are attached to NEXOS constructors/checks; there is no process-global `z.config` mutation affecting unrelated consumers.

The API's existing error filter remains unchanged: errors from the upgraded compiled contracts are instances of the API's ZodError, and HTTP responses still have `{error:{status,message,requestId}}`, with validation messages as path-prefixed string arrays. No authorization, session, hashing, cookie or rate-limiter code was changed.

Zod 4's internal issue codes/fields remain native Zod 4. They are not exposed by this API filter, and no consumer depended on the removed Zod 3 `.errors` alias or internal issue types. The 400 shape and ordinary displayed issue text are retained. A raw ZodError.message diagnostic string can have Zod 4's internal JSON representation; no attempt was made to emulate every private Zod 3 error field.

### Email acceptance and integer semantics

The prior Zod 3.25.76 email pattern is retained explicitly as a regex with the same `Invalid email` text, length bound and lowercase transform. This avoids Zod 4's default email-format policy silently changing which existing account identifiers can be used or which HMAC identity is selected. No trimming/provider-specific alias behavior was introduced.

Integer validation uses the existing number/coercion parser followed by `Number.isInteger`, then the same min/max bounds. This preserves Zod 3's integer acceptance rather than silently adopting Zod 4 int's additional safe-integer ceiling. The corpus includes a large integer revision. Existing revision/ownership checks and PostgreSQL constraints remain unchanged; no new unsafe-number behavior was introduced relative to the previous contract. Non-finite inputs remain rejected.

Zod 4's coerce.number input type defaults to unknown rather than Zod 3's numeric input type; runtime coercion already accepted query strings before this migration. No current consumer/export relies on the old query-input generic. Numeric outputs and the exported ROMConfiguration output remain compatible, and explicit default-description/application-union type witnesses plus the full API/web/worker compilation pass.

### Defaults, optional/null and object behavior

- Description remains optional on input through its default and always a string on output; explicit null remains invalid.
- Optional query fields remain optional and do not become nullable.
- Query objects still strip unknown properties; auth/configuration/save objects remain strict.
- Project literal/enums, valid application values, duplicate rejection, nested configuration and revision checks retain their meaning.
- Default configuration and parsed output serialize identically to their previous JSON results.

### Intentional bounded-error difference

Oversized arrays remain rejected, but now yield only the array-size error instead of one issue per invalid element and/or a duplicate issue after scanning the array. This is a necessary security change for already-invalid input, explicitly covered by tests. Recreating those secondary issues would restore the resource amplification being removed. No previously valid project configuration was rejected in the captured corpus or existing saved-config validation.

## 4. Before/after and security regression coverage

`tests/fixtures/zod3-contract-baseline.json` was generated **before the upgrade** from the real Zod 3 contracts. It contains 98 synthetic JSON cases, normalized outputs or public issue paths/messages, and no real user credentials/data. It does not import or ship a vulnerable Zod 3 runtime for comparison.

The corpus covers authentication bounds and malformed types, lowercase transforms, email edge forms, required/missing/null values, unknown role/owner properties (including an own __proto__ key), query coercion/defaults/stripping, empty/long identifiers, every project field, enums/literals, nested arrays, duplicates, metadata defaults and revisioned saves. The only expected corpus differences are the two oversized-array cases, which deliberately retain rejection and the original size message while dropping amplification.

Four new unit tests:

1. Compare all 98 cases, normalized output, acceptance and ordinary public path/message results. Failure reports show case IDs rather than credential payloads.
2. Assert patched version and shared compiled-contract/API error-class identity; compile input/output type witnesses for default description and the application union; verify JSON round trip and null rejection.
3. Reject a 10,000-entry array with a throwing first-element getter without reading that element or running duplicate traversal; retain duplicate rejection for valid-sized arrays.
4. In a child with a 64 MiB heap, parse 100,000 invalid entries and assert one issue/completion within a five-second timeout. This bounded payload is confined to a child process.

Eight additional real HTTP assertions in the existing integration flow cover malformed login/registration, invalid query coercion, empty project names, forbidden owner properties, oversized project arrays, nested duplicate applications and invalid revisions. They verify HTTP 400, exact ordinary messages, path formatting, request correlation and the unchanged error envelope. Existing malformed project-ID tests continue to verify controlled 400 and authentication-first/ownership behavior.

No frontend component or design code was edited. The existing browser tests validate project creation, modification/persistence/reload, auth/session interactions and responsive/accessibility flows. OpenAPI JSON is deep-equal to the pre-change document, and its generated YAML still parses equivalently.

## 5. Executed checks and results

| Command/check | Final result |
| --- | --- |
| `pnpm typecheck` | Passed: root tests and all seven workspace tasks |
| `pnpm lint` | Passed: seven workspace tasks, including real frontend ESLint with fixed tooling Zod |
| `pnpm test` | **34 passed, 0 failed**, including deepmerge and four new Zod tests |
| `pnpm test:integration` | **12 passed, 0 failed** against real PostgreSQL/Redis |
| `pnpm test:e2e` | **6 passed** against production API/frontend servers |
| `pnpm build` | Passed: seven workspace tasks, three cached; frontend rebuilt successfully |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` | Passed; manifest/override/patch/lockfile agreement |
| `pnpm audit --json` | **Exit 0: zero advisories**, all severities |
| `pnpm audit --prod --json` | **Exit 0: zero advisories**, all severities |
| Existing saved project validation | One existing project valid, normalized output digest matches pre-change baseline |
| PostgreSQL preservation | All 28 model counts/digests unchanged after fixture cleanup |
| HMAC/environment preservation | Existing file byte-for-byte unchanged, ignored/untracked, no regeneration |
| OpenAPI JSON | Unchanged from pre-migration baseline |
| API `/api/v1/ready` | HTTP 200, ready, after server restoration |
| Frontend localhost:3000 | HTTP 200 after server restoration |
| `git diff --check` | Passed |

The integration suite preserves B1 hashing/legacy upgrade races, B2 atomic registration, B3 HTTPS/cookies/proxy trust, B4 multi-instance IP limits/outage/recovery, B6.1 sanitized logging/malformed identifiers, B6.3 HMAC account admission/recovery/fail-closed behavior, session ownership and project isolation. All four B6.5 deepmerge tests pass, including the actual Prisma/c12 Map-compatibility path and cycle/prototype inputs. No limiter threshold or security behavior was relaxed.

Fresh advisory metadata is stored in `phase-b6-6-dependency-audit.json`. Zero audit findings are one verification result, not the sole basis for migration success or a guarantee against undisclosed vulnerabilities.

## 6. Data and secret integrity

All 28 Prisma model delegates were read for count/digest snapshots before testing and again after the existing suites cleaned their uniquely named fixtures. No existing account, session, project, revision, audit or catalog record changed. No schema migration, reset, truncate or seed was run. The existing project was additionally parsed with the old and new compiled contracts and its normalized-output digest matched; no stored configuration was rewritten.

The ignored local .env remains mode 0600, untracked and unchanged as a whole file. Its HMAC value was not rotated, exposed or regenerated. Scans of repository files, verification logs and generated client-static assets found no match for the existing secret. Existing subprocess log tests also assert absence of their fixture HMAC key/digest, email, passwords, session tokens and raw query markers. These claims cover inspected outputs, not every external log system or repository-history revision.

## 7. Exact phase files

- `apps/api/package.json`, `packages/contracts/package.json`: pin Zod 4.6.6 together.
- `package.json`: exact-parent tooling Zod pin; earlier security overrides/patch registration retained.
- `pnpm-lock.yaml`: fixed Zod and matching lint-peer resolutions; no broad unrelated upgrades.
- `packages/contracts/src/index.ts`: local error options, old email pattern, integer compatibility and bounded duplicate refinement.
- `packages/contracts/src/validation-errors.ts` (new): schema-local compatibility messages/pattern.
- `tests/fixtures/zod3-contract-baseline.json` (new): pre-change synthetic corpus.
- `tests/zod-migration.test.ts` (new): four focused compatibility/resource tests.
- `tests/api.integration.ts`: real HTTP message/envelope regressions.
- `docs/backend/phase-b6-6-zod-migration.md`, `docs/backend/phase-b6-6-dependency-audit.json` (new): final report and audit snapshot.

No React visual component, CSS/layout/icon/animation, worker feature, PostgreSQL schema, authentication implementation, HMAC key or rate-limit policy changed. Earlier working-tree changes were preserved.

## 8. Deployment and Phase C recommendation

Deploy API and shared contracts together, rebuild the frontend and install using the frozen pnpm lockfile. Do not run a newly upgraded API error class against stale compiled Zod 3 contracts: validation errors would miss the expected instanceof branch. Keep the existing HMAC key, Redis namespace and sessions/data intact. Retain the B6.5 Prisma patch file and its exact-version override in deployment artifacts.

The tooling pin is scoped to react-hooks 7.1.1. Review it when changing that owner, and run the corpus/error/ownership/security tests on future Zod updates. When adding new schema constructs, deliberately extend compatibility messages/tests rather than relying on an unreviewed locale change. Do not replace the bounded-array checks with an unbounded validator or reconstruction of all element issues.

The remaining operational limitations are unchanged: local-file JSON.parse still reads the selected file before schema validation; production request/edge limits, TLS/proxy sanitation, Redis ACL/durability/memory settings, and B6.3 recovery-window/capacity trade-offs need deployment-specific validation. This phase did not certify production traffic capacity or eliminate every account-abuse risk.

**Recommendation:** the known dependency-remediation blocker is resolved and local functional/security gates pass. Phase C may be considered after explicit approval, with deployment risks tracked separately; it has not been started automatically. No follow-on feature or unrelated hardening was implemented.
