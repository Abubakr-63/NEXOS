import type { PrismaClient } from "@prisma/client";
import { hashPassword, passwordNeedsRehash } from "./security";

/** Call only after verifying this exact stored hash. Failure is non-destructive. */
export async function upgradePasswordHash(
  db: Pick<PrismaClient, "user">,
  userId: string,
  password: string,
  verifiedHash: string,
): Promise<"current" | "upgraded" | "superseded" | "failed"> {
  if (!passwordNeedsRehash(verifiedHash)) return "current";
  try {
    const replacement = await hashPassword(password);
    const updated = await db.user.updateMany({
      where: { id: userId, passwordHash: verifiedHash },
      data: { passwordHash: replacement },
    });
    return updated.count === 1 ? "upgraded" : "superseded";
  } catch {
    // Never log the error object: a database error may contain password hashes.
    return "failed";
  }
}
