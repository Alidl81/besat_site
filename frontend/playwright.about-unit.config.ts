import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
});
