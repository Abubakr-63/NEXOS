# Phase B6.4 — Remaining dependency security assessment

Reviewed 2026-10-28, Asia/Dushanbe. B6.2/B6.3 reports and the latest available audit were read first. Scope: the remaining Zod and deepmerge-ts advisories, isolated compatibility assessment, security regression verification and an approval-ready migration proposal.

## Outcome

**No dependency upgrade was applied. Both remaining advisories require published major-version fixes with demonstrated behavior changes.** Installing them automatically would violate this phase's change-control constraints. No compatible published same-major security fix was found. The current full and production audits remain **2 high, 0 moderate, 0 low, 0 critical** and exit 1. These audits did not pass.

The preserved application passes the complete available checks: TypeScript, lint, 26 unit tests, 12 integration tests, 6 E2E tests and production build. PostgreSQL count/digests match across all 28 models. The existing ignored HMAC secret was not regenerated; the entire local environment file is byte-for-byte unchanged. API/frontend services were restored after verification and readiness was checked.

This phase produces a specific migration proposal rather than a forced major override, a private security-library fork or a misleading clean-audit claim. **Phase C remains on hold.**

## 1. Remaining advisories and dependency paths

| Package | Installed / advisory | Affected → fixed | Exposure and impact |
| --- | --- | --- | --- |
| Zod | 3.25.76; High [GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `<4.6.6` → `>=4.6.6` | Production request/browser validation and development tooling. Collection validation can accumulate excessive element issues, consuming memory/availability. A dependency advisory is not itself a demonstrated remote NEXOS OOM exploit. |
| deepmerge-ts | 7.1.5; High [GHSA-ggr8-5vv4-36mx / CVE-2026-40345](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | `<8.0.0` → `>=8.0.0` | Prisma configuration tooling in development/CI/deployment, also included in the production dependency graph. Merging aligned cyclic object graphs can recurse until stack exhaustion. No public API merge entry point was found. |

Verified with installed resolution, `pnpm --recursive why zod`, filtered `why deepmerge-ts`, registry metadata and fresh audits:

- Zod direct: `apps/api > zod@3.25.76`, `packages/contracts > zod@3.25.76`.
- Zod production web: `apps/web > @rom-hub/contracts > zod@3.25.76`.
- Zod development: `apps/web > eslint-config-next@16.4.3 > eslint-plugin-react-hooks@7.1.1 > zod`, including the `zod-validation-error@4.0.2` peer edge. A migration must inspect these additional resolutions rather than assume changing one direct dependency removes every finding.
- deepmerge development/tooling: `packages/database > prisma@6.19.0 > @prisma/config@6.19.0 > deepmerge-ts@7.1.5`.
- deepmerge production graph: `apps/api > @prisma/client@6.19.0 > prisma@6.19.0` peer path, then the same configuration chain. Production graph inclusion does not establish request-time execution.

Registry review found Zod's latest 3.x release is still 3.25.76. deepmerge-ts 7.1.6 exists but remains within the advisory's affected range; it is not a security remediation. Fixed deepmerge releases include 8.0.0 through 8.0.2. Checking `@prisma/config@6.19.2` and `6.19.3` showed both still pin deepmerge-ts 7.1.5, so a Prisma 6 patch bump would not resolve this advisory. No unrelated Prisma/Effect patch was applied merely because it is newer. Candidate versions actually evaluated were Zod 4.6.6 and deepmerge-ts 8.0.0.

## 2. Zod root cause, reachability and inventory

The installed Zod 3 array parser (`zod/v3/types.cjs`, ZodArray._parse) records a maximum-length issue and marks parsing dirty, but continues parsing every element with a map. Thus an application `.max(4)` rejects the value but does not prevent per-element issue allocation. This local source observation is distinct from the advisory's affected-range classification.

All source imports and schema consumers were inspected:

| Location | Contract / effect of migration |
| --- | --- |
| `packages/contracts/src/index.ts` | Sole shared runtime schema source; authentication, catalog/device queries, ROM configuration, revisioned saves, metadata and compatibility-validation helper. Exports inferred ROMConfiguration type. |
| `apps/api/src/app.ts` | Direct ZodError import/classification; issue paths/messages form public HTTP 400 message arrays. Registration/login parse before account lookup/KDF. Device and legacy catalog queries parse pagination. Project creation/update parse configuration; detail/validation/build paths parse stored configurations. |
| `apps/web/components/project-creation.tsx` | Metadata safeParse and error.issues display; configuration parsing before save. |
| `apps/web/components/project-details.tsx` | Metadata parsing and displayed validation errors before update. |
| `apps/web/components/studio.tsx` | Configuration parsing before save and import; imported files use `JSON.parse(await file.text())` before Zod validation. |
| `apps/web/lib/project-api.ts` | Type-only ROMConfiguration dependency; HTTP response JSON is cast to T, not runtime-parsed by Zod. There is no additional response-schema migration to invent here. |
| Tests | Schema normalization/bounds, authentication, account HMAC normalization, configuration persistence and browser flows consume the same contracts. |

The only collection schema in the current shared contract is the four-entry enum application array, with duplicate detection. Other fields are bounded strings, literals/enums, booleans, integers and strict objects. No application Zod map/set/record/union collection schema was found. This limits currently exposed schema complexity, but does not make the installed vulnerable library safe.

On the API, Fastify's 32 KiB request body limit, existing network/account admission and bounded routes reduce exposure. They do not prove memory safety, and authenticated project inputs still reach the parser. Browser project-file import is not covered by the server body limit; a user importing a malicious large local file can expose their tab to parsing/issue amplification. No oversized/OOM payload was executed and no public-production exploit is claimed.

### Isolated compatibility results

Candidate tarballs were downloaded/unpacked only under ignored `.local/b64-candidates`. They were **not installed in the workspace**, and no manifest, lockfile, application import or node_modules resolution was changed. The actual shared contracts source was transpiled and evaluated with the existing Zod and the isolated 4.6.6 candidate. This was a runtime comparison, not a full candidate TypeScript build.

Twelve finite samples covered normalization, authentication errors, selected email forms, query defaults/coercion/errors, default ROM configuration, invalid applications, metadata and revisioned saves. Acceptance matched in these samples, but **six outcomes changed in messages/issue codes/counts**. Examples:

- Invalid email changed from `Invalid email` / `invalid_string` to `Invalid email address` / `invalid_format`.
- Invalid query-number messages changed, affecting the API's existing message arrays.
- A tiny 16-invalid-application sample produced 17 issues in the installed version versus one size issue in 4.6.6. The fixed parser avoids traversing this oversized constrained array; this is a bounded behavior probe, not an OOM test.
- A Zod 4 error is not an instance of the current Zod 3 API error class. Updating only contracts would cause validation errors to miss the HTTP 400 branch and reach the generic error path.

The [official migration guide](https://zod.dev/v4/changelog) documents error-format and other behavioral changes. Passing a small valid-input sample does not establish complete API compatibility, TypeScript inference compatibility or equivalence for historical stored configurations. A successful typecheck on the current version is not a candidate Zod 4 typecheck. The archived `apps/web/package-lock.original.json` mentions Zod 4 but is not the active pnpm lockfile and does not establish migrated behavior.

## 3. Deepmerge root cause and actual execution

The installed `@prisma/config/dist/index.js` dynamically imports deepmerge-ts in `loadConfigTsOrJs` and supplies `deepmerge` as c12's `merger` callback. This is configuration-file loading, not Nest controller request processing. That loader disables dotenv, rc files, remote giget extensions, default extensions and package.json config loading in this path. No application source imports deepmerge-ts directly, and no repository Prisma config file was found supplying cyclic graphs.

Ordinary JSON cannot encode the self-reference required by this advisory. The public API neither accepts executable Prisma configuration nor forwards request objects into this merger. Exploitation through a hostile JS/TS Prisma config assumes access to trusted local/deployment configuration that already runs code; it is not equivalent to unauthenticated project JSON causing an API merge. Tooling/plugin configuration can nevertheless contain object graphs, and the affected installed dependency remains unresolved.

In a separate local process, two tiny self-referencing objects reproduced a caught RangeError using 7.1.5. Candidate 8.0.0 safely preserved the cycle. No production process, database, recursive large payload or heap exhaustion was involved.

However, the [8.0.0 release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) also changes Map value merging, mutation behavior and utility APIs. A finite Map probe demonstrated that installed behavior yields `{right: 2}` for a colliding key while the candidate yields `{left: 1, right: 2}`. A plain record/array sample matched, which does not establish general equivalence for Prisma config/adapters/plugins. Current Node 22 can load the candidate's CommonJS/ESM entry points, but loadability is insufficient to approve its semantics.

### Alternatives considered

- A direct 7.1.6 bump stays vulnerable according to the advisory; rejected as a security fix.
- Prisma 6.19.2/6.19.3 still carry the vulnerable pin; rejected as ineffective for this objective.
- A global deepmerge 8 override would change all consumers' semantics; not applied.
- A scoped major override could be evaluated after approval, but still changes the vendor-pinned dependency and requires the configuration tests below.
- A private 7.x cycle-detection backport or adapter that changes merger behavior creates a maintained security fork. No verified vendor-supported same-major backport was found; this is not automatically safer than a reviewed major migration.
- Removing Prisma/config dependencies to hide the finding would change generation/deployment behavior and would not be a demonstrated security fix.

## 4. Approval-ready migration proposal

No approval is inferred from this task to perform the following breaking changes. They are proposed for a separate phase.

### Priority 1: coordinated Zod migration

1. Approve moving **both** `apps/api/package.json` and `packages/contracts/package.json` from Zod 3.25.76 to a fixed Zod 4 release, initially 4.6.6 as the tested minimum; reassess the chosen patch against the then-current audit before installation. Inspect ESLint/plugin peer paths and ensure no vulnerable active copy remains.
2. Keep shared schemas and API error classification on the same runtime/class. Preserve lowercase account identifiers, password limits, strict-object rejection, trimming/defaults, duplicate applications, pagination coercion/bounds and revision checks. Do not modify hashing, HMAC identities, cookies, sessions or limiter policies.
3. Decide explicitly whether to preserve existing error texts/counts using a small compatibility error mapper or approve the changed validation messages. Maintain the existing `{error:{status,message,requestId}}` shape and 400 classification. Prefer preserving the error contract; do not rebuild every old per-element issue for oversized arrays, which would undo the security benefit.
4. Before rollout, create focused regression fixtures for all exported schemas: valid/invalid/default/unknown-key/boundary cases, normalization (including account-HMAC equivalence), duplicate/oversized apps, save revisions, and inferred output/input type expectations. Use synthetic historical configuration fixtures; do not rewrite existing PostgreSQL JSON.
5. Add bounded resource tests in isolated child processes for invalid collections, plus actual HTTP 400 assertions and browser file-import checks. Decide separately whether a local import file-size guard is required; a library migration does not prevent JSON.parse itself from reading an arbitrarily large file.
6. Run full TypeScript, lint, unit/integration/E2E, production build, audit, secret checks and all-model data preservation. Roll back code/manifests/lockfile together if any contract or auth regression appears; no database migration is necessary or proposed.

### Priority 2: Prisma configuration dependency remediation

1. Prefer a supported Prisma release whose own dependency graph carries fixed deepmerge-ts; verify this rather than assuming a later Prisma major fixes it. Any Prisma major requires its own engine/client/config migration approval and matching versions.
2. If vendor remediation remains unavailable, seek explicit approval for a narrowly scoped `@prisma/config@6.19.0>deepmerge-ts` 8.x override. Candidate 8.0.0 is the minimum evaluated here; choose a fixed patch only after re-auditing it. Do not replace the generic merger with an unsafe entry point.
3. Add focused config-loader fixtures through the **actual Prisma/c12 path** for nested records, arrays, Maps/Sets, undefined/null values, custom adapter instances and bounded cyclic graphs. Establish expected Map semantics with the vendor/maintainer rather than assuming every config is JSON. Existing valid/invalid config tests are necessary but insufficient for a major override.
4. Verify Prisma client generation, schema validation, migration **status**, engine compatibility, API startup/readiness and persistence/auth regressions without executing schema changes. Preserve current users, sessions, projects and HMAC key. Keep the override documented and remove it when upstream supplies the fixed dependency naturally.

## 5. Verification actually executed

| Command/check | Result |
| --- | --- |
| `pnpm typecheck` | Passed; root tsc plus seven workspace tasks; unchanged workspace results cached |
| `pnpm lint` | Passed; seven cached workspace tasks using existing lint conventions |
| `pnpm test` | 26 passed, 0 failed |
| `pnpm test:integration` | 12 passed, 0 failed; real PostgreSQL/Redis |
| `pnpm test:e2e` | 6 passed; production application servers |
| `pnpm build` | Passed; seven workspace tasks, six cached |
| `pnpm db:validate` | Valid schema |
| `pnpm db:status` | Three migrations, up to date; no migration applied |
| `pnpm audit --json` | Exit 1: 2 high, 0 moderate/low/critical |
| `pnpm audit --prod --json` | Exit 1: same totals |
| Twelve candidate schema samples + tiny Map/cycle probes | Executed in isolation; incompatibilities confirmed as described |
| Existing-data comparison | All 28 model counts/digests unchanged after test fixture cleanup |
| `git diff --check` | Passed |

The existing suite covers B1 hashing/legacy upgrade races; B2 atomic registration rollback/duplicates; B3 HTTPS cookie/proxy behavior; B4 multi-instance IP limits and Redis outage/recovery; B6.1 sanitized logging and malformed identifiers; B6.3 account admission, expiry, recovery, privacy and fail-closed behavior; and project ownership isolation. No rate limit, auth behavior or account-aware policy was weakened to make tests pass.

There is no changed dependency behavior to add new production regression tests for in this phase: no application or dependency modification was accepted. Candidate probes document why approval is needed; they are not presented as a completed candidate migration test suite or as production exploit tests. Their public, non-secret results are preserved in `phase-b6-4-compatibility-assessment.json`.

### HMAC and data preservation

The local environment file was ignored by Git, not tracked, and remained mode 0600. A before/after whole-file digest confirmed byte-for-byte preservation, without printing the file, key or digest. No secret generator was run and the configured HMAC value was not rotated. Existing tests use ephemeral fixture keys without replacing the configured secret.

The existing HMAC value was absent from 117 tracked files, eight B6.4 verification logs and 23 generated client-static files scanned. Existing API logging tests separately assert that their actual fixture HMAC key/digest, email, passwords and session tokens are absent from captured subprocess output. These checks establish absence in the inspected outputs, not a universal statement about every external log system or repository-history revision.

Read-only baseline digests covered all 28 Prisma model delegates, including sessions, audit and catalog. No changes remained after the existing tests cleaned their uniquely named fixtures. No reset, truncate, seed, schema migration, existing-password change or existing-session deletion was used. The dependency assessment did not run database writes.

## 6. Exact files and versions

New files in B6.4 only:

- `docs/backend/phase-b6-4-dependency-remediation.md`: this assessment/proposal.
- `docs/backend/phase-b6-4-dependency-audit.json`: fresh full/production advisory metadata.
- `docs/backend/phase-b6-4-compatibility-assessment.json`: finite isolated candidate behavior results.

**Dependency versions modified: none.** Zod remains 3.25.76 and deepmerge-ts remains 7.1.5. Earlier Fastify/Effect/YAML overrides and B6.3 implementation were preserved. No manifests, lockfiles, frontend code/design, schema, auth logic, HMAC value or environment configuration were changed in this phase. Candidate tarballs, probe scripts and logs are ignored local artifacts, not application dependencies.

## 7. Operational risks and Phase C decision

The two advisories remain visible and must not be waived solely because the current deployment has request bounds or trusted config files. Zod has the more direct production input path and should be prioritized. Deepmerge's current public-request reachability is lower, but tooling/deployment integrity still matters. Keep request limits, trusted config provenance, dependency lockfiles and existing Redis/proxy security controls intact during any migration.

The approved migration must deploy API/contracts together, rebuild the browser bundle and retain the existing HMAC secret, Redis namespace and persisted sessions/data. Validate deployment-specific TLS/proxy/Redis permissions and capacity separately; local tests do not certify them. An updated package manifest without a rebuilt/rerolled runtime does not establish remediation.

**Backend is not cleared to proceed to Phase C.** B6.4 investigation and verification are complete; vulnerability remediation remains pending approval of the concrete major-version plans above. Stop here without implementing Phase C or another phase automatically.
