import { z } from "zod";
import { validationErrors, loginEmailPattern } from "./validation-errors";
const containsNoNul = (value: string) => !value.includes("\u0000");

export const registrationSchema = z
  .object(
    {
      email: z
        .string(validationErrors)
        .regex(loginEmailPattern, { error: "Invalid email" })
        .max(254)
        .transform((v) => v.toLowerCase()),
      username: z
        .string(validationErrors)
        .min(3)
        .max(30)
        .regex(/^[a-zA-Z0-9_]+$/)
        .transform((v) => v.toLowerCase()),
      password: z.string(validationErrors).min(12).max(128),
    },
    validationErrors,
  )
  .strict();
export const loginSchema = registrationSchema.pick({
  email: true,
  password: true,
});
export const catalogQuerySchema = z.object(
  {
    q: z
      .string(validationErrors)
      .trim()
      .max(100)
      .refine(containsNoNul, "Invalid search query")
      .default(""),
    kind: z.enum(["ROM", "RECOVERY", "KERNEL"], validationErrors).optional(),
    page: z.coerce
      .number(validationErrors)
      .refine(Number.isInteger, "Expected integer, received float")
      .min(1)
      .max(10000)
      .default(1),
    limit: z.coerce
      .number(validationErrors)
      .refine(Number.isInteger, "Expected integer, received float")
      .min(1)
      .max(50)
      .default(12),
  },
  validationErrors,
);
export type CompatibilityResult =
  "SUPPORTED" | "UNSUPPORTED" | "CONDITIONAL" | "UNKNOWN";

export const romConfigurationSchema = z
  .object(
    {
      schemaVersion: z.literal(1, validationErrors),
      name: z
        .string(validationErrors)
        .trim()
        .min(1)
        .max(60)
        .refine(containsNoNul, "Invalid project name"),
      variantId: z
        .string(validationErrors)
        .min(1)
        .max(100)
        .refine(containsNoNul, "Invalid device variant identifier"),
      description: z
        .string(validationErrors)
        .trim()
        .max(2000)
        .refine(containsNoNul, "Invalid project description")
        .default(""),
      base: z
        .string(validationErrors)
        .trim()
        .min(1)
        .max(100)
        .refine(containsNoNul, "Invalid Android base identifier"),
      preset: z.enum(
        [
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
        ],
        validationErrors,
      ),
      accent: z.string(validationErrors).regex(/^#[0-9a-fA-F]{6}$/),
      darkMode: z.boolean(validationErrors),
      apps: z
        .array(
          z.enum(
            ["browser", "calendar", "files", "terminal"],
            validationErrors,
          ),
          validationErrors,
        )
        .max(4)
        .refine(
          (a) => a.length > 4 || new Set(a).size === a.length,
          "Duplicate applications",
        ),
      kernel: z.literal("unconfigured", validationErrors),
    },
    validationErrors,
  )
  .strict();
export type ROMConfiguration = z.infer<typeof romConfigurationSchema>;
export const defaultConfiguration: ROMConfiguration = {
  schemaVersion: 1,
  name: "My Android",
  description: "",
  variantId: "unselected",
  base: "unconfigured",
  preset: "Balanced",
  accent: "#70d6ed",
  darkMode: true,
  apps: ["browser", "files"],
  kernel: "unconfigured",
};
export const saveConfigurationSchema = z
  .object(
    {
      configuration: romConfigurationSchema,
      revision: z
        .number(validationErrors)
        .refine(Number.isInteger, "Expected integer, received float")
        .min(1),
    },
    validationErrors,
  )
  .strict();
export function validateConfiguration(input: unknown, variantExists: boolean) {
  const configuration = romConfigurationSchema.parse(input);
  return {
    status: "UNKNOWN" as const,
    ruleVersion: "foundation-1" as const,
    explanation: "No verified build manifest has been registered.",
    blockingIssues: [
      ...(!variantExists ? ["Select an existing exact device variant."] : []),
      "Device-specific build manifest, pinned device-tree/vendor/firmware/kernel integration and recovery evidence have not been verified.",
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

export const deviceQuerySchema = catalogQuerySchema.extend({
  manufacturerId: z.string(validationErrors).min(1).max(100).optional(),
});
export const projectMetadataSchema = romConfigurationSchema.pick({
  name: true,
  description: true,
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type SaveConfigurationInput = z.input<typeof saveConfigurationSchema>;
export type ROMConfigurationInput = z.input<typeof romConfigurationSchema>;
