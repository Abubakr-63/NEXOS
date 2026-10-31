import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function captureViews() {
  if (!existsSync(".local")) {
    mkdirSync(".local", { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  console.log("1. Visiting /login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Capture Login page
  await page.screenshot({ path: ".local/pixel10pro-login.png" });
  console.log("Saved .local/pixel10pro-login.png");

  // 1. Capture pure front view
  console.log("2. Orienting to front view...");
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas && canvas.__pixelEngine) {
      canvas.__pixelEngine.view("front");
    }
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: ".local/pixel10pro-front.png" });
  console.log("Saved .local/pixel10pro-front.png");

  // 2. Capture pure rear view
  console.log("3. Orienting to rear view...");
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas && canvas.__pixelEngine) {
      canvas.__pixelEngine.view("rear");
    }
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: ".local/pixel10pro-back.png" });
  console.log("Saved .local/pixel10pro-back.png");

  // 3. Capture rear 3/4 perspective view (matching media_1793381182640_a34b025e.webp)
  console.log("4. Orienting to rear 3/4 perspective view...");
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas && canvas.__pixelEngine) {
      canvas.__pixelEngine.view("rear-angle");
    }
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: ".local/pixel10pro-rear-angle.png" });
  console.log("Saved .local/pixel10pro-rear-angle.png");

  // 4. Capture side profile view (matching media_1793381074466_c4126c66.jpg)
  console.log("5. Orienting to side profile view...");
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas && canvas.__pixelEngine) {
      canvas.__pixelEngine.view("side");
    }
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: ".local/pixel10pro-side.png" });
  console.log("Saved .local/pixel10pro-side.png");

  await browser.close();
  console.log("All views captured successfully!");
}

captureViews().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
