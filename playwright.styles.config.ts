import { defineConfig } from "@playwright/test";

// CSS regression checks run without an API, database, or authenticated account.
export default defineConfig({
  testDir: "./tests/styles",
  use: {
    baseURL: process.env.STYLE_TEST_URL ?? "http://localhost:3102",
    browserName: "chromium",
  },
  webServer: process.env.STYLE_TEST_URL
    ? undefined
    : {
        command: "pnpm --filter @rom-hub/web start --port 3102",
        url: "http://localhost:3102",
        reuseExistingServer: false,
      },
});
