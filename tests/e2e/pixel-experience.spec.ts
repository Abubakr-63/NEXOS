import { test, expect } from "@playwright/test";

test("autonomous REDMAGIC-inspired film renders real macro and cutaway geometry, loops and preserves the auth canvas", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  const canvas = page.getByRole("img", {
    name: "Autonomous NEXOS concept smartphone film",
  });
  await expect(canvas).toHaveAttribute("data-draw-calls", /^[1-9]/, {
    timeout: 30000,
  });
  await expect(canvas).toHaveAttribute("data-asset", "nexos-original-concept");
  expect(Number(await canvas.getAttribute("data-meshes"))).toBeGreaterThan(70);
  expect(
    Number(await canvas.getAttribute("data-instanced-details")),
  ).toBeGreaterThan(250);
  await expect(
    page.locator(".pixel-story button, .pixel-story input, .pixel-story nav"),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Email address").filter({ visible: true }),
  ).toBeEnabled();
  await page.screenshot({ path: ".local/redmagic-final-reveal.png" });
  await expect(canvas).toHaveAttribute("data-film-shot", "1", {
    timeout: 20000,
  });
  expect(
    Number(await canvas.getAttribute("data-camera-distance")),
  ).toBeLessThan(9);
  await page.screenshot({ path: ".local/redmagic-final-macro.png" });
  await expect(canvas).toHaveAttribute("data-cutaway", "1.000", {
    timeout: 20000,
  });
  await page.screenshot({ path: ".local/redmagic-final-cutaway.png" });
  await expect(canvas).toHaveAttribute("data-film-shot", "4", {
    timeout: 25000,
  });
  await page.screenshot({ path: ".local/redmagic-final-cooling.png" });
  await expect(canvas).toHaveAttribute("data-film-shot", "5", {
    timeout: 25000,
  });
  await expect(canvas).toHaveAttribute("data-screen-apps", /calendar/);
  await page.screenshot({ path: ".local/redmagic-final-front.png" });
  await expect(canvas).toHaveAttribute("data-film-shot", "6", {
    timeout: 20000,
  });
  await page.screenshot({ path: ".local/redmagic-final-hero.png" });
  await expect(canvas).toHaveAttribute("data-film-shot", "0", {
    timeout: 20000,
  });
  await canvas.evaluate((element) => {
    element.dataset.persistentTest = "same-scene";
  });
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(
    page.getByLabel("Username", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(canvas).toHaveAttribute("data-persistent-test", "same-scene");
  await expect(page.locator(".pixel-story")).toHaveAttribute(
    "data-mode",
    "register",
  );
  await expect(
    page.locator(".craft-sidebar, .craft-topbar, .mobile-dock"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-persistent-test", "same-scene");
  expect(errors).toEqual([]);
});

test("desktop reduced motion and WebGL context loss preserve usable authentication", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/register");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "three-webgl2", {
    timeout: 30000,
  });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-progress")))
    .toBeCloseTo(1 / 3, 2);
  await canvas.evaluate((element) => {
    const extension = (element as HTMLCanvasElement)
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context");
    (
      element as HTMLCanvasElement & { restoreForTest?: () => void }
    ).restoreForTest = () => extension?.restoreContext();
    extension?.loseContext();
  });
  await expect(
    page.getByText("3D preview unavailable on this device."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Email address").filter({ visible: true }),
  ).toBeEnabled();
  await canvas.evaluate((element) => {
    (
      element as HTMLCanvasElement & { restoreForTest?: () => void }
    ).restoreForTest?.();
  });
  await expect(
    page.getByText("3D preview unavailable on this device."),
  ).toHaveCount(0, { timeout: 20000 });
  await expect(canvas).toHaveAttribute("data-draw-calls", /^[1-9]/, {
    timeout: 20000,
  });
});

test("mobile auth never requests the film, model or Three.js and has no canvas or obstructing scene", async ({
  page,
}) => {
  const scripts: Promise<string>[] = [];
  let webgl = 0;
  page.on("response", (response) => {
    if (/\.js(?:\?|$)/.test(response.url()))
      scripts.push(response.text().catch(() => ""));
  });
  await page.exposeFunction("reportUnexpectedWebGL", () => webgl++);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (type: string, ...args: unknown[]) {
        if (type === "webgl2" || type === "webgl")
          void (
            window as unknown as { reportUnexpectedWebGL: () => Promise<void> }
          ).reportUnexpectedWebGL();
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(
    page.getByLabel("Email address").filter({ visible: true }),
  ).toBeEnabled();
  await expect(page.locator("canvas,.pixel-story")).toHaveCount(0);
  await expect(page.locator(".auth-visual-side")).toBeHidden();
  await page.screenshot({
    path: ".local/redmagic-mobile-login.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(
    page.getByLabel("Username", { exact: true }).filter({ visible: true }),
  ).toBeEnabled();
  await expect(page.locator("canvas,.pixel-story")).toHaveCount(0);
  await page.screenshot({
    path: ".local/redmagic-mobile-register.png",
    fullPage: true,
  });
  const loaded = (await Promise.all(scripts)).join("\n");
  expect(loaded).not.toMatch(
    /THREE\.WebGLRenderer|NEXOS original concept smartphone|machined concentric optical ring|Layered optical surfaces/,
  );
  expect(webgl).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("desktop WebGL denial has an explicit lightweight fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (type: string, ...args: unknown[]) {
        return type === "webgl2"
          ? null
          : Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(
    page.getByText("3D preview unavailable on this device."),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByLabel("Email address").filter({ visible: true }),
  ).toBeEnabled();
});

test("wide touch devices also keep the 3D scene unloaded", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport: { width: 1180, height: 820 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/register");
    await expect(
      page.getByLabel("Username", { exact: true }).filter({ visible: true }),
    ).toBeEnabled();
    await expect(page.locator("canvas,.pixel-story")).toHaveCount(0);
    await expect(page.locator(".auth-visual-side")).toBeHidden();
    expect(
      await page.evaluate(
        () => matchMedia("(hover: none) and (pointer: coarse)").matches,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
