import { z } from "zod";
export const registrationSchema = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = registrationSchema.pick({
  email: true,
  password: true,
});
export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["ROM", "RECOVERY", "KERNEL"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export type CompatibilityResult =
  "SUPPORTED" | "UNSUPPORTED" | "CONDITIONAL" | "UNKNOWN";

export const romConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(60),
    variantId: z.string().min(1).max(100),
    base: z.enum(["unconfigured"]),
    preset: z.enum([
      "Balanced",
      "Gaming",
      "Battery Saver",
      "Performance",
      "Camera Focus",
      "Ultra Lite",
      "Privacy",
      "Beautiful UI",
      "Developer",
      "Fully Custom",
    ]),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    darkMode: z.boolean(),
    apps: z
      .array(z.enum(["browser", "calendar", "files", "terminal"]))
      .max(4)
      .refine((a) => new Set(a).size === a.length, "Duplicate applications"),
    kernel: z.literal("unconfigured"),
  })
  .strict();
export type ROMConfiguration = z.infer<typeof romConfigurationSchema>;
export const defaultConfiguration: ROMConfiguration = {
  schemaVersion: 1,
  name: "My Android",
  variantId: "unselected",
  base: "unconfigured",
  preset: "Balanced",
  accent: "#70d6ed",
  darkMode: true,
  apps: ["browser", "files"],
  kernel: "unconfigured",
};
export const saveConfigurationSchema = z
  .object({
    configuration: romConfigurationSchema,
    revision: z.number().int().min(1),
  })
  .strict();
export function validateConfiguration(input: unknown, variantExists: boolean) {
  const configuration = romConfigurationSchema.parse(input);
  return {
    status: "UNKNOWN" as const,
    ruleVersion: "foundation-1",
    explanation: "No verified build manifest has been registered.",
    blockingIssues: [
      ...(!variantExists ? ["Select an existing exact device variant."] : []),
      "Device tree, vendor dependencies, firmware, Android base, kernel and recovery evidence are missing.",
      "An isolated Android compilation worker is not configured.",
    ],
    warnings: [
      "Theme preview is an approximation. Application selections are intentions, not verified packages.",
    ],
    requiredActions: [
      "Register and review an immutable device build manifest before enabling compilation.",
    ],
    evidence: [] as string[],
    configuration,
  };
}
