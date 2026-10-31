import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/admin/.gemini/antigravity/brain/f25ceb66-4534-440e-8099-339408cdce7c";

async function run() {
  console.log("Launching Edge Chromium...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });

  // 1. Check EN
  const enHeading = await page.textContent("h1");
  console.log("Login heading (EN):", enHeading);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-login-en.png") });

  // 2. Switch to RU
  console.log("Switching to RU...");
  // Look for language switcher button
  const switcherBtn = page.locator("button.lang-switch-btn");
  if (await switcherBtn.isVisible()) {
    await switcherBtn.click();
    await page.waitForTimeout(300);
    // Click Russian option
    const ruOption = page.locator(".lang-dropdown-option[data-locale='ru']");
    if (await ruOption.isVisible()) {
      await ruOption.click();
    } else {
      // Fallback: click button with text Русский
      await page.locator("button:has-text('Русский')").click();
    }
  } else {
    // Set cookie directly and reload
    await context.addCookies([{ name: "nexos_locale", value: "ru", domain: "localhost", path: "/" }]);
    await page.reload({ waitUntil: "networkidle" });
  }

  await page.waitForTimeout(500);
  const ruHeading = await page.textContent("h1");
  console.log("Login heading (RU):", ruHeading);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-login-ru.png") });

  // 3. Switch to TG
  console.log("Switching to TG...");
  if (await switcherBtn.isVisible()) {
    await switcherBtn.click();
    await page.waitForTimeout(300);
    const tgOption = page.locator(".lang-dropdown-option[data-locale='tg']");
    if (await tgOption.isVisible()) {
      await tgOption.click();
    } else {
      await page.locator("button:has-text('Тоҷикӣ')").click();
    }
  } else {
    await context.addCookies([{ name: "nexos_locale", value: "tg", domain: "localhost", path: "/" }]);
    await page.reload({ waitUntil: "networkidle" });
  }

  await page.waitForTimeout(500);
  const tgHeading = await page.textContent("h1");
  console.log("Login heading (TG):", tgHeading);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-login-tg.png") });

  // 4. Test Registration page in TG
  console.log("Navigating to http://localhost:3000/register...");
  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  const regTgHeading = await page.textContent("h1");
  console.log("Register heading (TG):", regTgHeading);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-register-tg.png") });

  // 5. Log in
  console.log("Logging in via API / web...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  
  // Fill credentials
  await page.fill("input[name='email']", "operator@example.com");
  await page.fill("input[name='password']", "Valid1234!");
  await page.click("button[type='submit']");
  await page.waitForTimeout(1500);

  console.log("Current URL after login:", page.url());

  // 6. Test Settings page
  console.log("Visiting /settings...");
  await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-settings-tg.png") });

  // 7. Test Overview page
  console.log("Visiting / ...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-overview-tg.png") });

  // 8. Test Projects / Create ROM
  console.log("Visiting /projects/new...");
  await page.goto("http://localhost:3000/projects/new", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-create-rom-tg.png") });

  // 9. Test Help page
  console.log("Visiting /help...");
  await page.goto("http://localhost:3000/help", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "i18n-help-tg.png") });

  console.log("Verification finished successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
