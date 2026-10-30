import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function verify() {
  if (!existsSync(".local")) {
    mkdirSync(".local", { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  console.log("1. Visiting /login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/pixel-login-desktop.png" });

  console.log("2. Visiting /register...");
  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/pixel-register-desktop.png" });

  console.log("3. Registering real user through frontend UI...");
  const timestamp = Date.now().toString(36);
  const username = `pilot_${timestamp}`;
  const email = `pilot_${timestamp}@example.com`;
  const password = "Password123!@#a";

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to /settings or /dashboard
  await page.waitForURL(/\/(settings|dashboard)/, { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log("Successfully registered and logged in!");

  console.log("4. Visiting /dashboard (Overview)...");
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: ".local/pixel-overview-desktop.png" });

  console.log("5. Visiting /projects (My Projects)...");
  await page.goto("http://localhost:3000/projects", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/pixel-projects-desktop.png" });

  console.log("6. Visiting /projects/new (Create ROM)...");
  await page.goto("http://localhost:3000/projects/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Toggle calendar to trigger the autonomous reactive camera zoom & notification pill
  const calendarToggle = page.locator('button:has-text("Calendar"), input[value="calendar"], label:has-text("Calendar")').first();
  if (await calendarToggle.isVisible()) {
    console.log("Clicking calendar toggle to trigger reactive camera focus...");
    await calendarToggle.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: ".local/pixel-create-desktop.png" });

  console.log("7. Visiting /profile...");
  await page.goto("http://localhost:3000/profile", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/pixel-profile-desktop.png" });

  console.log("8. Visiting /settings...");
  await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: ".local/pixel-settings-desktop.png" });

  console.log("9. Mobile checks...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: ".local/pixel-login-mobile.png" });

  await mobilePage.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: ".local/pixel-register-mobile.png" });

  await browser.close();
  console.log("Browser verification finished successfully! Page errors:", errors);
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
