import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

if (!process.env.BESAT_E2E_ADMIN_PASSWORD) {
  throw new Error(
    "Set BESAT_E2E_ADMIN_PASSWORD in your environment before running the real-Django E2E lane.",
  );
}

const backendPort = 8017;
const frontendPort = 3418;
const stateDirectory = await mkdtemp(path.join(os.tmpdir(), "besat-phase2-e2e-"));
const rootDirectory = path.resolve(import.meta.dirname, "../..");
const backendDirectory = path.join(rootDirectory, "backend");
const frontendDirectory = path.join(rootDirectory, "frontend");
const pythonExecutable =
  process.env.BESAT_E2E_PYTHON ?? (process.platform === "win32" ? "python.exe" : "python");
const nextCli = path.join(frontendDirectory, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(frontendDirectory, "node_modules", "playwright", "cli.js");
const typeScriptConfigName = ".next-playwright-real.tsconfig.json";
const typeScriptConfigPath = path.join(frontendDirectory, typeScriptConfigName);
const environment = {
  ...process.env,
  BESAT_E2E_STATE_DIR: stateDirectory,
  DJANGO_SETTINGS_MODULE: "config.settings.test",
  DJANGO_READ_DOT_ENV_FILE: "false",
  DATABASE_URL: `sqlite:///${path.join(stateDirectory, "backend.sqlite3").replaceAll("\\", "/")}`,
};
const backendEnvironment = {
  ...environment,
  MEDIA_ROOT: path.join(stateDirectory, "media"),
  ALLOWED_HOSTS: "127.0.0.1,localhost",
  CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
  CSRF_TRUSTED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
};
const frontendEnvironment = {
  ...environment,
  BESAT_BACKEND_API_URL: `http://127.0.0.1:${backendPort}/api`,
  NEXT_PUBLIC_API_BASE_URL: "/api/backend",
  BESAT_NEXT_DIST_DIR: ".next-playwright-real",
  BESAT_NEXT_TSCONFIG_PATH: typeScriptConfigName,
};

function run(command, argumentsList, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      stdio: "inherit",
      windowsHide: true,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${argumentsList.join(" ")} exited with ${signal ?? `code ${code ?? "unknown"}`}.`,
        ),
      );
    });
  });
}

function start(command, argumentsList, options) {
  const child = spawn(command, argumentsList, {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  child.once("error", () => undefined);
  return child;
}

async function waitForServer(url, label, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be binding its socket or compiling its first request.
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready within two minutes.`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;

  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (child.pid && process.platform === "win32") {
    const taskkill = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const terminator = spawn(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise((resolve) => terminator.once("exit", resolve));
  }
  if (child.exitCode === null) child.kill();
  await Promise.race([exited, delay(5_000)]);
}

let databaseInitialized = false;
let backendServer;
let frontendServer;
let testFailure;
let cleanupFailure;

try {
  await run(pythonExecutable, ["manage.py", "migrate", "--noinput"], {
    cwd: backendDirectory,
    env: backendEnvironment,
  });
  databaseInitialized = true;
  await run(
    pythonExecutable,
    ["manage.py", "seed_phase2_demo", "--password-env", "BESAT_E2E_ADMIN_PASSWORD"],
    {
      cwd: backendDirectory,
      env: backendEnvironment,
    },
  );
  await writeFile(typeScriptConfigPath, '{\n  "extends": "./tsconfig.json"\n}\n');
  await run(process.execPath, [nextCli, "build"], {
    cwd: frontendDirectory,
    env: frontendEnvironment,
  });

  backendServer = start(
    pythonExecutable,
    ["manage.py", "runserver", `127.0.0.1:${backendPort}`, "--noreload"],
    { cwd: backendDirectory, env: backendEnvironment },
  );
  await waitForServer(`http://127.0.0.1:${backendPort}/api/units/`, "Django", backendServer);

  frontendServer = start(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
    { cwd: frontendDirectory, env: frontendEnvironment },
  );
  await waitForServer(`http://127.0.0.1:${frontendPort}/`, "Next production", frontendServer);

  await run(
    process.execPath,
    [playwrightCli, "test", "-c", "playwright.real-django.config.ts"],
    {
      cwd: frontendDirectory,
      env: { ...frontendEnvironment, PLAYWRIGHT_REUSE_SERVER: "1" },
    },
  );
} catch (error) {
  testFailure = error;
} finally {
  await stop(frontendServer);
  await stop(backendServer);
  await rm(typeScriptConfigPath, { force: true });
  if (databaseInitialized) {
    try {
      await run(pythonExecutable, ["manage.py", "cleanup_phase2_demo"], {
        cwd: backendDirectory,
        env: backendEnvironment,
      });
    } catch (error) {
      cleanupFailure = error;
    }
  }
  await rm(stateDirectory, { recursive: true, force: true });
}

if (testFailure) {
  throw testFailure;
}

if (cleanupFailure) {
  throw cleanupFailure;
}
