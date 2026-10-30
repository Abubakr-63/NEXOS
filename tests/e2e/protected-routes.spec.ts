import { test, expect } from "@playwright/test";
import { randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

test("anonymous routes are standalone, protected content never renders, technical assets remain available", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/projects",
    "/projects/new",
    "/builder/not-owned",
    "/dashboard",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(
      page.locator(
        ".craft-sidebar, .craft-topbar, .mobile-dock, .header-avatar",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  }
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await expect(page.locator(".craft-shell")).toHaveCount(0);
    await expect(
      page.getByLabel("Email address").filter({ visible: true }),
    ).toBeEnabled();
  }
  expect((await page.request.get("/icon.svg")).status()).toBe(200);
  const response = await page.request.get("/projects", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect((await response.text()).includes("craft-sidebar")).toBe(false);
});

test("real sessions protect refresh, reject expired/revoked cookies, and redirect signed-in auth visits", async ({
  page,
}) => {
  const id = randomBytes(6).toString("hex");
  const email = `guard_${id}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { PrismaClient } = createRequire(resolve("apps/api/package.json"))(
    "@prisma/client",
  );
  const db = new PrismaClient();
  try {
    const registered = await page.request.post("/api/v1/auth/register", {
      headers: { Origin: "http://localhost:3100" },
      data: { email, username: `guard_${id}`, password },
    });
    expect(registered.status()).toBe(201);
    await page.goto("/projects");
    await expect(page.locator(".craft-sidebar")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/projects$/);
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/settings$/);
    }
    const cookie = (await page.context().cookies()).find(
      (item) => item.name === "romhub_session",
    )!;
    const digest = createHash("sha256").update(cookie.value).digest("hex");
    await db.session.update({
      where: { tokenHash: digest },
      data: { expiresAt: new Date(0) },
    });
    await page.goto("/projects/new");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator(".craft-shell")).toHaveCount(0);
    const loggedIn = await page.request.post("/api/v1/auth/login", {
      headers: { Origin: "http://localhost:3100" },
      data: { email, password },
    });
    expect(loggedIn.status()).toBe(201);
    await db.session.deleteMany({ where: { user: { email } } });
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.goto("/login?next=https%3A%2F%2Fevil.invalid");
    await page
      .getByLabel("Email address")
      .filter({ visible: true })
      .fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .filter({ visible: true })
      .fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/localhost:3100\/settings$/);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  } finally {
    await db.auditLog.deleteMany({ where: { actor: { email } } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
