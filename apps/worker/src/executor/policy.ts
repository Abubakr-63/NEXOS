import { createHash } from "node:crypto";
import { virtualTargetSelectionSchema } from "@rom-hub/contracts";

// Identity allowlist only: D2 source evidence and build eligibility remain separate.
export const CUTTLEFISH = Object.freeze({
  candidateId: "aosp16-r4-cuttlefish-x86_64-userdebug-v1",
  kind: "VIRTUAL" as const,
  androidVersion: "16" as const,
  sourceRef: "refs/tags/android-16.0.0_r4",
  product: "aosp_cf_x86_64_only_phone",
  releaseConfig: "aosp_current",
  buildVariant: "userdebug" as const,
  architecture: "x86_64" as const,
  customization: "UPSTREAM_BASELINE" as const,
});
export const LIMITS = Object.freeze({
  concurrency: 1,
  capacity: 16,
  attempts: 2,
  leaseMs: 3000,
  timeoutMs: 30000,
  cleanupMs: 5000,
  outputBytes: 65536,
});
export function approvedTarget(raw: unknown) {
  const target = virtualTargetSelectionSchema.parse(raw);
  if (
    Object.entries(CUTTLEFISH).some(
      ([key, value]) => target[key as keyof typeof target] !== value,
    )
  )
    throw new Error("Unsupported executor target");
  return target;
}
export function targetDigest(raw: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(approvedTarget(raw)))
    .digest("hex");
}
export type Progress = "ALLOCATED" | "ISOLATED" | "PREFLIGHT_RUNNING";
export const progressStages: readonly Progress[] = [
  "ALLOCATED",
  "ISOLATED",
  "PREFLIGHT_RUNNING",
];
