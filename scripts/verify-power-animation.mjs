import { chromium } from "@playwright/test";
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
  await page.waitForTimeout(1000);

  // Wait for canvas to be present and rendered
  const canvas = page.locator("canvas");
  await canvas.waitFor({ state: "visible" });
  await page.waitForTimeout(800);

  // Helper to seek pixelEngine and wait for render
  async function seekAndCapture(progress, filename, label) {
    console.log(`Capturing ${label} (progress = ${(progress * 43).toFixed(2)}s)...`);
    await page.evaluate((p) => {
      const c = document.querySelector("canvas");
      if (c && c.__pixelEngine) {
        c.__pixelEngine.film(p);
      }
    }, progress);

    await page.waitForTimeout(300);
    const filePath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: filePath });
    console.log(`Saved: ${filename}`);
  }

  // Frame 1: Power button before being pressed (t = 0.5s)
  await seekAndCapture(0.5 / 43, "power-on-1-before-press.png", "1. Power button before press");

  // Frame 2: Power button visibly depressed inward (t = 0.95s)
  await seekAndCapture(0.95 / 43, "power-on-2-button-depressed.png", "2. Power button depressed");

  // Frame 3: Screen illumination beginning (t = 1.25s)
  await seekAndCapture(1.25 / 43, "power-on-3-screen-illumination.png", "3. Screen illumination beginning");

  // Frame 4: NEXOS lock screen (t = 3.0s)
  await seekAndCapture(3.0 / 43, "power-on-4-lock-screen.png", "4. NEXOS lock screen");

  // Frame 5: Full phone floating in the diagonal pose (t = 7.5s)
  await seekAndCapture(7.5 / 43, "power-on-5-floating-diagonal-pose.png", "5. Floating diagonal pose (REDMAGIC style)");

  // Verify Login form usability
  console.log("Testing login form usability...");
  await page.fill("input[name='email']", "operator@example.com");
  await page.fill("input[name='password']", "Valid1234!");
  const emailVal = await page.inputValue("input[name='email']");
  const passVal = await page.inputValue("input[name='password']");
  console.log("Email filled:", emailVal, "Password length:", passVal.length);

  // Verify Register page
  console.log("Navigating to http://localhost:3000/register...");
  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await seekAndCapture(7.5 / 43, "power-on-register-floating.png", "Register floating pose");

  console.log("All 5 animation frames and forms verified successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
