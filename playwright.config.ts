import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Tests share one database — keep them sequential
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    // Bundled Playwright browsers need macOS 13+; use the system Chrome instead
    channel: "chrome",
    locale: "fr-FR",
  },
  webServer: {
    // Boots embedded PostgreSQL + migrations + Next.js (see the script)
    command: "node tests/e2e/start-server.mjs",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
