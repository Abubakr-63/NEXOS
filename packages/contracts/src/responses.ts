import { z } from "zod";
import { paginationMetadataSchema } from "./pagination";
import { romConfigurationSchema, catalogQuerySchema } from "./requests";

// Wire contracts, not Prisma models. No token, password or backend module belongs here.
// Strict response objects expose accidental secret/shape drift in compatibility tests.
// They are not installed as production response serializers or request validators.
const text = z.string();
const nullableText = text.nullable();
const timestamp = z.iso.datetime();
export const roleSchema = z.enum(["USER", "DEVELOPER", "MODERATOR", "ADMIN"]);
export const catalogStatusSchema = z.enum(["UNVERIFIED", "CATALOGED"]);
export const sourceStatusSchema = z.enum(["UNREVIEWED", "SOURCE_AVAILABLE"]);
export const buildSupportStatusSchema = z.literal("NOT_VERIFIED");
export const baseAvailabilitySchema = z.enum([
  "SOURCE_AVAILABLE",
  "DEPRECATED",
]);
export const publicUserSchema = z.strictObject({
  id: text,
  username: text,
  role: roleSchema,
  emailVerifiedAt: timestamp.nullable(),
});
export const authenticationResponseSchema = z.strictObject({
  user: publicUserSchema,
});
export const sessionSchema = z.strictObject({
  id: text,
  createdAt: timestamp,
  expiresAt: timestamp,
});
export const sessionsResponseSchema = z.strictObject({
  items: z.array(sessionSchema),
});
export const successResponseSchema = z.strictObject({
  success: z.literal(true),
});
// Preserve the existing native Fastify bad-URL shape; normalizing it would break v1.
export const routerErrorSchema = z.strictObject({
  error: text,
  code: text,
  message: text,
  statusCode: z.number().int(),
});
export const manufacturerSchema = z.strictObject({
  id: text,
  name: text,
  slug: text,
});
export const manufacturersResponseSchema = z.strictObject({
  items: z.array(manufacturerSchema.pick({ id: true, name: true })),
});
export const deviceSchema = z.strictObject({
  id: text,
  manufacturerId: text,
  name: text,
  slug: text,
  codename: text,
  chipset: nullableText,
  architecture: nullableText,
  isDemo: z.boolean(),
  deprecatedAt: timestamp.nullable(),
});
export const deviceVariantSchema = z.strictObject({
  id: text,
  deviceId: text,
  modelNumber: text,
  region: text,
  bootloaderNotes: nullableText,
  androidVersions: z.array(text),
  hardwareVariant: nullableText,
  officialSourceUrl: nullableText,
  evidenceUrls: z.array(text),
  sourceCodeUrl: nullableText,
  catalogStatus: catalogStatusSchema,
  sourceStatus: sourceStatusSchema,
  buildSupportStatus: buildSupportStatusSchema,
  reviewedAt: timestamp.nullable(),
  notes: nullableText,
});
export const catalogDeviceSchema = deviceSchema.extend({
  manufacturer: manufacturerSchema,
  variants: z.array(deviceVariantSchema),
  supportStatus: z.literal("UNKNOWN"),
  buildSupportStatus: buildSupportStatusSchema,
  catalogStatus: catalogStatusSchema,
});
export const devicesResponseSchema = z.strictObject({
  items: z.array(catalogDeviceSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export const androidBaseSchema = z.strictObject({
  id: text,
  name: text,
  androidVersion: text,
  sourceRepository: text,
  sourceRef: text,
  documentationUrl: text,
  evidenceUrls: z.array(text),
  availability: baseAvailabilitySchema,
  buildSupportStatus: buildSupportStatusSchema,
  reviewedAt: timestamp,
});
export const androidBaseOptionSchema = androidBaseSchema.extend({
  supportStatus: z.literal("UNKNOWN"),
  buildSupported: z.literal(false),
});
export const androidBasesResponseSchema = z.strictObject({
  items: z.array(androidBaseOptionSchema),
  explanation: text,
});
export const compatibilityResponseSchema = z.strictObject({
  status: z.literal("UNKNOWN"),
  ruleVersion: z.literal("foundation-1"),
  explanation: text,
  blockingIssues: z.array(text),
  warnings: z.array(text),
  requiredActions: z.array(text),
  evidence: z.array(text),
  configuration: romConfigurationSchema,
});
// Lists/revisions return raw persisted JSON, including historical/malformed out-of-band
// records. Never claim that a raw JSON response has been parsed by the configuration schema.
export const rawROMProjectSchema = z.strictObject({
  id: text,
  ownerId: text,
  configuration: z.json(),
  revision: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const projectsResponseSchema = z.strictObject({
  items: z.array(rawROMProjectSchema),
});
export const projectWriteResponseSchema = rawROMProjectSchema.extend({
  configuration: romConfigurationSchema,
});
export const projectDetailResponseSchema = projectWriteResponseSchema.extend({
  deviceVariant: deviceVariantSchema
    .extend({
      device: deviceSchema.extend({ manufacturer: manufacturerSchema }),
    })
    .nullable(),
  androidBase: androidBaseOptionSchema.nullable(),
  compatibility: compatibilityResponseSchema,
});
export const configurationRevisionSchema = z.strictObject({
  id: text,
  projectId: text,
  number: z.number().int(),
  configuration: z.json(),
  createdAt: timestamp,
});
export const revisionsResponseSchema = z.strictObject({
  items: z.array(configurationRevisionSchema),
});
export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  service: z.literal("rom-hub-api"),
});
export const readyResponseSchema = z.strictObject({
  status: z.literal("ready"),
});
export const auditLogSchema = z.strictObject({
  id: text,
  actorId: nullableText,
  action: text,
  targetId: nullableText,
  createdAt: timestamp,
});
export const auditResponseSchema = z.strictObject({
  items: z.array(auditLogSchema),
});
export const legacyProjectSchema = z.strictObject({
  id: text,
  slug: text,
  name: text,
  kind: catalogQuerySchema.shape.kind.unwrap(),
  description: text,
  androidBase: nullableText,
  sourceUrl: nullableText,
  status: text,
  isDemo: z.boolean(),
  organizationId: nullableText,
});
export const legacyProjectsResponseSchema = z.strictObject({
  items: z.array(legacyProjectSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export const legacyProjectResponseSchema = z.strictObject({
  project: legacyProjectSchema.extend({
    releases: z.array(
      z.strictObject({
        id: text,
        projectId: text,
        version: text,
        channel: z.enum(["STABLE", "BETA", "NIGHTLY"]),
        status: z.literal("PUBLISHED"),
        changelog: text,
        createdAt: timestamp,
        publishedAt: timestamp.nullable(),
      }),
    ),
    devices: z.array(
      z.strictObject({ projectId: text, deviceId: text, device: deviceSchema }),
    ),
  }),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthenticationResponse = z.infer<
  typeof authenticationResponseSchema
>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type CatalogDevice = z.infer<typeof catalogDeviceSchema>;
export type CatalogVariant = z.infer<typeof deviceVariantSchema>;
export type ManufacturersResponse = z.infer<typeof manufacturersResponseSchema>;
export type DevicesResponse = z.infer<typeof devicesResponseSchema>;
export type AndroidBaseOption = z.infer<typeof androidBaseOptionSchema>;
export type AndroidBasesResponse = z.infer<typeof androidBasesResponseSchema>;
export type RawROMProject = z.infer<typeof rawROMProjectSchema>;
export type ProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type ProjectWriteResponse = z.infer<typeof projectWriteResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type CompatibilityResponse = z.infer<typeof compatibilityResponseSchema>;
// Presentation projection of already persisted configuration; legacy description may be absent.
// Raw list JSON is intentionally a broader wire type; this view does not assert runtime validation.
export type StoredProjectView = Omit<RawROMProject, "configuration"> & {
  configuration: z.input<typeof romConfigurationSchema>;
};

export type StoredProjectsView = { items: StoredProjectView[] };

// Explicit opt-in response variants; legacy {items} contracts remain unchanged.
export const paginatedProjectsResponseSchema = projectsResponseSchema.extend({ pagination: paginationMetadataSchema });
export const paginatedSessionsResponseSchema = sessionsResponseSchema.extend({ pagination: paginationMetadataSchema });
export const paginatedRevisionsResponseSchema = revisionsResponseSchema.extend({ pagination: paginationMetadataSchema });
export const paginatedAuditResponseSchema = auditResponseSchema.extend({ pagination: paginationMetadataSchema });

export type PaginatedProjectsResponse = z.infer<typeof paginatedProjectsResponseSchema>;
export type PaginatedSessionsResponse = z.infer<typeof paginatedSessionsResponseSchema>;
export type PaginatedRevisionsResponse = z.infer<typeof paginatedRevisionsResponseSchema>;
export type PaginatedAuditResponse = z.infer<typeof paginatedAuditResponseSchema>;
