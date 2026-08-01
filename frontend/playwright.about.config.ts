import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "about-cms.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
  },
  webServer: [
    {
      command: "node tests/e2e/about-api-stub.mjs",
      url: "http://127.0.0.1:3100/__health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --port 3000",
      url: "http://127.0.0.1:3000/about",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        USE_DJANGO_CMS_ABOUT: "true",
        DJANGO_CMS_API_BASE_URL: "http://127.0.0.1:3100/api/headless-cms",
        DJANGO_CMS_ABOUT_LANGUAGE: "fa-ir",
        ABOUT_FALLBACK_API_URL: "http://127.0.0.1:3100/api/about/",
        BESAT_BACKEND_API_URL: "http://127.0.0.1:3100/api",
        NEXT_SERVER_API_BASE_URL: "http://127.0.0.1:3100/api",
        NEXT_PUBLIC_API_BASE_URL: "/api/backend",
      },
    },
  ],
});
