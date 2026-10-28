/** Reviewed 2026-10-28. Identification/source evidence, never ROMCRAFT build evidence. */
export const catalogReviewedAt = new Date("2026-10-28T00:00:00.000Z");
const wikiRevision = "7ddd0afd7c4d0a599cda6a4ddb693aa394c78145";
const wiki = (file: string) =>
  `https://github.com/LineageOS/lineage_wiki/blob/${wikiRevision}/_data/devices/${file}.yml`;
const pixelSpecs = "https://support.google.com/pixelphone/answer/7158570?hl=en";
const aospDevices =
  "https://source.android.com/docs/setup/reference/build-numbers";
const pixelKernels =
  "https://source.android.com/docs/setup/build/building-pixel-kernels";
const unknownRegion = "Not specified in cited source";
type Variant = {
  id: string;
  modelNumber: string;
  region: string;
  hardwareVariant: string;
  officialSourceUrl: string;
  evidenceUrls: string[];
  sourceCodeUrl: string;
  sourceStatus: "UNREVIEWED" | "SOURCE_AVAILABLE";
  notes: string;
};
type CuratedDevice = {
  id: string;
  name: string;
  codename: string;
  manufacturer: { id: string; name: string; slug: string };
  variants: Variant[];
};
const google = { id: "manufacturer-google", name: "Google", slug: "google" };
const samsung = {
  id: "manufacturer-samsung",
  name: "Samsung",
  slug: "samsung",
};
const pixel = (
  codename: string,
  modelNumber: string,
  hardwareVariant: string,
  region = unknownRegion,
): Variant => ({
  id: `google-${codename}-${modelNumber.toLowerCase()}`,
  modelNumber,
  region,
  hardwareVariant,
  officialSourceUrl: pixelSpecs,
  evidenceUrls: [pixelSpecs, aospDevices, pixelKernels],
  sourceCodeUrl: `https://android.googlesource.com/kernel/manifest/+/refs/heads/android-gs-${codename === "oriole" ? "raviole" : codename === "panther" ? "pantah" : "shusky"}-6.1-android16`,
  sourceStatus: "SOURCE_AVAILABLE",
  notes:
    "Google documents model/network variants and AOSP device/kernel targets. Carrier bootloader restrictions and ROMCRAFT builds are not verified.",
});
const galaxy = (
  codename: string,
  modelNumber: string,
  commit: string,
): Variant => ({
  id: `samsung-${codename}-${modelNumber.toLowerCase()}`,
  modelNumber,
  region: unknownRegion,
  hardwareVariant: "Exynos 9820 model; other chipsets excluded",
  officialSourceUrl: wiki(codename),
  evidenceUrls: [wiki(codename)],
  sourceCodeUrl: `https://github.com/LineageOS/android_device_samsung_${codename}/tree/${commit}`,
  sourceStatus: "SOURCE_AVAILABLE",
  notes:
    "Identifiers reviewed against official LineageOS project data, not OEM build approval. No Snapdragon model is included. Regional market is not asserted.",
});
export const curatedDevices: CuratedDevice[] = [
  {
    id: "xiaomi-mojito",
    name: "Redmi Note 10",
    codename: "mojito",
    manufacturer: { id: "manufacturer-xiaomi", name: "Xiaomi", slug: "xiaomi" },
    variants: [
      {
        id: "xiaomi-mojito-m2101k7ag",
        modelNumber: "M2101K7AG",
        region: unknownRegion,
        hardwareVariant: "4G/LTE model M2101K7AG (not Note 10 5G, 10S or Pro)",
        officialSourceUrl:
          "https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/2b53d1f52f4d79a46eee9d3dd6e4702f.pdf",
        evidenceUrls: [
          "https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/2b53d1f52f4d79a46eee9d3dd6e4702f.pdf",
          "https://github.com/MiCode/Xiaomi_Kernel_OpenSource/blob/16d89a630ea8752c84bf4d76201964524d620616/README.md",
        ],
        sourceCodeUrl:
          "https://github.com/MiCode/Xiaomi_Kernel_OpenSource/tree/mojito-r-oss",
        sourceStatus: "UNREVIEWED",
        notes:
          "Manufacturer guide identifies the LTE model; MiCode maps Redmi Note 10 to mojito-r-oss. This is an older kernel publication, not a reviewed maintained device tree. Indian M2101K7AI/sunny mapping is excluded pending primary-source verification.",
      },
    ],
  },
  {
    id: "google-oriole",
    name: "Pixel 6",
    codename: "oriole",
    manufacturer: google,
    variants: [
      pixel("oriole", "GB7N6", "5G Sub-6"),
      pixel("oriole", "G9S9B", "5G mmWave + Sub-6"),
    ],
  },
  {
    id: "google-panther",
    name: "Pixel 7",
    codename: "panther",
    manufacturer: google,
    variants: [pixel("panther", "GVU6C", "5G Sub-6")],
  },
  {
    id: "google-shiba",
    name: "Pixel 8",
    codename: "shiba",
    manufacturer: google,
    variants: [
      pixel("shiba", "G9BQD", "5G Sub-6 NA", "US / Canada"),
      pixel(
        "shiba",
        "GPJ41",
        "5G Sub-6",
        "Rest of world (Google classification)",
      ),
    ],
  },
  {
    id: "samsung-beyond1lte",
    name: "Galaxy S10",
    codename: "beyond1lte",
    manufacturer: samsung,
    variants: [
      galaxy(
        "beyond1lte",
        "SM-G973F",
        "c9fce8079fe9b90d2ce6b728c87e78cc79caae89",
      ),
    ],
  },
  {
    id: "samsung-beyond0lte",
    name: "Galaxy S10e",
    codename: "beyond0lte",
    manufacturer: samsung,
    variants: [
      galaxy(
        "beyond0lte",
        "SM-G970F",
        "380b83e9bd99362ded82510aa473fab5310f017d",
      ),
    ],
  },
  {
    id: "oneplus-guacamole",
    name: "OnePlus 7 Pro",
    codename: "guacamole",
    manufacturer: {
      id: "manufacturer-oneplus",
      name: "OnePlus",
      slug: "oneplus",
    },
    variants: ["GM1911", "GM1913", "GM1917"].map((modelNumber) => ({
      id: `oneplus-guacamole-${modelNumber.toLowerCase()}`,
      modelNumber,
      region: unknownRegion,
      hardwareVariant: `4G model ${modelNumber}; non-T-Mobile LineageOS variant 1`,
      officialSourceUrl: wiki("guacamole_variant1"),
      evidenceUrls: [wiki("guacamole_variant1")],
      sourceCodeUrl:
        "https://github.com/LineageOS/android_device_oneplus_guacamole/tree/4e24f54dba481671e18323b20ade88daa2b09e34",
      sourceStatus: "SOURCE_AVAILABLE",
      notes:
        "Exact model is listed in official LineageOS variant 1 data. GM1915/T-Mobile and OnePlus 7 Pro 5G are excluded. Region is not inferred from model suffix.",
    })),
  },
];

export const curatedAndroidBases = [
  {
    id: "aosp-16-r4",
    name: "AOSP",
    androidVersion: "16",
    sourceRepository: "https://android.googlesource.com/platform/manifest",
    sourceRef: "refs/tags/android-16.0.0_r4",
    documentationUrl:
      "https://source.android.com/docs/setup/reference/build-numbers",
    evidenceUrls: [
      "https://source.android.com/docs/setup/reference/build-numbers",
      "https://android.googlesource.com/platform/manifest/+/15128c9e27cfa599c48d294babd39286ee8f1426",
    ],
  },
  {
    id: "lineageos-23.2",
    name: "LineageOS 23.2",
    androidVersion: "16",
    sourceRepository: "https://github.com/LineageOS/android",
    sourceRef: "9776e518de506f610218c4caa6c1fddff46873af",
    documentationUrl: "https://wiki.lineageos.org/",
    evidenceUrls: [
      "https://github.com/LineageOS/android/blob/9776e518de506f610218c4caa6c1fddff46873af/default.xml",
      "https://github.com/LineageOS/android_vendor_lineage/blob/lineage-23.2/config/version.mk",
    ],
  },
];
export const legacyDemoDeviceIds = ["demo-atlas", "demo-nova", "demo-orion"];
