import { randomBytes } from "node:crypto";
import { test, expect } from "./workspace-fixture";
import AxeBuilder from "@axe-core/playwright";
import { createRequire } from "node:module";
import { resolve } from "node:path";
test("creation validates identity and preserves mobile navigation", async ({
  page,
  workspace,
}) => {
  await workspace();
  await page.goto("/projects/new");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toBeFocused();
  await page.getByLabel("Project name", { exact: true }).fill("A draft idea");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Select Device", exact: true }),
  ).toBeVisible();
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
  workspace,
}) => {
  await workspace();
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
  test.setTimeout(120000);
  const suffix = Date.now().toString();
  const email = `browser_${suffix}@example.com`;
  const requireApi = createRequire(resolve("apps/api/package.json"));
  const { PrismaClient } = requireApi("@prisma/client");
  const db = new PrismaClient();
  const makerId = `e2e-maker-${suffix}`;
  const baseName = `AOSP test metadata ${suffix}`;
  try {
    await db.manufacturer.create({
      data: {
        id: makerId,
        slug: makerId,
        name: `Phase 2A test manufacturer ${suffix}`,
        devices: {
          create: {
            slug: `e2e-device-${suffix}`,
            name: "Phase 2A test device",
            codename: "test-device",
            isDemo: false,
            variants: {
              create: {
                modelNumber: "TEST-1",
                region: "Test region",
                androidVersions: [],
              },
            },
          },
        },
      },
    });
    await db.androidBase.create({
      data: {
        id: baseName,
        name: baseName,
        androidVersion: "test-only",
        sourceRepository: "https://example.com/test-base",
        sourceRef: "test-only",
        documentationUrl: "https://example.com/test-base",
        reviewedAt: new Date(),
      },
    });
    await page.goto("/login");
    await page
      .getByRole("link", { name: "Create account", exact: true })
      .click();
    await page
      .getByLabel("Username", { exact: true })
      .filter({ visible: true })
      .fill(`browser_${suffix}`);
    await page
      .getByLabel("Email address")
      .filter({ visible: true })
      .fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .filter({ visible: true })
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
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Browser saved ROM");
    await page
      .getByLabel("Description (optional)")
      .fill("A persistent Phase 2A draft");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Manufacturer", exact: true })
      .selectOption(makerId);
    await page.getByLabel("Search devices").fill("test-device");
    await expect(page.getByLabel("Device model")).toBeEnabled();
    const model = await page
      .getByLabel("Device model")
      .locator("option")
      .filter({ hasText: "Phase 2A test device" })
      .getAttribute("value");
    await page.getByLabel("Device model").selectOption(model!);
    const variant = await page
      .getByLabel("Exact variant")
      .locator("option")
      .filter({ hasText: "TEST-1" })
      .getAttribute("value");
    await page.getByLabel("Exact variant").selectOption(variant!);
    await expect(page.getByText(/Support: UNKNOWN/)).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Android base", exact: true })
      .selectOption(baseName);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await expect(page).toHaveURL(/projects\/[^/]+\?created=1$/);
    await expect(
      page.getByText("Project created and saved to your account."),
    ).toBeVisible();
    const detailsURL = page.url();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Browser saved ROM", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("A persistent Phase 2A draft", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${baseName} · Android test-only`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit project", exact: true })
      .click();
    await page
      .getByLabel("Description (optional)")
      .fill("Updated and persisted");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByText("Project updated and saved.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Updated and persisted", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/romcraft-project-details.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/projects");
    await page.getByRole("link", { name: /Browser saved ROM/ }).click();
    await expect(page).toHaveURL(detailsURL.split("?")[0]);
    await page.getByRole("link", { name: "Open existing editor" }).click();
    await page.getByRole("button", { name: "ROM Identity" }).click();
    await page.getByLabel("ROM name").fill("My personal Android");
    await expect(page.locator(".pixel-draft-summary strong")).toHaveText(
      "My personal Android",
    );
    await page
      .getByRole("button", { name: "Appearance", exact: false })
      .click();
    await page.getByLabel("Dark appearance").uncheck();
    await expect(page.locator(".pixel-draft-summary")).toContainText(
      "Light appearance",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Dark appearance")).toBeChecked();
    await page
      .getByRole("navigation", { name: "Builder steps" })
      .getByRole("button", { name: /Applications/ })
      .click();
    const calendar = page.getByRole("checkbox", {
      name: "calendar",
      exact: true,
    });
    await calendar.check();
    const liveCanvas = page.getByRole("img", {
      name: "Autonomous generic configuration concept",
    });
    await expect(liveCanvas).toHaveAttribute("data-screen-apps", /calendar/, {
      timeout: 15000,
    });
    await expect(
      page.getByText("Calendar added", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => Number(await liveCanvas.getAttribute("data-zoom")))
      .toBeGreaterThan(1.05);
    await expect
      .poll(async () =>
        Math.abs(Number(await liveCanvas.getAttribute("data-rotation"))),
      )
      .toBeLessThan(0.05);
    await calendar.uncheck();
    await expect(liveCanvas).not.toHaveAttribute(
      "data-screen-apps",
      /calendar/,
    );
    // Rapid changes replace obsolete camera work; latest form state wins.
    await calendar.check();
    await calendar.uncheck();
    await calendar.check();
    await expect(liveCanvas).toHaveAttribute("data-screen-apps", /calendar/);
    await expect
      .poll(async () =>
        Math.abs(
          Number(await liveCanvas.getAttribute("data-progress")) - 1 / 3,
        ),
      )
      .toBeLessThan(0.002);
    await expect
      .poll(async () => Number(await liveCanvas.getAttribute("data-zoom")), {
        timeout: 6000,
      })
      .toBeLessThan(1.005);
    await page.screenshot({ path: ".local/autonomous-studio-calendar.png" });
    await page.getByRole("button", { name: "Advanced Options" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    expect((await download).suggestedFilename()).toBe(
      "nexos-configuration.json",
    );
    await page.getByRole("button", { name: "Review & Build" }).click();
    await expect(
      page.getByRole("button", { name: "Build unavailable" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText(/Saved revision/)).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    // Exercise both dedicated screens against real backend responses using this test's account.
    await page.goto("/register");
    await page
      .getByLabel("Username", { exact: true })
      .filter({ visible: true })
      .fill(`browser_${suffix}`);
    await page
      .getByLabel("Email address")
      .filter({ visible: true })
      .fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .filter({ visible: true })
      .fill("browser-test-password-123");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.locator(".nexos-auth-form").getByRole("alert"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    await page
      .getByLabel("Email address")
      .filter({ visible: true })
      .fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .filter({ visible: true })
      .fill("incorrect-test-password");
    const rejectedLogin = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/auth/login",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await rejectedLogin).status()).toBe(401);
    await expect(
      page.locator(".nexos-auth-form").getByRole("alert"),
    ).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login$/);
    await page
      .getByLabel("Password", { exact: true })
      .filter({ visible: true })
      .fill("browser-test-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/settings/);
    await page.reload();
    await expect(
      page.getByText(`browser_${suffix}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  } finally {
    await db.auditLog.deleteMany({ where: { actor: { email } } });
    await db.user.deleteMany({ where: { email } });
    await db.androidBase.deleteMany({ where: { id: baseName } });
    await db.device.deleteMany({ where: { manufacturerId: makerId } });
    await db.manufacturer.deleteMany({ where: { id: makerId } });
    await db.$disconnect();
  }
});

test("creation reports an unavailable catalog without inventing devices", async ({
  page,
  workspace,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await workspace();
  await page.route("**/api/v1/manufacturers", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/v1/devices?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 12 } }),
  );
  await page.goto("/projects/new");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Empty catalog draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/No manufacturers are registered/)).toBeVisible();
  await expect(page.getByText(/No devices match this search/)).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Select Device", exact: true }),
  ).toBeVisible();
});

test("creation shows API failures rather than local persistence", async ({
  page,
  workspace,
}) => {
  await workspace();
  await page.route("**/api/v1/**", (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/api/v1/auth/"))
      return route.continue();
    return route.fulfill({
      status: 503,
      json: { error: { message: "Database unavailable. Check PostgreSQL." } },
    });
  });
  await page.goto("/projects/new");
  await page.getByLabel("Project name", { exact: true }).fill("Offline draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Database unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
});

test("real Redmi variant and AOSP source can be saved as an unverified draft", async ({
  page,
}) => {
  const suffix = randomBytes(6).toString("hex");
  const email = `realcatalog_${suffix}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { PrismaClient } = createRequire(resolve("apps/api/package.json"))(
    "@prisma/client",
  );
  const db = new PrismaClient();
  try {
    const registered = await page.request.post("/api/v1/auth/register", {
      headers: { Origin: "http://localhost:3100" },
      data: { email, password, username: `real_${suffix}` },
    });
    expect(registered.status()).toBe(201);
    await page.goto("/projects/new");
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Real Redmi catalog draft");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Manufacturer", exact: true })
      .selectOption("manufacturer-xiaomi");
    await page.getByLabel("Search devices").fill("M2101K7AG");
    await page
      .getByRole("combobox", { name: "Device model", exact: true })
      .selectOption("xiaomi-mojito");
    await page
      .getByRole("combobox", { name: "Exact variant", exact: true })
      .selectOption("xiaomi-mojito-m2101k7ag");
    await expect(page.getByText(/Identification: CATALOGED/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Identification source" }),
    ).toHaveAttribute("href", /xiaomi.com/);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Android base", exact: true })
      .selectOption("aosp-16-r4");
    await expect(
      page.getByText(/Source availability is not device compatibility/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await expect(page).toHaveURL(/projects\/[^/]+\?created=1$/);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Real Redmi catalog draft",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("AOSP · Android 16", { exact: true }),
    ).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").at(-1);
    const build = await page.request.post(`/api/v1/projects/${id}/builds`, {
      headers: { Origin: "http://localhost:3100" },
      data: {},
    });
    expect(build.status()).toBe(503);
    await page.getByRole("link", { name: "Open existing editor" }).click();
    await page.getByRole("button", { name: "Review & Build" }).click();
    await expect(
      page.getByRole("button", { name: "Build unavailable" }),
    ).toBeDisabled();
  } finally {
    await db.auditLog.deleteMany({ where: { actor: { email } } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
