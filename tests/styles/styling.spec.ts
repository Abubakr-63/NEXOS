import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`NEXOS styles load at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page).toHaveTitle(/NEXOS/);
    await expect(page.locator(".footer-brand")).toContainText("NEXOS");
    await expect(page.locator(".rail-brand .lucide-orbit")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("ROMCRAFT");
    await expect(page.locator(".craft-hero h1")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(11, 14, 20)",
    );
    await expect(page.locator(".craft-grid")).toHaveCSS("display", "grid");
    await expect(page.locator(".craft-card").first()).toHaveCSS(
      "border-radius",
      width > 720 ? "22px" : "20px",
    );
    await expect(page.locator(".craft-sidebar")).toHaveCSS("position", "fixed");
    if (width > 720) {
      await expect(page.locator(".craft-sidebar")).toBeVisible();
      await expect(page.locator(".craft-main")).toHaveCSS(
        "margin-left",
        "118px",
      );
    } else {
      await expect(page.locator(".craft-sidebar")).toBeHidden();
      await expect(
        page.getByRole("navigation", { name: "Mobile navigation" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "More navigation" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(
        page.getByRole("button", { name: "More navigation" }),
      ).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // sr-only is an existing Tailwind utility used by the application.
    expect(
      await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.className = "sr-only";
        document.body.append(probe);
        const style = getComputedStyle(probe);
        const result = {
          position: style.position,
          width: style.width,
          overflow: style.overflow,
        };
        probe.remove();
        return result;
      }),
    ).toEqual({ position: "absolute", width: "1px", overflow: "hidden" });
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(241, 244, 249)",
    );
    await page.reload();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(241, 244, 249)",
    );
    expect(errors).toEqual([]);
  });
}

test("served CSS contains current studio rules and compiled Tailwind", async ({
  page,
}) => {
  await page.goto("/");
  const urls = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    );
  expect(urls.length).toBeGreaterThan(0);
  let css = "";
  for (const url of urls) {
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/css");
    css += await response.text();
  }
  for (const selector of [
    ".craft-sidebar",
    ".studio-layout",
    ".android-preview",
    ".sr-only",
  ])
    expect(css).toContain(selector);
  expect(css).not.toMatch(/@(?:tailwind|source|theme)\b/);
  const icon = await page.request.get("/icon.svg");
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain("lucide-orbit");
  const favicon = await page.request.get("/favicon.ico");
  expect(favicon.ok()).toBe(true);
  expect((await favicon.body()).subarray(0, 4)).toEqual(
    Buffer.from([0, 0, 1, 0]),
  );
  await page.goto("/login");
  await expect(page.locator(".nexos-auth-brand")).toContainText(
    "ANDROID CREATION STUDIO",
  );
  await expect(page.locator(".nexos-auth-brand .lucide-orbit")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ROMCRAFT");
});

test("rail collapse, route selection, mobile dialog focus, and responsive resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const desktop = page.getByRole("navigation", { name: "Main navigation" });
  await expect(desktop.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const rail = page.locator(".craft-sidebar");
  const overview = desktop.getByRole("link", { name: "Overview" });
  await expect(rail).toHaveCSS("width", "76px");
  await expect(overview.locator(".navigation-label")).toBeHidden();
  await expect(overview).toHaveAttribute("title", "Overview");
  const before = await overview.locator(".navigation-icon").boundingBox();
  const contentBefore = await page.locator(".craft-main").boundingBox();
  await overview.hover();
  await expect(rail).toHaveCSS("width", "240px");
  await expect(overview.locator(".navigation-label")).toBeVisible();
  await expect(overview).toHaveCSS("flex-direction", "row");
  expect(await overview.locator(".navigation-icon").boundingBox()).toEqual(
    before,
  );
  expect(await page.locator(".craft-main").boundingBox()).toEqual(
    contentBefore,
  );
  await desktop.getByRole("link", { name: "Profile", exact: true }).hover();
  await expect(rail).toHaveCSS("width", "240px");
  await page.mouse.move(600, 50);
  await expect(rail).toHaveCSS("width", "76px");
  await expect(overview.locator(".navigation-label")).toBeHidden();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(rail).toHaveCSS("width", "240px");
  await desktop.getByRole("link", { name: "Create ROM" }).click();
  await expect(
    desktop.getByRole("link", { name: "Create ROM" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    desktop.getByRole("link", { name: "My projects" }),
  ).not.toHaveAttribute("aria-current");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".craft-main")).toHaveCSS("margin-left", "0px");
  await expect(page.locator(".craft-main")).toHaveCSS("width", "390px");
  await page.getByRole("button", { name: "More navigation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await dialog.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "More navigation" }),
  ).toHaveAttribute("data-active", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".mobile-dock .navigation-item").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

test("touch tablet toggles the overlay without moving content", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(process.env.STYLE_TEST_URL ?? "http://localhost:3102");
  const rail = page.locator(".craft-sidebar");
  await expect(rail).toHaveCSS("width", "76px");
  await page.getByRole("button", { name: "Expand navigation" }).tap();
  await expect(rail).toHaveCSS("width", "240px");
  await expect(page.locator(".craft-main")).toHaveCSS("margin-left", "118px");
  await page.getByRole("button", { name: "Collapse navigation" }).tap();
  await expect(rail).toHaveCSS("width", "76px");
  await page.getByRole("button", { name: "Expand navigation" }).tap();
  await page.locator(".craft-hero h1").tap();
  await expect(rail).toHaveCSS("width", "76px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(rail).toHaveCSS("transition-duration", "0s");
  await context.close();
});
