import { z } from "zod";

const cursor = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^v1\.[A-Za-z0-9_-]+$/);
function collectionQuery(defaultLimit: number, maximum: number) {
  return z.discriminatedUnion("pagination", [
    // No mode: preserve formerly ignored query parameters and existing defaults.
    z.object({ pagination: z.undefined().optional() }),
    z.object({
      pagination: z.literal("cursor"),
      limit: z
        .string()
        .trim()
        .regex(/^[1-9]\d{0,2}$/)
        .transform(Number)
        .pipe(z.number().int().min(1).max(maximum))
        .default(defaultLimit),
      cursor: cursor.optional(),
    }),
  ]);
}
export const projectListQuerySchema = collectionQuery(100, 100);
export const sessionListQuerySchema = collectionQuery(50, 100);
export const revisionListQuerySchema = collectionQuery(50, 50);
export const auditListQuerySchema = collectionQuery(50, 50);
export const paginationMetadataSchema = z.strictObject({
  limit: z.number().int().min(1).max(100),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
export type CollectionQuery = z.infer<typeof projectListQuerySchema>;
