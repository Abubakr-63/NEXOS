import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

const ARTIFACT_DIR = "C:/Users/admin/.gemini/antigravity/brain/f25ceb66-4534-440e-8099-339408cdce7c";
const EXPECTED_FILENAME = "PixelExperience_Plus_mojito-11.0-20211009-1327-OFFICIAL.zip";
const EXPECTED_SIZE = 1375104164;
const EXPECTED_SHA256 = "39807bfa2b0a0c8569b37f745bcdeb14c0a1c8530f7e5f997a93b058c044f215";

async function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function run() {
  console.log("=== NEXOS Prebuilt ROM Download Verification ===");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexos-prebuilt-verify-"));
  console.log("Temporary download directory:", tempDir);

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    downloadsPath: tempDir,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // 1. Register or Log in
  console.log("Step 1: Logging in...");
  const testEmail = `operator_demo_${Date.now()}@nexos.studio`;
  const testPassword = "SecurePass1234!";
  const testUsername = `user_${Date.now().toString().slice(-6)}`;

  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
  await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").first().fill(testEmail);
  await page.locator("input[name='username'], input[placeholder*='username' i]").first().fill(testUsername);
  await page.locator("input[type='password']").first().fill(testPassword);
  await page.locator("button[type='submit']").first().click();

  // Wait for redirect to dashboard or workspace
  await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 10000 });
  console.log("Registered and redirected to:", page.url());

  // 2. Navigate to /projects/new
  console.log("Step 2: Navigating to /projects/new...");
  await page.goto("http://localhost:3000/projects/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Fill Step 0 (Identity)
  console.log("Filling Step 0 (Identity)...");
  await page.locator("input[required]").first().fill("Xiaomi Sunny Prebuilt Demo");
  await page.locator("textarea").fill("Testing real prebuilt ROM download from backend");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(500);

  // Step 1: Device Selection
  console.log("Step 1 (Target Device)...");
  // Select manufacturer
  const mfgSelect = page.locator("select").first();
  await mfgSelect.waitFor({ state: "visible" });

  // Find Xiaomi in options
  const options = await mfgSelect.locator("option").all();
  let xiaomiVal = "";
  for (const opt of options) {
    const text = await opt.textContent();
    if (text?.toLowerCase().includes("xiaomi")) {
      xiaomiVal = (await opt.getAttribute("value")) || "";
      break;
    }
  }
  console.log("Xiaomi manufacturer option value:", xiaomiVal);
  if (xiaomiVal) {
    await mfgSelect.selectOption(xiaomiVal);
    await page.waitForTimeout(800);
  }

  // Select Device
  const deviceSelect = page.locator("select").nth(1);
  await deviceSelect.waitFor({ state: "visible" });
  const devOptions = await deviceSelect.locator("option").all();
  let mojitoVal = "";
  for (const opt of devOptions) {
    const text = await opt.textContent();
    if (text?.includes("mojito") || text?.includes("Redmi Note 10")) {
      mojitoVal = (await opt.getAttribute("value")) || "";
      break;
    }
  }
  console.log("Device mojito option value:", mojitoVal);
  if (mojitoVal) {
    await deviceSelect.selectOption(mojitoVal);
    await page.waitForTimeout(500);
  }

  // Select Variant
  const variantSelect = page.locator("select").nth(2);
  await variantSelect.waitFor({ state: "visible" });
  const varOptions = await variantSelect.locator("option").all();
  let variantVal = "";
  for (const opt of varOptions) {
    const text = await opt.textContent();
    if (text?.includes("M2101K7AG") || text?.includes("4G")) {
      variantVal = (await opt.getAttribute("value")) || "";
      break;
    }
  }
  console.log("Variant option value:", variantVal);
  if (variantVal) {
    await variantSelect.selectOption(variantVal);
    await page.waitForTimeout(500);
  }

  // Verify prebuilt banner appears on Step 1
  const banner = page.locator(".prebuilt-available-banner");
  await banner.waitFor({ state: "visible", timeout: 5000 });
  console.log("Step 1: Prebuilt ROM banner is visible!");

  // Click continue to Step 2
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(800);

  // Step 2: Base Selection
  console.log("Step 2 (Android Base)...");
  const baseSelect = page.locator("select").first();
  await baseSelect.waitFor({ state: "visible" });

  // Select PixelExperience Plus
  await baseSelect.selectOption("pixelexperience-plus-mojito-android11");
  await page.waitForTimeout(1000);

  // Verify PrebuiltRomCard is rendered
  const prebuiltCard = page.locator(".prebuilt-rom-card");
  await prebuiltCard.waitFor({ state: "visible", timeout: 8000 });
  console.log("Prebuilt ROM Card is visible!");

  // Verify card content
  const cardTitle = await page.locator(".prebuilt-card-title").textContent();
  console.log("Card title:", cardTitle);
  if (!cardTitle?.includes("PixelExperience Plus")) {
    throw new Error(`Unexpected card title: ${cardTitle}`);
  }

  const noticeText = await page.locator(".prebuilt-notice-text").textContent();
  console.log("Notice text:", noticeText);
  if (!noticeText?.includes("NEXOS did not compile this file")) {
    throw new Error(`Notice text missing verbatim required phrasing: ${noticeText}`);
  }

  const warningText = await page.locator(".prebuilt-warning-text").textContent();
  console.log("Warning text:", warningText);

  // Capture screenshot of Prebuilt ROM card in Step 2
  const step2ScreenshotPath = path.join(ARTIFACT_DIR, "prebuilt-rom-step2-card.png");
  await page.screenshot({ path: step2ScreenshotPath, fullPage: true });
  console.log("Captured Step 2 screenshot:", step2ScreenshotPath);

  // Test Step 3 (Review)
  console.log("Proceeding to Step 3 (Review)...");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(800);

  const reviewDownloadButton = page.locator("[data-testid='prebuilt-rom-download-button']");
  await reviewDownloadButton.waitFor({ state: "visible", timeout: 8000 });
  console.log("Step 3: Prebuilt ROM Card and download button are visible in Review!");

  const step3ScreenshotPath = path.join(ARTIFACT_DIR, "prebuilt-rom-step3-review.png");
  await page.screenshot({ path: step3ScreenshotPath, fullPage: true });
  console.log("Captured Step 3 screenshot:", step3ScreenshotPath);

  // Test Real Download Click
  console.log("Step 4: Clicking Download ROM button to test real browser download...");
  const downloadButton = page.locator("[data-testid='prebuilt-rom-download-button']");
  await downloadButton.waitFor({ state: "visible" });

  const downloadHref = await downloadButton.getAttribute("href");
  console.log("Download button href:", downloadHref);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    downloadButton.click(),
  ]);

  const suggestedFilename = download.suggestedFilename();
  console.log("Download suggested filename:", suggestedFilename);
  if (suggestedFilename !== EXPECTED_FILENAME) {
    throw new Error(`Filename mismatch: got ${suggestedFilename}, expected ${EXPECTED_FILENAME}`);
  }

  const destinationPath = path.join(tempDir, suggestedFilename);
  console.log("Streaming downloaded file to:", destinationPath);
  await download.saveAs(destinationPath);

  const stat = fs.statSync(destinationPath);
  console.log("Downloaded file size:", stat.size, "bytes");
  if (stat.size !== EXPECTED_SIZE) {
    throw new Error(`Size mismatch: got ${stat.size}, expected ${EXPECTED_SIZE}`);
  }

  console.log("Computing SHA-256 checksum of downloaded archive...");
  const actualSha256 = await computeSha256(destinationPath);
  console.log("Computed SHA-256:", actualSha256);
  if (actualSha256 !== EXPECTED_SHA256) {
    throw new Error(`SHA-256 mismatch: got ${actualSha256}, expected ${EXPECTED_SHA256}`);
  }
  console.log("SHA-256 checksum verification PASSED!");

  // Clean up downloaded file
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("Cleaned up temporary download directory.");
  } catch (e) {
    console.warn("Cleanup warning:", e.message);
  }

  // Test Unsupported Selection Behavior
  console.log("Step 5: Verifying unsupported selection cannot download...");
  // Jump back to Step 1 (Device)
  await page.locator(".studio-steps button").nth(1).click();
  await page.waitForTimeout(600);

  // Select another manufacturer (not Xiaomi)
  const allMfgOptions = await mfgSelect.locator("option").all();
  for (const opt of allMfgOptions) {
    const val = await opt.getAttribute("value");
    if (val && val !== xiaomiVal) {
      await mfgSelect.selectOption(val);
      console.log("Selected other manufacturer:", val);
      break;
    }
  }
  await page.waitForTimeout(800);

  // Select the first device for this manufacturer
  const otherDeviceSelect = page.locator("select").nth(1);
  await otherDeviceSelect.waitFor({ state: "visible" });
  const otherDevOptions = await otherDeviceSelect.locator("option").all();
  if (otherDevOptions.length > 1) {
    const val = await otherDevOptions[1].getAttribute("value");
    if (val) {
      await otherDeviceSelect.selectOption(val);
      await page.waitForTimeout(600);

      // Select variant
      const otherVarSelect = page.locator("select").nth(2);
      await otherVarSelect.waitFor({ state: "visible" });
      const otherVarOptions = await otherVarSelect.locator("option").all();
      if (otherVarOptions.length > 1) {
        const varVal = await otherVarOptions[1].getAttribute("value");
        if (varVal) {
          await otherVarSelect.selectOption(varVal);
          await page.waitForTimeout(500);
        }
      }

      // Check banner is NOT visible
      const bannerVisible = await page.locator(".prebuilt-available-banner").isVisible();
      console.log("Prebuilt banner visible for other device?", bannerVisible);
      if (bannerVisible) {
        throw new Error("Prebuilt banner should NOT be visible for unsupported device!");
      }

      // Proceed to Step 2
      await page.locator("button[type='submit']").click();
      await page.waitForTimeout(800);

      // Check base options in Step 2
      const updatedBaseOptions = await page.locator("select").first().locator("option").all();
      let hasPixelExperience = false;
      for (const opt of updatedBaseOptions) {
        const text = await opt.textContent();
        if (text?.includes("PixelExperience")) {
          hasPixelExperience = true;
          break;
        }
      }
      console.log("PixelExperience option present for unsupported device?", hasPixelExperience);
      if (hasPixelExperience) {
        throw new Error("PixelExperience option should NOT be available for unsupported devices!");
      }

      const cardVisible = await page.locator(".prebuilt-rom-card").isVisible();
      console.log("Prebuilt card visible for unsupported device?", cardVisible);
      if (cardVisible) {
        throw new Error("Prebuilt card should NOT be visible for unsupported devices!");
      }
    }
  }

  // Also verify backend directly rejects non-matching selection
  console.log("Verifying backend rejects invalid query selection (404)...");
  const rejectRes = await page.evaluate(async () => {
    const res = await fetch("http://localhost:4000/api/v1/prebuilt-roms/pixel-experience-plus-mojito-android11-20211009?manufacturer=xiaomi&device=redmi-note-10-5g&codename=camellian&rom=pixelexperience-plus&android=11", {
      credentials: "include"
    });
    return res.status;
  });
  console.log("Backend rejection status for Redmi Note 10 5G (camellian):", rejectRes);
  if (rejectRes !== 404) {
    throw new Error(`Expected 404 for unsupported selection, got ${rejectRes}`);
  }

  console.log("Unsupported selection properly rejected both in UI and API!");

  // Check console errors
  console.log("Verification completed successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
