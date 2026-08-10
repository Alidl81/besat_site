import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const backendPort = 8017;
const frontendPort = 3418;
const stateDirectory = process.env.BESAT_E2E_STATE_DIR;
const password = process.env.BESAT_E2E_ADMIN_PASSWORD;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";
const pythonExecutable =
  process.env.BESAT_E2E_PYTHON ?? (process.platform === "win32" ? "python.exe" : "python");
const quotedPythonExecutable =
  process.platform === "win32"
    ? `"${pythonExecutable.replaceAll('"', "")}"`
    : `'${pythonExecutable.replaceAll("'", "'\\''")}'`;

if (!stateDirectory) {
  throw new Error(
    "BESAT_E2E_STATE_DIR is required. Run npm run test:e2e:real so the isolated test state can be cleaned up.",
  );
}

if (!password) {
  throw new Error(
    "BESAT_E2E_ADMIN_PASSWORD is required and must be supplied through the environment.",
  );
}

const databasePath = path.join(stateDirectory, "backend.sqlite3").replaceAll("\\", "/");
const mediaRoot = path.join(stateDirectory, "media");
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

const backendEnvironment = {
  ...inheritedEnvironment,
  DJANGO_SETTINGS_MODULE: "config.settings.test",
  DJANGO_READ_DOT_ENV_FILE: "false",
  DATABASE_URL: `sqlite:///${databasePath}`,
  MEDIA_ROOT: mediaRoot,
  ALLOWED_HOSTS: `127.0.0.1,localhost`,
  CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
  CSRF_TRUSTED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
};
const realWebServers = [
  {
    name: "Django",
    command: `${quotedPythonExecutable} manage.py runserver 127.0.0.1:8017 --noreload`,
    cwd: path.resolve(__dirname, "../backend"),
    env: backendEnvironment,
    url: `http://127.0.0.1:${backendPort}/api/units/`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
  },
  {
    name: "Next production",
    command: `npm run build && npm run start -- --port ${frontendPort}`,
    cwd: __dirname,
    env: {
      ...inheritedEnvironment,
      BESAT_BACKEND_API_URL: `http://127.0.0.1:${backendPort}/api`,
      NEXT_PUBLIC_API_BASE_URL: "/api/backend",
      BESAT_NEXT_DIST_DIR: ".next-playwright-real",
    },
    url: `http://127.0.0.1:${frontendPort}`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
  },
];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "real-django.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/real-django-playwright",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-real-django" }]],
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
  projects: [
    {
      name: "production-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: reuseExistingServer ? undefined : realWebServers,
});
