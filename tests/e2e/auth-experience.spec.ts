import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("auth keeps pending/failure honest and rejects a malformed success response", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await gate;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Invalid email or password" } }),
    });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email address")
    .filter({ visible: true })
    .fill("frontend-test@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .filter({ visible: true })
    .fill("test-only-passphrase");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(
    page.getByLabel("Password", { exact: true }).filter({ visible: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".auth-experience")).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page).toHaveURL(/\/login$/);
  release();
  await expect(page.locator(".nexos-auth-form").getByRole("alert")).toHaveText(
    "Invalid email or password",
  );
  await expect(
    page.locator(".nexos-auth-form").getByRole("alert"),
  ).toBeFocused();
  await expect(page.locator(".auth-experience")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/v1/auth/login");
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.locator(".nexos-auth-form").getByRole("alert"),
  ).toContainText("invalid account response");
  await expect(page).toHaveURL(/\/login$/);
});

test("registration is a separate route with accurate constraints and recoverable errors", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/auth/register", (route) => {
    requests++;
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "An account with these details already exists" },
      }),
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page).toHaveTitle("Create account | NEXOS");
  await page
    .getByLabel("Username", { exact: true })
    .filter({ visible: true })
    .fill("valid_handle");
  await page
    .getByLabel("Email address")
    .filter({ visible: true })
    .fill("frontend-test@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .filter({ visible: true })
    .fill("short");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect(requests).toBe(0);
  await page
    .getByLabel("Password", { exact: true })
    .filter({ visible: true })
    .fill("test-only-passphrase");
  await expect(page.locator(".auth-progress")).toHaveAttribute(
    "aria-label",
    "3 of 3 fields meet their requirements",
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.locator(".nexos-auth-form").getByRole("alert"),
  ).toContainText("already exists");
  await expect(
    page.locator(".nexos-auth-form").getByRole("alert"),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByLabel("Password", { exact: true }).filter({ visible: true }),
  ).toHaveValue("");
});

test("auth layouts, keyboard access, reduced motion and WCAG checks in both themes", async ({
  page,
}) => {
  const runtime: string[] = [];
  page.on("pageerror", (error) => runtime.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/login", "/register"]) {
    for (const theme of ["dark", "light"]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(path);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await expect(page.locator(".auth-visual-side")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `.local/f1-${path.slice(1)}-${theme}-desktop.png`,
        fullPage: true,
      });
      for (const width of [1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(
          page.getByLabel("Email address").filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.locator(".craft-sidebar, .craft-topbar, .mobile-dock"),
        ).toHaveCount(0);
      }
      await page.screenshot({
        path: `.local/f1-${path.slice(1)}-${theme}-mobile.png`,
        fullPage: true,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Email address").filter({ visible: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Password", { exact: true }).filter({ visible: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show password" }),
  ).toBeFocused();
  expect(
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  expect(runtime).toEqual([]);
});
