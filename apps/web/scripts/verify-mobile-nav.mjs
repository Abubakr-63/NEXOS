import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function verifyMobileNav() {
  if (!existsSync(".local")) {
    mkdirSync(".local", { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  console.log("1. Authenticating via /register to access mobile workspace...");
  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  const id = Date.now().toString(36);
  await page.fill('input[name="username"]', `mob_${id}`);
  await page.fill('input[name="email"]', `mob_${id}@example.com`);
  await page.fill('input[name="password"]', "Password123!@#a");
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(settings|dashboard)/, { timeout: 15000 });
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  console.log("2. Verifying .mobile-dock presence and layout...");
  const dock = page.locator(".mobile-dock");
  await dock.waitFor({ state: "visible", timeout: 5000 });

  const items = dock.locator(".navigation-item");
  const count = await items.count();
  console.log(`Found ${count} navigation items in mobile dock.`);
  if (count !== 4) throw new Error(`Expected 4 items, found ${count}`);

  console.log("3. Verifying that text labels are visually hidden and accessible names remain intact...");
  for (let i = 0; i < 4; i++) {
    const item = items.nth(i);
    const label = item.locator(".navigation-label");
    const boundingBox = await label.boundingBox();
    const clip = await label.evaluate((el) => window.getComputedStyle(el).clip);
    const ariaLabel = await item.getAttribute("aria-label");
    console.log(`Item ${i}: aria-label="${ariaLabel}", label clip="${clip}", box=`, boundingBox);

    // Label must either have 0/1 size or clip rect(0, 0, 0, 0)
    if (boundingBox && boundingBox.width > 2 && boundingBox.height > 2) {
      throw new Error(`Label on item ${i} is visually visible! Box: ${JSON.stringify(boundingBox)}`);
    }

    // Icon must be visible and centered
    const icon = item.locator(".navigation-icon svg");
    await icon.waitFor({ state: "visible" });
  }

  console.log("4. Capturing Overview state screenshot...");
  await page.screenshot({ path: ".local/mobile-dock-overview.png" });

  console.log("5. Testing click on My projects...");
  const myProjectsLink = dock.getByRole("link", { name: "My projects" });
  await myProjectsLink.click();
  await page.waitForURL("**/projects", { timeout: 5000 });
  await page.waitForTimeout(600);
  console.log("Navigated to /projects successfully!");
  await page.screenshot({ path: ".local/mobile-dock-projects.png" });

  console.log("6. Testing click on Create ROM...");
  const createRomLink = dock.getByRole("link", { name: "Create ROM" });
  await createRomLink.click();
  await page.waitForURL("**/projects/new", { timeout: 5000 });
  await page.waitForTimeout(600);
  console.log("Navigated to /projects/new successfully!");
  await page.screenshot({ path: ".local/mobile-dock-createrom.png" });

  console.log("7. Testing click on More navigation button...");
  const moreButton = dock.getByRole("button", { name: "More navigation" });
  await moreButton.click();
  const dialog = page.locator("#more-navigation");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  console.log("More dialog opened successfully!");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  console.log("8. Testing click on Overview...");
  const overviewLink = dock.getByRole("link", { name: "Overview" });
  await overviewLink.click();
  await page.waitForURL("**/dashboard", { timeout: 5000 });
  console.log("Navigated back to /dashboard successfully!");

  await browser.close();
  console.log("Mobile bottom navigation verified 100% successfully!");
}

verifyMobileNav().catch((err) => {
  console.error("Mobile nav verification failed:", err);
  process.exit(1);
});

