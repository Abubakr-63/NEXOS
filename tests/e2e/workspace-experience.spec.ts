import { test, expect } from "./workspace-fixture";
import { defaultConfiguration } from "../../packages/contracts/src";

test("overview, project library, profile, settings and help have distinct real responsibilities", async ({
  page,
  workspace,
}) => {
  test.setTimeout(60000);
  await workspace();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: me.user.username, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No saved projects yet.", { exact: false }),
  ).toBeVisible();
  const catalog = await (await page.request.get("/api/v1/devices")).json();
  const variant = catalog.items.flatMap(
    (device: { variants: { id: string }[] }) => device.variants,
  )[0];
  expect(variant).toBeTruthy();
  const created = await page.request.post("/api/v1/projects", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      ...defaultConfiguration,
      name: "Cinematic acceptance draft",
      variantId: variant.id,
      base: "unconfigured",
    },
  });
  expect(created.status()).toBe(201);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", {
      name: `Welcome back, ${me.user.username}.`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue last project/ }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/autonomous-overview-desktop.png" });
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "My projects", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search loaded projects").fill("Cinematic acceptance");
  await expect(page.locator(".craft-grid").getByRole("link")).toHaveCount(1);
  await page.getByLabel("Search loaded projects").fill("No matching draft");
  await expect(
    page.getByRole("heading", { name: "No loaded projects match" }),
  ).toBeVisible();
  await page.getByLabel("Search loaded projects").fill("");
  await page.screenshot({ path: ".local/autonomous-library-desktop.png" });
  await page.goto("/profile");
  await expect(page.getByLabel("Preview a recent project")).toContainText(
    "Cinematic acceptance draft",
  );
  await expect(
    page.locator(".pixel-story button, .pixel-story input"),
  ).toHaveCount(0);
  await page.screenshot({ path: ".local/autonomous-profile-desktop.png" });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Active sessions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent project activity", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".craft-sidebar")
      .getByRole("link", { name: "Profile", exact: true }),
  ).toHaveAttribute("href", "/profile");
  await page
    .locator(".craft-sidebar")
    .getByRole("link", { name: "Help & documentation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Help & documentation", exact: true }),
  ).toBeVisible();
  await page.goto("/projects/new");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("A responsive concept");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-screen-name",
    "A responsive concept",
    { timeout: 15000 },
  );
  await expect(
    page.getByText("Generic concept · not a model of your selected device"),
  ).toBeVisible();
  await expect(
    page.getByText("Draft configuration · Cloud compilation unavailable"),
  ).toBeVisible();
  await page.screenshot({ path: ".local/autonomous-create-desktop.png" });
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: ".local/autonomous-create-mobile.png",
    fullPage: true,
  });
});
