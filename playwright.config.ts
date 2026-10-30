import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "4000";
if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535)
  throw new Error("Invalid Playwright API port");
const apiOrigin = `http://localhost:${apiPort}`;
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
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
  },
  webServer: [
    {
      command: "pnpm --filter @rom-hub/api start",
      url: `${apiOrigin}/api/v1/health`,
      env: {
        PORT: apiPort,
        AUTH_ACCOUNT_HMAC_KEY: randomBytes(32).toString("hex"),
        WEB_ORIGIN: "http://localhost:3100",
        RATE_LIMIT_NAMESPACE: `nexos:test:e2e:${randomBytes(8).toString("hex")}`,
      },
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @rom-hub/web start --port 3100",
      url: "http://localhost:3100",
      env: { API_ORIGIN: apiOrigin },
      reuseExistingServer: false,
    },
  ],
});
