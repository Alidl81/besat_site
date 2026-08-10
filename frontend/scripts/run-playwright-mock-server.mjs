import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const portArgumentIndex = process.argv.indexOf("--port");
const port =
  portArgumentIndex >= 0 ? process.argv[portArgumentIndex + 1] : undefined;

if (!port) {
  throw new Error("Provide --port when starting the Playwright mock server.");
}

const frontendDirectory = path.resolve(import.meta.dirname, "..");
const nextCli = path.join(frontendDirectory, "node_modules", "next", "dist", "bin", "next");

function run(command, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: frontendDirectory,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
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

await run(process.execPath, ["tests/e2e/prepare-db.mjs"]);
await run(process.execPath, [nextCli, "build"]);

const nextServer = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: frontendDirectory,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  },
);

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  nextServer.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

nextServer.once("error", (error) => {
  throw error;
});

nextServer.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
