import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { PaginationMetadata } from "@rom-hub/contracts";

const lifetime = 15 * 60 * 1000;
const positionSchema = z.union([
  z.strictObject({
    id: z.string().min(1),
    createdAt: z.iso.datetime(),
  }),
  z.strictObject({
    id: z.string().min(1),
    number: z.number().int().min(1).max(2147483647),
  }),
]);
const payloadSchema = z.strictObject({
  scope: z.string(),
  expiresAt: z.number().int(),
  position: positionSchema,
});
type Position = z.infer<typeof positionSchema>;
type Payload = z.infer<typeof payloadSchema>;
function key() {
  // Domain separation: never reuse the raw account HMAC key as an AES key.
  const secret = process.env.AUTH_ACCOUNT_HMAC_KEY;
  if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret))
    throw new Error("Pagination key unavailable");
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update("nexos:pagination:cursor:v1")
    .digest();
}
export function readCursor(
  token: string | undefined,
  scope: string,
): Payload | undefined {
  if (!token) return undefined;
  const encryptionKey = key();
  try {
    if (token.length > 2048 || !/^v1\.[A-Za-z0-9_-]+$/.test(token))
      throw new Error();
    const data = Buffer.from(token.slice(3), "base64url");
    if (data.length < 29 || data.toString("base64url") !== token.slice(3))
      throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      data.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from("nexos:pagination:v1"));
    decipher.setAuthTag(data.subarray(12, 28));
    const parsed = payloadSchema.parse(
      JSON.parse(
        Buffer.concat([
          decipher.update(data.subarray(28)),
          decipher.final(),
        ]).toString("utf8"),
      ),
    );
    if (parsed.scope !== scope || parsed.expiresAt <= Date.now())
      throw new Error();
    return parsed;
  } catch {
    // Never expose crypto/JSON errors, raw tokens, IDs or scope/owner details.
    throw new BadRequestException("Invalid or expired pagination cursor");
  }
}
function encode(payload: Payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("nexos:pagination:v1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);
  const token =
    "v1." +
    Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (token.length > 2048) throw new Error("Pagination cursor unavailable");
  return token;
}
export function page<T>(
  rows: T[],
  limit: number,
  scope: string,
  previous: Payload | undefined,
  position: (row: T) => Position,
): { items: T[]; pagination: PaginationMetadata } {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore
        ? encode({
            scope,
            expiresAt: previous?.expiresAt ?? Date.now() + lifetime,
            position: position(items[items.length - 1]),
          })
        : null,
    },
  };
}
export function timeBoundary(cursor: Payload | undefined) {
  if (!cursor) return undefined;
  if (!("createdAt" in cursor.position))
    throw new BadRequestException("Invalid or expired pagination cursor");
  const { id, createdAt } = cursor.position;
  const date = new Date(createdAt);
  return {
    OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: id } }],
  };
}
export function revisionBoundary(cursor: Payload | undefined) {
  if (!cursor) return undefined;
  if (!("number" in cursor.position))
    throw new BadRequestException("Invalid or expired pagination cursor");
  return {
    OR: [
      { number: { lt: cursor.position.number } },
      { number: cursor.position.number, id: { lt: cursor.position.id } },
    ],
  };
}
