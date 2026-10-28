import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          },
        }
      : {}),
  },
  webServer: [
    {
      command: "pnpm --filter @rom-hub/api start",
      url: "http://localhost:4000/api/v1/health",
      env: { PORT: "4000", WEB_ORIGIN: "http://localhost:3100" },
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @rom-hub/web start --port 3100",
      url: "http://localhost:3100",
      env: { API_ORIGIN: "http://localhost:4000" },
      reuseExistingServer: false,
    },
  ],
});
