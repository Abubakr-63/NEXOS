# Phase B6.5 — Targeted deepmerge security migration

Reviewed 2026-10-29, Asia/Dushanbe. Read B6.4, B6.2 and the latest advisory snapshot before implementation. Scope is the deepmerge migration only. Zod, authentication policies, frontend design and PostgreSQL schema remain unchanged.

## Outcome

**Resolved GHSA-ggr8-5vv4-36mx using deepmerge-ts 8.0.2, with a narrowly scoped Prisma-loader compatibility patch.** Full and production audits decreased from two high advisories to **one high advisory: Zod**. There are no moderate, low or critical findings in these audits. They still exit 1 and are not clean security checks.

TypeScript, lint, production build, 30 unit tests, 12 integration tests and 6 E2E tests pass. All 28 PostgreSQL model counts/digests match the pre-test baseline after fixture cleanup. The existing HMAC environment file is byte-for-byte unchanged, ignored by Git and untracked. API and frontend development services were restored after testing.

**Phase C remains on hold.** No B6.6 work was started.

## 1. Exact vulnerability and dependency chain

[GHSA-ggr8-5vv4-36mx / CVE-2026-40345](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx) affects deepmerge-ts versions below 8.0.0. Aligned self-referencing records passed to the public merge functions can recurse until stack exhaustion. The supported 8.x implementation tracks circular references; simply changing a manifest would not establish that the actual consumer uses the fix.

Before:

```text
packages/database > prisma@6.19.0 > @prisma/config@6.19.0 > deepmerge-ts@7.1.5
apps/api > @prisma/client@6.19.0 > prisma@6.19.0 (peer) > same config chain
```

After, both paths resolve deepmerge-ts **8.0.2** through the patched @prisma/config 6.19.0. `pnpm --recursive why deepmerge-ts`, actual module resolution tests, successful Prisma CLI operations and fresh audits verify the installed path. No active resolved 7.x copy remains in this dependency graph. Ignored candidate tarballs/cache files from B6.4 are not application dependencies.

The caller is @prisma/config's `loadConfigTsOrJs`, which supplies a merger to c12. No direct NEXOS source imports deepmerge-ts or accepts executable Prisma config from an HTTP endpoint. Ordinary JSON cannot represent the cyclic graph in this advisory. Current exposure is configuration tooling in development/CI/deployment, although the package is also in the production dependency graph through Prisma. This is an installed dependency vulnerability, not a demonstrated unauthenticated project-API crash.

## 2. Options evaluated in order

| Option | Finding / decision |
| --- | --- |
| Update owning dependency | Registry metadata for @prisma/config 6.19.3 still pins vulnerable deepmerge-ts 7.1.5. The current 7.10.1 owner carries 8.0.2 but would introduce a broader Prisma/config migration. Kept Prisma/client/config at 6.19.0 to remain within this task. |
| Migrate direct NEXOS consumers | None exist. The single identified consumer is Prisma's c12 configuration loader. |
| Replace merge operations | A custom recursive merge implementation/backport would create unnecessary security and maintenance risk. No recursive merging algorithm was added. |
| Scoped override, after compatibility tests | Selected `@prisma/config@6.19.0>deepmerge-ts: 8.0.2`, plus the necessary consumer compatibility patch described below. No global deepmerge override was used. |

8.0.2 includes the cycle fix and the corrected Node engine declaration documented in the [vendor release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.2). The repository's Node 22 meets its >=16.9.0 requirement. No unrelated dependency upgrade or forced installation was performed.

## 3. Compatibility problem and controlled implementation

B6.4 correctly identified that v8 changes Map merging: colliding record-valued entries merge recursively instead of retaining the last entry's value. An unadapted override would therefore change the configuration merger's semantics. v8 also changes deepmergeInto mutation behavior and utility types, but Prisma's identified call site does not use those APIs/types.

The pnpm patch changes only the merger construction in @prisma/config's distributed loader:

```js
const { deepmergeCustom } = await import("deepmerge-ts");
const deepmerge = deepmergeCustom({
  mergeMaps: (values) => new Map(values.flatMap((value) => [...value]))
});
```

This uses the fixed vendor library's supported customization hook to preserve the legacy Map strategy: iterate source Maps in order, retain disjoint keys, and let the last entry replace a colliding value. This also preserves null/undefined Map values and reference identity. It does not implement recursive object merging, prototype handling or cycle detection; those remain in the fixed library. The existing c12 merger call site and configuration order are retained.

For environment-layer fixtures, the actual installed c12 path passes the environment layer first and the main config last. Tests preserve that observed order, including array concatenation and Map precedence; no new precedence policy was invented.

Only a five-line addition/one-line replacement is made in the vendor loader. It is stored reproducibly in `patches/@prisma__config@6.19.0.patch` and registered with pnpm patchedDependencies. The lockfile records the patch hash and fixed dependency resolution. It is not an untracked edit to node_modules and does not patch deepmerge's security algorithm.

Preserved behavior tested through the actual Prisma/c12 loader:

- Nested records combine; arrays concatenate in the existing order.
- Disjoint Map entries survive; colliding values retain last-entry-wins semantics, including undefined, null and class-instance references.
- Sets retain their union behavior.
- Null values replace earlier record values; undefined record values retain the earlier defined value under the vendor's existing filtering policy.
- Class instances and adapter factory functions retain identity/behavior. The adapter fixture never opens a database connection.
- Schema/migration paths resolve relative to the config file; seed commands remain intact.
- Invalid configuration continues to fail through the existing config-loader error path.

The fixture helper makes `$test` environment metadata non-enumerable: c12 can read it without passing an unknown control key into Prisma's strict final schema. Initial enumerable `$test` fixtures were rejected by that existing strict schema and were corrected. No production validation was weakened to accept the tests.

## 4. Focused security and regression verification

Four new tests in `tests/deepmerge-security.test.ts` exercise the installed fixed copy and the actual Prisma loader:

1. Assert deepmerge resolves to 8.0.2; merge two tiny cyclic records and test deepmergeInto without stack exhaustion; check no Object.prototype pollution from JSON `__proto__` and constructor/prototype payloads; verify normal nested-record/array merging leaves source data unchanged.
2. Load a real c12 environment-layer fixture through Prisma, checking records, arrays, Maps, Sets, null/undefined, reference identity and relative paths.
3. Load and invoke a test adapter factory through Prisma without calling its connection methods.
4. Pass aligned cycles and prototype payloads through the actual patched loader; verify cycle preservation/no prototype pollution, and verify an enumerable throwing getter yields a controlled loader error.

The payloads are tiny, bounded test inputs. No heap-exhaustion payload, production exploit or public penetration test was run. Arbitrary executable configuration/getters are still trusted local code; these tests do not sandbox Prisma config execution.

| Executed command/check | Result |
| --- | --- |
| `pnpm typecheck` | Passed; root TypeScript and 7 workspace tasks |
| `pnpm lint` | Passed; 7 tasks using existing backend TypeScript lint and web ESLint conventions |
| `pnpm test` | **30 passed, 0 failed**, including all four new tests |
| `pnpm test:integration` | **12 passed, 0 failed**, real PostgreSQL/Redis |
| `pnpm test:e2e` | **6 passed**, Chromium against production application servers |
| `pnpm build` | Passed; 7 workspace tasks, 5 cached |
| `pnpm db:generate` | Prisma Client 6.19.0 generated successfully |
| `pnpm db:validate` | Schema valid |
| `pnpm db:status` | Three migrations up to date; no migration applied |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` | Passed; manifests/patch/lockfile agree |
| `pnpm audit --json` | Exit 1: **1 high, 0 moderate/low/critical** |
| `pnpm audit --prod --json` | Exit 1: same totals |
| All-model preservation | **28 checked, 0 changed** after fixture cleanup |
| `git diff --check` | Passed |

Existing coverage continues to verify B1 current/legacy hashes and upgrade races, B2 registration atomicity/rollback, B3 cookies/HTTPS/proxy handling, B4 distributed IP limits and real Redis outage/recovery, B6.1 log sanitization/input errors, B6.3 account HMAC admission/recovery/fail-closed behavior, sessions and project ownership/persistence. The browser suite verifies project creation/save/reload and frontend builds successfully. No limiter threshold or authentication contract was changed.

## 5. PostgreSQL, HMAC and environment preservation

Read-only count/digest baselines covered all 28 Prisma model delegates before testing, including existing users, sessions, projects, revisions, catalog and audit rows. After the existing tests cleaned their own uniquely named fixtures, every count/digest matched. No reset, truncate, seed, schema migration or pre-existing account/session/project edit was used. A comparison taken while the final integration fixture was still active showed temporary fixture rows; the reported result is the comparison after the suite completed and cleanup finished.

The ignored local .env remains mode 0600, untracked and byte-for-byte equal to its pre-task digest. Its HMAC secret was not generated, rotated, printed or changed. The current secret was absent from the repository files, B6.5 verification logs and generated browser-static assets scanned. Existing subprocess logging tests also continue to assert absence of their fixture key/digest, email, passwords and session tokens. These checks cover inspected outputs, not every external logging system.

API/web development processes were temporarily stopped for production build/E2E ownership, then restarted with the existing explicit per-service ports. PostgreSQL and Redis storage/services were not reset. Restored local readiness and frontend HTTP checks are recorded at completion.

## 6. Exact files and dependency versions changed

- `package.json`: one exact-parent deepmerge override and pnpm patchedDependencies registration; earlier overrides retained.
- `pnpm-lock.yaml`: 7.1.5 → 8.0.2 and the Prisma config patch hash/edges.
- `patches/@prisma__config@6.19.0.patch` (new): Map compatibility at the sole consumer.
- `tests/deepmerge-security.test.ts` (new): four focused security/loader tests.
- `docs/backend/phase-b6-5-dependency-audit.json` (new): final audit snapshot.
- `docs/backend/phase-b6-5-deepmerge-remediation.md` (new): this report.

Prisma, @prisma/client and @prisma/config remain **6.19.0**. Zod remains **3.25.76**. No frontend source/design, PostgreSQL schema, authentication/session implementation or environment variable/value changed. Earlier dirty files were preserved; the working-tree diff also contains previous phases.

## 7. Maintenance and operational risks

Ship the patch file, root manifest and lockfile together and install with the frozen lockfile. A deployment that omits the patch may acquire v8 Map semantics even though its advisory count improves. Upgrading @prisma/config requires explicitly rebasing/removing this exact-version patch and override and rerunning the loader/security tests; do not carry them forward blindly. Prefer an upstream-supported compatible owner update when available.

The override affects a vendor-pinned major dependency and therefore remains a documented maintenance responsibility despite passing this repository's compatibility tests. Tests cover the concrete consumer and representative config structures, not every possible plugin or adversarial executable configuration. No unsafe fast merge entry point was selected. Existing proxy, Redis durability/ACL/capacity and log-management requirements remain operational gates.

## 8. Remaining advisory and recommended B6.6 scope

Only High **GHSA-mrhx-c7xc-m3w5**, Zod 3.25.76 (`<4.6.6`, fixed `>=4.6.6`), remains in full and production audits. It is production-reachable through shared request/browser configuration validation. B6.4's reachability analysis and 32 KiB API/body-limit caveats remain applicable; browser file import is not protected by that network body limit.

Recommended B6.6, requiring a separate approved task:

1. Migrate API and shared contracts together to a fixed Zod 4 release and inspect lint-tool peer resolutions; avoid splitting ZodError classes.
2. Preserve account normalization/HMAC identity, auth/password bounds, strict-object validation, project defaults, duplicate apps, query coercion and revision behavior.
3. Explicitly decide validation-message compatibility while retaining the HTTP error envelope/400 mapping. Do not recreate unbounded element-error allocation to emulate old output.
4. Add schema/type and bounded resource regressions plus browser import checks, then rerun the full security suite, audit and data/secret preservation checks. No database migration is currently proposed.

**Phase C remains blocked by the unresolved Zod advisory and pending security/deployment review.** B6.5 stops here; no Zod migration, B6.6 or Phase C work was implemented.
