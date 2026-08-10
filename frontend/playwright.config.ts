import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3417;
const databasePath = path.join(os.tmpdir(), `besat-e2e-${process.pid}.json`);
const distDirectory = process.env.BESAT_NEXT_DIST_DIR ?? ".next-playwright-mock";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";
const mockWebServer = {
  command: `node scripts/run-playwright-mock-server.mjs --port ${port}`,
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: false,
  timeout: 240_000,
  env: {
    BESAT_MOCK_DB_PATH: databasePath,
    BESAT_BACKEND_API_URL: "mock://local",
    BESAT_NEXT_DIST_DIR: distDirectory,
  },
};

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "real-django.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/playwright",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
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
  webServer: reuseExistingServer ? undefined : mockWebServer,
});
