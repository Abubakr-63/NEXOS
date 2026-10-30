import { z } from "zod";
import { romConfigurationSchema } from "./requests";

const commit = z.string().regex(/^[a-f0-9]{40}$/);
export const immutableAndroidRefSchema = z
  .string()
  .regex(/^(?:[a-f0-9]{40}|refs\/tags\/android-\d+\.\d+\.\d+_r\d+)$/);
const sourceURL = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  });
export const sourceObservationSchema = z
  .object({
    file: z.string().min(1),
    repository: sourceURL,
    commit,
    path: z
      .string()
      .min(1)
      .refine(
        (value) => !value.startsWith("/") && !value.split("/").includes(".."),
      ),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    gitBlob: commit,
  })
  .strict();
export const virtualTargetSelectionSchema = z
  .object({
    candidateId: z.string().min(1),
    kind: z.literal("VIRTUAL"),
    androidVersion: z.literal("16"),
    sourceRef: immutableAndroidRefSchema,
    product: z.string().min(1),
    releaseConfig: z.string().min(1),
    buildVariant: z.literal("userdebug"),
    architecture: z.literal("x86_64"),
    customization: z.literal("UPSTREAM_BASELINE"),
  })
  .strict();
export const virtualTargetEvidenceSchema = z
  .object({
    version: z.literal(1),
    selection: virtualTargetSelectionSchema,
    manifestRepository: sourceURL,
    manifestCommit: commit,
    resolvedRelease: z.string().min(1),
    checkedAt: z.iso.datetime(),
    state: z.enum(["DECLARATIONS_VERIFIED", "UNVERIFIED", "REVOKED"]),
    observations: z.array(sourceObservationSchema).min(7),
  })
  .strict();
export type VirtualTargetEvidence = z.infer<typeof virtualTargetEvidenceSchema>;
export const deviceIdentitySchema = z
  .object({
    manufacturerId: z.string().min(1),
    deviceId: z.string().min(1),
    variantId: z.string().min(1),
    modelNumber: z.string().min(1),
    region: z.string().min(1),
    codename: z.string().min(1),
    hardwareVariant: z.string().nullable(),
    deprecated: z.boolean(),
    isDemo: z.boolean(),
  })
  .strict();
export type DeviceIdentity = z.infer<typeof deviceIdentitySchema>;

const missingPrerequisites = [
  "COMPLETE_IMMUTABLE_SOURCE_LOCK",
  "SOURCE_SIGNATURE_AND_LICENSE_REVIEW",
  "PROVISIONED_HOST_TOOLCHAIN",
  "LUNCH_PREFLIGHT",
  "ISOLATED_BUILD_EXECUTOR",
] as const;
function decision(
  configurationSupported: boolean,
  sourceTargetVerified: boolean,
  identityState: string,
  physical: boolean,
) {
  return {
    configurationSupported,
    sourceTargetVerified,
    identityState,
    prerequisiteState: "MISSING" as const,
    missingPrerequisites: [
      ...missingPrerequisites,
      ...(physical
        ? [
            "DEVICE_TREE",
            "KERNEL_AND_VENDOR_PROVENANCE",
            "FIRMWARE_REQUIREMENTS",
            "DEVICE_BASE_COMPATIBILITY_EVIDENCE",
          ]
        : []),
    ],
    compilerStatus: "UNAVAILABLE" as const,
    deviceROMStatus: physical
      ? ("UNVERIFIED" as const)
      : ("NOT_APPLICABLE" as const),
    buildEligible: false as const,
    flashEligible: false as const,
  };
}

/** Trusted, operator-reviewed evidence only; never accept evidence from an API request. */
export function assessVirtualTarget(
  selection: unknown,
  evidence: unknown,
  asOf: Date,
) {
  const input = virtualTargetSelectionSchema.safeParse(selection);
  const record = virtualTargetEvidenceSchema.safeParse(evidence);
  if (!input.success || !record.success)
    return decision(false, false, "NOT_APPLICABLE", false);
  const expected = record.data.selection;
  const matches = (Object.keys(expected) as (keyof typeof expected)[]).every(
    (key) => input.data[key] === expected[key],
  );
  const age = asOf.getTime() - Date.parse(record.data.checkedAt);
  const fresh = Number.isFinite(age) && age >= 0 && age <= 30 * 86400_000;
  const files = new Set(record.data.observations.map((item) => item.file));
  const complete = [
    "manifest.xml",
    "AndroidProducts.mk",
    "aosp_cf.mk",
    "BoardConfig.mk",
    "release_config_map.textproto",
    "bp4a.textproto",
    "envsetup.sh",
  ].every((file) => files.has(file));
  const manifest = record.data.observations.find(
    (item) => item.file === "manifest.xml",
  );
  const bound =
    manifest?.repository === record.data.manifestRepository &&
    manifest?.commit === record.data.manifestCommit &&
    manifest?.path === "default.xml" &&
    files.size === record.data.observations.length;
  const verified =
    bound &&
    matches &&
    fresh &&
    complete &&
    record.data.state === "DECLARATIONS_VERIFIED";
  return decision(matches, verified, "NOT_APPLICABLE", false);
}

/** Catalog identity is not a device-specific build recipe or permission to flash. */
export function assessPhysicalDraft(
  configuration: unknown,
  identity: unknown,
  claimedIdentity?: unknown,
) {
  const config = romConfigurationSchema.safeParse(configuration);
  const device = deviceIdentitySchema.safeParse(identity);
  if (!config.success || !device.success)
    return decision(false, false, "UNKNOWN", true);
  const claimed =
    claimedIdentity === undefined
      ? device
      : deviceIdentitySchema.safeParse(claimedIdentity);
  const consistent =
    claimed.success &&
    (Object.keys(device.data) as (keyof DeviceIdentity)[]).every(
      (key) => claimed.data[key] === device.data[key],
    );
  const known =
    consistent &&
    config.data.variantId === device.data.variantId &&
    !device.data.deprecated &&
    !device.data.isDemo;
  return decision(
    false,
    false,
    known ? "CATALOGED" : "INCONSISTENT_OR_DEPRECATED",
    true,
  );
}
