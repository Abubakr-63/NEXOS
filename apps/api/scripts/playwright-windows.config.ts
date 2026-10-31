import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "../../../playwright.config";

// Keep local HTTP API tests separate from Next's production runtime mode.
const root = resolve(__dirname, "../../..");
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testDir: resolve(root, "tests/e2e"),
  outputDir: resolve(root, ".local/windows-runtime/e2e-results"),
  webServer: servers.map((server, index) => ({
    ...server,
    cwd: root,
    env: { ...server.env, NODE_ENV: index === 0 ? "test" : "production" },
  })),
});
