import { test as base, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
export const test = base.extend<{ workspace: () => Promise<void> }>({
  workspace: async ({ page }, use) => {
    const id = randomBytes(8).toString("hex");
    const email = `workspace_${id}@example.com`;
    try {
      await use(async () => {
        const response = await page.request.post("/api/v1/auth/register", {
          headers: { Origin: "http://localhost:3100" },
          data: {
            email,
            username: `workspace_${id}`,
            password: randomBytes(24).toString("base64url"),
          },
        });
        expect(response.status()).toBe(201);
      });
    } finally {
      const { PrismaClient } = createRequire(resolve("apps/api/package.json"))(
        "@prisma/client",
      );
      const db = new PrismaClient();
      try {
        await db.auditLog.deleteMany({ where: { actor: { email } } });
        await db.user.deleteMany({ where: { email } });
      } finally {
        await db.$disconnect();
      }
    }
  },
});
export { expect };
