import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const port = 3417;
const frontendDirectory = path.resolve(import.meta.dirname, "..");
const nextCli = path.join(frontendDirectory, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(frontendDirectory, "node_modules", "playwright", "cli.js");
const distDirectoryName = `.next-playwright-mock-${process.pid}`;
const distDirectory = path.join(frontendDirectory, distDirectoryName);
const typeScriptConfigName = `.next-playwright-mock-${process.pid}.tsconfig.json`;
const typeScriptConfigPath = path.join(frontendDirectory, typeScriptConfigName);
const databasePath = path.join(os.tmpdir(), `besat-e2e-${process.pid}.json`);
const environment = {
  ...process.env,
  BESAT_BACKEND_API_URL: "mock://local",
  BESAT_MOCK_DB_PATH: databasePath,
  BESAT_NEXT_DIST_DIR: distDirectoryName,
  BESAT_NEXT_TSCONFIG_PATH: typeScriptConfigName,
  NEXT_TELEMETRY_DISABLED: "1",
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

async function waitForServer(child) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("The Playwright mock server exited before becoming ready.");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The production build/start process is still starting.
    }
    await delay(500);
  }
  throw new Error("The Playwright mock server did not become ready within three minutes.");
}

function ensurePortIsAvailable() {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`Port ${port} is already in use; refusing to reuse an unknown server.`));
    });
    socket.once("error", (error) => {
      if (typeof error === "object" && error && "code" in error && error.code === "ECONNREFUSED") {
        resolve();
        return;
      }
      reject(error);
    });
  });
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

let nextServer;
let testFailure;

try {
  await ensurePortIsAvailable();
  await writeFile(typeScriptConfigPath, '{\n  "extends": "./tsconfig.json"\n}\n');
  await run(process.execPath, ["tests/e2e/prepare-db.mjs"], {
    cwd: frontendDirectory,
    env: environment,
  });
  await run(process.execPath, [nextCli, "build", "--webpack"], {
    cwd: frontendDirectory,
    env: environment,
  });
  nextServer = start(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: frontendDirectory, env: environment },
  );
  await waitForServer(nextServer);
  await run(
    process.execPath,
    [playwrightCli, "test", ...process.argv.slice(2)],
    {
      cwd: frontendDirectory,
      env: { ...environment, PLAYWRIGHT_REUSE_SERVER: "1" },
    },
  );
} catch (error) {
  testFailure = error;
} finally {
  await stop(nextServer);
  await rm(distDirectory, { recursive: true, force: true });
  await rm(typeScriptConfigPath, { force: true });
  await rm(databasePath, { force: true });
}

if (testFailure) {
  throw testFailure;
}
