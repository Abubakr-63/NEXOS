# Curated device and Android source catalog

Reviewed: **2026-10-28**. Inventory: **7 devices / 11 exact variants**, plus **2 Android bases**. This is a source/identification catalog, not a build compatibility matrix.

## Devices and identifier evidence

| Manufacturer / device     | Codename   | Included model identifiers                           | Primary identification evidence                                                                                                                                                                                                                                      |
| ------------------------- | ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xiaomi Redmi Note 10 (4G) | mojito     | M2101K7AG                                            | [Xiaomi model guide](https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/2b53d1f52f4d79a46eee9d3dd6e4702f.pdf), [MiCode codename index](https://github.com/MiCode/Xiaomi_Kernel_OpenSource/blob/16d89a630ea8752c84bf4d76201964524d620616/README.md) |
| Google Pixel 6            | oriole     | GB7N6 (Sub-6), G9S9B (mmWave + Sub-6)                | [Google hardware model specifications](https://support.google.com/pixelphone/answer/7158570?hl=en), [AOSP device/codename table](https://source.android.com/docs/setup/reference/build-numbers)                                                                      |
| Google Pixel 7            | panther    | GVU6C (Sub-6)                                        | [Google hardware model specifications](https://support.google.com/pixelphone/answer/7158570?hl=en), [AOSP device/codename table](https://source.android.com/docs/setup/reference/build-numbers)                                                                      |
| Google Pixel 8            | shiba      | G9BQD (US/Canada Sub-6), GPJ41 (rest-of-world Sub-6) | [Google hardware model specifications](https://support.google.com/pixelphone/answer/7158570?hl=en), [AOSP device/codename table](https://source.android.com/docs/setup/reference/build-numbers)                                                                      |
| Samsung Galaxy S10        | beyond1lte | SM-G973F (Exynos)                                    | [Official LineageOS project data](https://github.com/LineageOS/lineage_wiki/blob/7ddd0afd7c4d0a599cda6a4ddb693aa394c78145/_data/devices/beyond1lte.yml)                                                                                                              |
| Samsung Galaxy S10e       | beyond0lte | SM-G970F (Exynos)                                    | [Official LineageOS project data](https://github.com/LineageOS/lineage_wiki/blob/7ddd0afd7c4d0a599cda6a4ddb693aa394c78145/_data/devices/beyond0lte.yml)                                                                                                              |
| OnePlus 7 Pro             | guacamole  | GM1911, GM1913, GM1917 (variant 1)                   | [Official LineageOS project data](https://github.com/LineageOS/lineage_wiki/blob/7ddd0afd7c4d0a599cda6a4ddb693aa394c78145/_data/devices/guacamole_variant1.yml)                                                                                                      |

Model identifiers are case-sensitive catalog facts. Region is explicitly **Not specified in cited source** unless the cited evidence identifies it. No regional meaning is inferred from a model suffix. Hardware descriptions distinguish the reviewed radio/SoC models. Architecture and supported Android-version arrays remain unset/empty where they have not been reviewed for this platform.

The Xiaomi manufacturer guide identifies the LTE model; the manufacturer's MiCode index identifies the mojito source family. This does not equate every Redmi Note 10-labelled device with mojito. M2101K7AI/sunny, Redmi Note 10 5G/10S/Pro, Samsung Snapdragon variants and OnePlus 7 Pro 5G/GM1915 are excluded from this reviewed subset. Other variants may be real but require their own evidence review.

`officialSourceUrl` means an official source from the cited publisher: manufacturer/Google documentation for Xiaomi/Pixel, and the official **LineageOS project** repository for Samsung/OnePlus. LineageOS project data is not OEM approval.

## Source availability and ROMCRAFT build status

- `catalogStatus: CATALOGED`: identity reviewed against the cited sources. This is not compilation or boot testing.
- `sourceStatus: SOURCE_AVAILABLE`: a reviewed maintained source/device tree was identified as of the review date. Pixel evidence includes [Google's documented kernel branches](https://source.android.com/docs/setup/build/building-pixel-kernels). Samsung and OnePlus evidence includes current-maintainer LineageOS metadata and pinned device-tree revisions stored per variant.
- Redmi Note 10 remains `UNREVIEWED` for maintained source availability. Its MiCode kernel publication is recorded, but an old kernel archive is not a reviewed maintained ROM device tree.
- `buildSupportStatus: NOT_VERIFIED` and compatibility `UNKNOWN` apply to **all** entries. `BUILD_VERIFIED` cannot currently be stored in the database enum. Enabling it requires a future evidence-bearing build model, genuine ROMCRAFT build results and a schema change. No compilation is implemented here.

Sources, branches and maintainership may change after the review date. The seed does not fetch live data or imply ongoing monitoring. Source availability never implies bootloader unlockability, firmware suitability, proprietary vendor availability, installation safety or a compatible ROM/base/kernel combination.

## Android bases

| Stable ID      | Base           | Android version | Source reference                         | Evidence                                                                                                                                                                                                                                        |
| -------------- | -------------- | --------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aosp-16-r4     | AOSP           | 16              | refs/tags/android-16.0.0_r4              | [Official release/version table](https://source.android.com/docs/setup/reference/build-numbers), [release manifest commit](https://android.googlesource.com/platform/manifest/+/15128c9e27cfa599c48d294babd39286ee8f1426)                       |
| lineageos-23.2 | LineageOS 23.2 | 16              | 9776e518de506f610218c4caa6c1fddff46873af | [Official pinned manifest](https://github.com/LineageOS/android/blob/9776e518de506f610218c4caa6c1fddff46873af/default.xml), [project version metadata](https://github.com/LineageOS/android_vendor_lineage/blob/lineage-23.2/config/version.mk) |

Both are `SOURCE_AVAILABLE` and `NOT_VERIFIED`. They are source-only draft choices, not promises that any selected device can build them. No automatic device/base relationships are seeded. These are reviewed versions, not a claim to be the newest release.

## Safe seeding and migration

The additive `20261028160000_real_catalog` migration adds provenance/status fields to DeviceVariant, Device.deprecatedAt, and a dedicated AndroidBase table. No existing column, account, project or revision is dropped or reassigned.

`pnpm db:seed` uses stable IDs in one transaction. It rejects identity collisions rather than relabelling another device/model/base. Existing manufacturer names are reused. Repeated seeding preserves catalog identity. It deprecates only the known demo device IDs when they are marked isDemo; it does not delete them, their variants, or their manufacturers. Existing ROMConfiguration JSON and ProjectDevice foreign keys remain untouched.

New selection endpoints omit demo/deprecated devices and manufacturers with no active real devices. Direct owned project reads still resolve legacy entries and show a deprecation notice. Unchanged legacy selections remain editable, including old base strings; new projects/changed selections must use active catalog entries. No source catalog data grants build permission.

Run `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, then restart the API after pulling this schema change. `pnpm test:integration` verifies seed idempotency and preservation of a legacy project reference; browser tests verify real Redmi selection, source-only AOSP selection, persistence and rejected builds.

## Files for this phase

- `packages/database/prisma/schema.prisma` and the additive migration.
- `packages/database/prisma/catalog-data.ts`, `catalog-seed.ts`, `seed.ts`.
- `apps/api/src/app.ts` for catalog queries and legacy-safe selection checks.
- `apps/web/lib/project-api.ts`, `components/project-creation.tsx`, `components/project-details.tsx` for existing UI data/status presentation.
- `packages/contracts/src/index.ts` for accurate compatibility explanations.
- `tests/api.integration.ts`, `tests/e2e/foundation.spec.ts`, `tests/catalog.test.ts`.
- `API.md`, `DATABASE.md`, `DEVICE_SUPPORT.md`, `README.md` and this source ledger.
