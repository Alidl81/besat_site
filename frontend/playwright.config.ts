import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3417;
const databasePath = path.join(os.tmpdir(), `besat-e2e-${process.pid}.json`);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/playwright",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      use: {
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "laptop",
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1536, height: 960 } },
    },
  ],
  webServer: {
    command: `node tests/e2e/prepare-db.mjs && node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
    env: {
      BESAT_MOCK_DB_PATH: databasePath,
      BESAT_BACKEND_API_URL: "mock://local",
    },
  },
});
