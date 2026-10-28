import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createRequire } from "node:module";
import { resolve } from "node:path";
test("builder appearance, undo, export, and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create your ROM" }).click();
  await page.getByRole("button", { name: "ROM Identity" }).click();
  await page.getByLabel("ROM name").fill("My personal Android");
  await expect(page.locator(".android-widget h3")).toHaveText(
    "My personal Android",
  );
  await page.getByRole("button", { name: "Appearance", exact: false }).click();
  await page.getByLabel("Dark appearance").uncheck();
  await expect(page.locator(".android-preview")).toHaveClass(/preview-light/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Dark appearance")).toBeChecked();
  await page.getByRole("button", { name: "Advanced Options" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe(
    "romcraft-configuration.json",
  );
  await page.getByRole("button", { name: "Review & Build" }).click();
  await expect(
    page.getByRole("button", { name: "Build unavailable" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "My projects", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My projects" }),
  ).toBeVisible();
});
test("overview passes automated WCAG A/AA checks in dark and light themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("registration, session listing, and logout work through the Next proxy", async ({
  page,
}) => {
  const suffix = Date.now().toString();
  const email = `browser_${suffix}@example.com`;
  try {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByLabel("Username", { exact: true })
      .fill(`browser_${suffix}`);
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("browser-test-password-123");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/settings/);
    await expect(
      page.getByText(`browser_${suffix}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Active sessions" }),
    ).toBeVisible();
    await page.goto("/projects/new");
    await page.getByRole("button", { name: "ROM Identity" }).click();
    await page.getByLabel("ROM name").fill("Browser saved ROM");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/builder\//);
    await page.reload();
    await expect(page.locator(".android-widget h3")).toHaveText(
      "Browser saved ROM",
    );
    await page.getByRole("button", { name: "Review & Build" }).click();
    await page.getByRole("button", { name: "Save & validate" }).click();
    await expect(page.getByText("UNKNOWN", { exact: true })).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Sign in or create an account" }),
    ).toBeVisible();
  } finally {
    const requireApi = createRequire(resolve("apps/api/package.json"));
    const { PrismaClient } = requireApi("@prisma/client");
    const db = new PrismaClient();
    await db.auditLog.deleteMany({ where: { actor: { email } } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
