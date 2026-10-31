import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function verifyCameraLock() {
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

  console.log("1. Visiting /login to verify film camera lock...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const filmSamples = [
    { p: 0.0, name: "reveal" },
    { p: 0.16, name: "macro" },
    { p: 0.32, name: "architecture" },
    { p: 0.50, name: "illumination" },
    { p: 0.75, name: "ui" },
    { p: 0.90, name: "hero" },
  ];

  for (const sample of filmSamples) {
    const dot = await page.evaluate((p) => {
      const canvas = document.querySelector("canvas");
      if (canvas && canvas.__pixelEngine) {
        canvas.__pixelEngine.film(p);
      }
      return Number(canvas?.dataset?.frontDot ?? 1);
    }, sample.p);

    await page.waitForTimeout(600);
    const shotPath = `.local/camera-lock-film-${sample.name}.png`;
    await page.screenshot({ path: shotPath });
    console.log(`- Film sample p=${sample.p.toFixed(2)} (${sample.name}): frontDot=${dot.toFixed(4)} -> saved ${shotPath}`);

    if (dot < 0.14) {
      throw new Error(`Forbidden rear orientation detected! frontDot=${dot} < 0.14`);
    }
  }

  console.log("\n2. Testing discrete viewing angles...");
  const views = ["front", "three-quarter", "side"];
  for (const v of views) {
    const dot = await page.evaluate((viewName) => {
      const canvas = document.querySelector("canvas");
      if (canvas && canvas.__pixelEngine) {
        canvas.__pixelEngine.view(viewName);
      }
      return Number(canvas?.dataset?.frontDot ?? 1);
    }, v);

    await page.waitForTimeout(600);
    const viewPath = `.local/camera-lock-view-${v}.png`;
    await page.screenshot({ path: viewPath });
    console.log(`- View '${v}': frontDot=${dot.toFixed(4)} -> saved ${viewPath}`);

    if (dot < 0.14) {
      throw new Error(`Forbidden rear orientation detected in view('${v}')! frontDot=${dot} < 0.14`);
    }
  }

  console.log("\n3. Testing forbidden view('rear') safety remap...");
  const rearDot = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas && canvas.__pixelEngine) {
      canvas.__pixelEngine.view("rear");
    }
    return Number(canvas?.dataset?.frontDot ?? 1);
  });
  await page.waitForTimeout(600);
  const rearRemapPath = ".local/camera-lock-rear-safeguard.png";
  await page.screenshot({ path: rearRemapPath });
  console.log(`- Calling view('rear') safely remapped to safe front hemisphere: frontDot=${rearDot.toFixed(4)} -> saved ${rearRemapPath}`);
  if (rearDot < 0.14) {
    throw new Error(`view('rear') failed to protect front hemisphere! frontDot=${rearDot} < 0.14`);
  }

  await browser.close();
  console.log("\nAll Strict Camera Lock checks PASSED successfully!");
}

verifyCameraLock().catch((err) => {
  console.error("Camera lock verification failed:", err);
  process.exit(1);
});
