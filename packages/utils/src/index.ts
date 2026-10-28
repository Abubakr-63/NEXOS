export type CompatibilityRule = {
  variantId: string;
  result: "SUPPORTED" | "UNSUPPORTED" | "CONDITIONAL" | "UNKNOWN";
  explanation: string;
  evidenceUrl?: string;
  requiredFirmware?: string;
  requiredRecovery?: string;
  requiredBootloaderUnlocked?: boolean;
};
export function evaluateCompatibility(
  variantId: string,
  rule?: CompatibilityRule,
  environment?: {
    firmware?: string;
    recovery?: string;
    bootloaderUnlocked?: boolean;
  },
) {
  if (!rule || rule.variantId !== variantId || !rule.evidenceUrl) {
    return {
      result: "UNKNOWN" as const,
      explanation: "No evidenced rule for this exact device variant.",
      evidence: [] as string[],
    };
  }
  const evidence = [rule.evidenceUrl];
  if (rule.result === "UNSUPPORTED" || rule.result === "UNKNOWN")
    return { result: rule.result, explanation: rule.explanation, evidence };
  const missing: string[] = [];
  if (rule.requiredFirmware && environment?.firmware !== rule.requiredFirmware)
    missing.push(`Requires firmware ${rule.requiredFirmware}`);
  if (rule.requiredRecovery && environment?.recovery !== rule.requiredRecovery)
    missing.push(`Requires recovery ${rule.requiredRecovery}`);
  if (
    rule.requiredBootloaderUnlocked &&
    environment?.bootloaderUnlocked !== true
  )
    missing.push("Requires an unlocked bootloader");
  return {
    result: missing.length ? ("CONDITIONAL" as const) : rule.result,
    explanation: [rule.explanation, ...missing].join(". "),
    evidence,
  };
}
