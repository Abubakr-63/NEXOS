import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "4000";
if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535)
  throw new Error("Invalid Playwright API port");
const apiOrigin = `http://localhost:${apiPort}`;
const pnpmExe =
  process.env.PNPM_EXE ??
  (process.platform === "win32"
    ? "C:\\Users\\admin\\AppData\\Roaming\\npm\\pnpm.exe"
    : "pnpm");

const defaultBrowserPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
    ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    actionTimeout: 10000,
    navigationTimeout: 15000,
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    launchOptions: {
      args: ["--enable-unsafe-swiftshader"],
      ...(defaultBrowserPath ? { executablePath: defaultBrowserPath } : {}),
    },
  },
  webServer: [
    {
      command: `"${pnpmExe}" --filter @rom-hub/api start`,
      url: `${apiOrigin}/api/v1/health`,
      env: {
        ...process.env,
        PORT: apiPort,
        AUTH_ACCOUNT_HMAC_KEY: randomBytes(32).toString("hex"),
        WEB_ORIGIN: "http://localhost:3100",
        RATE_LIMIT_NAMESPACE: `nexos:test:e2e:${randomBytes(8).toString("hex")}`,
      },
      reuseExistingServer: true,
    },
    {
      command: `"${pnpmExe}" --filter @rom-hub/web start`,
      url: "http://localhost:3100",
      env: {
        ...process.env,
        PORT: "3100",
        API_ORIGIN: apiOrigin,
        NODE_ENV: "production",
      },
      reuseExistingServer: true,
    },
  ],
});
