#!/usr/bin/env node
// OPS-QA-FULL-SUITE-HANG-001: sets BESAT_TEST_HANDLE_DUMP for the child
// `vitest` process portably across shells (plain `VAR=value` prefix syntax
// in an npm script is not reliable on native Windows, where npm scripts run
// through cmd.exe by default rather than a POSIX shell) without adding a
// new dependency (e.g. cross-env) just for this one diagnostic script.
import { spawnSync } from "node:child_process";

const extraArgs = process.argv.slice(2);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "--reporter=verbose", "--pool=forks", "--maxWorkers=1", "--no-file-parallelism", ...extraArgs],
  {
    stdio: "inherit",
    // Windows resolves npx to a .cmd shim, which spawnSync can only invoke
    // through a shell (a bare spawnSync otherwise fails with EINVAL).
    shell: process.platform === "win32",
    env: { ...process.env, BESAT_TEST_HANDLE_DUMP: "1" },
  },
);

process.exit(result.status ?? 1);
