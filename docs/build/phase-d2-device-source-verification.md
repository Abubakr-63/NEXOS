# Phase D2 — Verified Android source and device compatibility foundation

Reviewed: 2026-10-29. Scope: internal contracts, reviewed metadata and read-only assessment. **No Android build or production deployment is authorized.**

## 1. Existing implementation audit

The Prisma catalog holds seven real devices / eleven active identified variants and preserved deprecated fictional variants. Manufacturer → device → variant relationships carry model number, region, codename, source URLs and review metadata. The Redmi Note 10 (`mojito`), Pixel 6/7/8 (`oriole`/`panther`/`shiba`), Galaxy S10/S10e (`beyond1lte`/`beyond0lte`) and OnePlus 7 Pro (`guacamole`) identities are catalog evidence, not ROM build recipes. All existing build support remains `NOT_VERIFIED`. No catalog seed was run in D2.

`packages/database/prisma/catalog-data.ts` records AOSP Android 16 r4 and LineageOS 23.2 source metadata. Availability of either base does not establish compatibility with a phone. `ROMProject` persists version-1 JSON configurations and revisions, without device/base compatibility attestations. Kernel selection is still `unconfigured`; app/preset/accent selections are intent, not implemented Android transforms.

`validateConfiguration` remains `foundation-1` / `UNKNOWN`. The older utilities compatibility evaluator infers states from rules/source links; it is not used as build evidence by D2. Existing project build POST continues ownership/origin/validation checks and returns 503. The worker only supports infrastructure probes. There is no compiler, source resolver, build recipe, artifact publisher or flashing implementation.

The frontend continues consuming the unchanged catalog, draft, validation and build contracts. Cuttlefish was not inserted into the phone selector. No frontend file was changed in D2.

## 2. Official sources and verification limits

Official pages and small source files were inspected on 2026-10-29. Network access was intermittent; seven successfully retrieved upstream files are retained as offline observations under `tests/fixtures/android-source/aosp16-r4/` (about 150 KB of contents, not a source checkout). Their exact paths, repository commits, SHA-256 digests and Git blob IDs are recorded in `apps/api/src/build-targets/cuttlefish.ts`; tests verify the bytes and relevant declarations.

| Repository / official tag page | Release tag → commit |
| --- | --- |
| [platform/manifest](https://android.googlesource.com/platform/manifest/+/android-16.0.0_r4) | `15128c9e27cfa599c48d294babd39286ee8f1426` |
| [device/google/cuttlefish](https://android.googlesource.com/device/google/cuttlefish/+/refs/tags/android-16.0.0_r4) | `4d368849922b04124e66b1aad48f93b3209f3c8d` |
| [platform/build/release](https://android.googlesource.com/platform/build/release/+/refs/tags/android-16.0.0_r4) | `0998133091794b56253fd6bd5c33ed0e0e5bd9de` |
| [platform/build](https://android.googlesource.com/platform/build/+/refs/tags/android-16.0.0_r4) | `b815dded1eafbf06191a6ae306956bb6ed6fb415` |

Official tag pages bind these release refs to commits. The Cuttlefish tree API also confirmed AndroidProducts.mk blob `ff5f2cc4605cd84ed1def1983592e27bcdea9bb4`; its locally computed Git object ID agrees. SHA-256 protects retained observation integrity. This is HTTPS source inspection and object consistency verification, **not independent GPG signature verification** or full transitive source attestation.

The manifest observation was retrieved at `refs/tags/android-16.0.0_r4`; other source files were retrieved at the immutable commits above. The manifest maps `build/make` to `platform/build`, `build/release` to `platform/build/release` and `device/google/cuttlefish` to its corresponding repository. These mappings and default release ref were inspected.

## 3. Proposed immutable source pin

The first reviewed baseline is historical Android 16 tag `refs/tags/android-16.0.0_r4`, manifest commit `15128c9e27cfa599c48d294babd39286ee8f1426`, manifest path `default.xml`. It is not claimed to be the newest release, a supported production security baseline, or a complete reproducible source lock.

The manifest still delegates most projects to a release tag. Before source provisioning, resolve **every** project/include/local-manifest/prebuilt/tool input to immutable object IDs, verify origin/signatures and licenses, record content digests and approved patches, and retain the resolved manifest. Four reviewed repository commits do not close that dependency graph. Mutable `latest` / branch refs are not accepted by the new immutable-ref contract. Even other syntactically valid immutable refs cannot match the sole reviewed candidate.

## 4. Cuttlefish candidate definition

| Field | Reviewed declaration |
| --- | --- |
| Candidate ID | `aosp16-r4-cuttlefish-x86_64-userdebug-v1` |
| Kind | Virtual Android target, not a physical phone |
| Android version | 16 |
| Product | `aosp_cf_x86_64_only_phone` |
| Product file | `vsoc_x86_64_only/phone/aosp_cf.mk` |
| Product device | `vsoc_x86_64_only` |
| Architecture | `x86_64`, architecture variant `silvermont` |
| Release configuration | `aosp_current`, resolved at this release to `bp4a` |
| Build variant | `userdebug` |
| Customization scope | `UPSTREAM_BASELINE` only |
| Candidate lunch string | `aosp_cf_x86_64_only_phone-aosp_current-userdebug` |

The pinned AndroidProducts.mk maps the product to the retained product file; BoardConfig.mk declares x86_64; the release map binds aosp_current to bp4a and the retained release file declares bp4a. Pinned envsetup.sh implements product/release/variant selection. [Official build documentation](https://source.android.com/docs/setup/build/building) independently documents this exact example and userdebug. Its current example is not evidence of executing this historical release. COMMON_LUNCH_CHOICES in the pinned file does not enumerate this exact combination; it is a menu, not proof of preflight success. **Lunch, make, Repo sync and compilation were not executed.**

[Official host guidance](https://source.android.com/docs/setup/start/requirements) lists x86-64 Linux, glibc, Git, Repo, Python, Make, JDK and host development packages, with Ubuntu-oriented installation instructions and substantial RAM/disk requirements. That page currently discusses a newer release: its package instructions are guidance, not a pinned Fedora/Android-16 toolchain certification. D2 did not install tools or certify the local host. The measured local host has about 14 GiB reported RAM and 68 GiB available disk, below the documented 64 GB RAM / 400 GB free planning baseline. Matching Cuttlefish host packages, KVM access and boot tests remain separate future prerequisites.

## 5. Implemented evidence model and rules

`packages/contracts/src/build-evidence.ts` adds strict, additive Zod contracts for device identity, immutable refs, source observations, virtual selection and versioned evidence. Identity includes manufacturer/device/variant IDs, model, region, codename, hardware variant, deprecation and demo status. Observation includes repository, commit, path, Git blob and SHA-256. Credentials, query strings and fragments are rejected in provenance URLs. Evidence is trusted operator-reviewed metadata, **never client-supplied evidence**.

`apps/api/src/build-targets/cuttlefish.ts` owns one private version-1 registry entry and returns defensive copies. Its assessor consumes that internal entry, not a request's asserted verification state. Evidence expires after 30 days, rejects future/invalid review times and revoked/unverified records, and requires the complete observation set and matching manifest identity. Freshness means re-review is needed after that interval; it is not automatic security-update monitoring.

`apps/api/src/build-targets/physical.ts` reads existing variant/device rows and invokes the shared physical assessor. It does not mutate catalog or projects. Database outages propagate as infrastructure failures rather than being mislabeled as unknown hardware.

| Decision | D2 behavior |
| --- | --- |
| Configuration supported | Only the exact reviewed virtual tuple and upstream-baseline scope; no physical recipe exists |
| Source target verified | Fresh, complete, matching reviewed **declarations** only; not source closure or successful build |
| Device identity | Cataloged vs unknown/inconsistent/deprecated; claims checked against resolved identity |
| Prerequisites | Always missing: full source lock, signature/license review, toolchain, lunch preflight, isolated executor |
| Physical components | Additionally missing: device tree, kernel/vendor provenance, firmware requirements, device/base evidence |
| Compiler | Always `UNAVAILABLE` |
| Physical device ROM | Always `UNVERIFIED` |
| Virtual device ROM | `NOT_APPLICABLE` |
| Build and flash eligibility | Literal `false`, with no request flag or prerequisite override to enable them |

These are **internal foundation functions**, not activated public routes. Existing v1 responses, OpenAPI document, authentication and authorization remain unchanged. Future API exposure needs an explicit contract phase; no speculative endpoint was added. Existing drafts retain their schema and acceptance semantics.

## 6. Files changed by D2

- `packages/contracts/src/build-evidence.ts` — evidence schemas and conservative policy.
- `packages/contracts/src/index.ts` — additive export only.
- `apps/api/src/build-targets/cuttlefish.ts` — private reviewed candidate and wrapper.
- `apps/api/src/build-targets/physical.ts` — read-only catalog adapter.
- `tests/build-evidence.test.ts` — six focused regression tests.
- `tests/api.integration.ts` — one additional read-only real-catalog test; earlier phases' tests preserved.
- `tests/fixtures/android-source/README.md` and seven files in `aosp16-r4/` — retained upstream observations with original notices where supplied.
- This report.

The workspace already contained changes from earlier phases; those are not D2 changes. Ignored `.local/d2-*` verification logs/helpers are local evidence, not application code. No dependency, schema, environment, catalog seed or UI change was made.

## 7. Verification results

Final verification results are recorded below after all D2 code changes. No Android compilation was part of the production application build.

| Command / check | Final result |
| --- | --- |
| `pnpm typecheck` | Passed; all seven workspace tasks successful, four cached |
| `pnpm lint` | Passed; all seven workspace tasks successful, four cached; repository API lint convention is TypeScript checking, web uses ESLint |
| `pnpm test` | 57 passed, 0 failed/skipped (six new D2 unit cases) |
| `pnpm test:integration` | 19 passed, 0 failed/skipped, about 59.2 s (one new read-only D2 test) |
| `pnpm test:e2e` | 6 passed, about 12.7 s, Chromium against production application servers |
| `pnpm build` | All seven tasks successful, three cached; API/worker TypeScript and Next.js production build successful |
| `pnpm audit --json` | 0 advisories at every severity; 636 audited dependencies |
| `pnpm audit --prod --json` | 0 advisories at every severity; 267 audited dependencies |

The existing suites exercised password hashing/legacy upgrades, atomic registration rollback, sessions and ownership, cookies/proxies, Redis IP/account limiters including concurrent/outage cases, sanitized errors/logging, shared contracts, pagination and OpenAPI. Browser coverage includes authentication, persisted unverified drafts, catalog failures and desktop/mobile navigation. D2 did not add real user credentials or use existing accounts for tests. Existing tests create and clean their own isolated fixtures.

An earlier integration pass failed the new D2 identity assertion while the region field and built contracts were being aligned. The corrected focused catalog test and final complete 19-test run passed. An initial new unit test's call to the existing validator omitted its required second argument; type checking caught this and it was corrected before the final runs. These preliminary failures are not counted as successful runs.

Integrity: a read-only pre-D2 snapshot and post-suite comparison checked count plus SHA-256 of sorted serialized rows for **all 28 Prisma models**: all unchanged. No schema migration, data reset, seed, reassignment or persistent user/project change occurred. The prior D1 legitimate concurrent project/revision additions were part of the D2 baseline and remain preserved. Verification fixtures were cleaned by the existing test harness.

The full root `.env` SHA-256 matches the pre-D2 snapshot; the file remains Git-ignored and untracked. A value-based scan of repository files, D2 logs and client static assets found zero occurrences of the configured HMAC secret, database connection URL or its password. No secret values or database rows are included in this report. This verifies checked values/locations, not a universal secret-scanning guarantee.

Local API and web services were stopped for isolated regression/production-build checks and restarted afterward using `PORT=4000 pnpm dev:api` and `PORT=3000 pnpm dev:web`. Final operational checks returned HTTP 200 for API `/api/v1/health`, `/api/v1/ready`, `/api/v1/devices`, `/api/v1/android-bases` and frontend `http://localhost:3000`. PostgreSQL/Redis remained running; readiness succeeded. Database and environment comparisons were repeated after service restoration with the same unchanged results. These are local development checks, not production deployment verification.

## 8. Unresolved prerequisites and recommendation

Source declarations are verified; full source provenance, signature trust, redistribution rights, toolchain closure, lunch resolution, supported resource capacity, isolation, lifecycle persistence and execution remain unverified/unimplemented. No physical phone has a reviewed device/base recipe. App selection, theme and preset intentions are not mapped to verified source transformations. No successful boot, hardware test or reproducible output exists.

D3 may be proposed for a dedicated, resource-qualified isolated source-provisioning/preflight design: resolve the complete manifest, approve provenance/licenses/tools, record immutable inputs, then separately approve execution. A future durable design could use versioned BuildTargetProfile, SourceObservation and SourceLock records linked to a specific source/device recipe and review history. Those are **proposals only**: no PostgreSQL migration or new build-job model was implemented. Any schema changes need separate approval and preservation/migration tests.

**D2 foundation complete subject to verification below; actual compilation, phone support, flashing and public production deployment remain NO-GO. D3 has not begun.**
