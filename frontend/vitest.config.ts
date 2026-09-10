import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    // dump-active-handles.ts is a no-op unless BESAT_TEST_HANDLE_DUMP is
    // set (only test:diagnose sets it) -- see OPS-QA-FULL-SUITE-HANG-001.
    setupFiles: ["./src/test/setup.ts", "./src/test/dump-active-handles.ts"],
    // OPS-QA-DIAGNOSTIC-SOURCE-002: fails the whole run early, with one
    // clear message, if a disposable QA-only probe test was left behind
    // under src/ instead of being cleaned up -- see
    // src/test/check-no-diagnostic-artifacts.ts for the full reasoning on
    // why this lives here (globalSetup) rather than an npm `pretest`
    // script.
    globalSetup: ["./src/test/check-no-diagnostic-artifacts.ts"],
    clearMocks: true,
    // OPS-QA-FULL-SUITE-HANG-001: every test file in this project already
    // lives under src/ (verified: none under tests/e2e, scripts/, or
    // elsewhere) -- scoping the discovery glob to exactly that directory,
    // instead of relying only on the exclude list below to filter out
    // node_modules/.next/tests-e2e/public *after* Vitest's file-collector
    // has already walked them, reduces how much of this ~800MB
    // node_modules tree and the repo's other large non-test directories
    // the collector needs to traverse before a single test can run. Not
    // confirmed as the root cause of the intermittent full-suite stall
    // (unreproducible locally after 3 clean runs), but a legitimate,
    // low-risk narrowing regardless -- it cannot skip a real test file
    // (none exist outside src/) and only shrinks the search surface.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    // OPS-QA-FULL-SUITE-HANG-001 (round 6): the earlier "hang" reports
    // were never a stuck process -- Codex's own telemetry showed real
    // progress at 9-14 of 15 concurrently-spawned fork workers sitting in
    // Linux "D state" (uninterruptible sleep, i.e. blocked on I/O) while
    // free RAM fell to under 1GiB and swap was nearly exhausted. Vitest's
    // default worker count scales with the host's detected CPU count with
    // no awareness of how much memory each worker (a full jsdom + React/
    // Next.js/TipTap module graph) actually needs -- on a host with many
    // cores but limited RAM, that default (15 here) can spawn far more
    // concurrent heavy processes than the machine can hold without
    // swapping, and swap I/O is exactly the kind of "D state" stall
    // observed. Capping this explicitly bounds peak memory regardless of
    // host core count. 4 was chosen empirically: this suite's ~90 files
    // complete in seconds even fully serialized (--maxWorkers=1 finishes
    // in ~100s locally), so this project does not need aggressive
    // parallelism to stay fast -- the goal here is memory safety on a
    // constrained host, not shaving seconds off a run that's already fast
    // everywhere it isn't swapping. Does not affect test:diagnose, which
    // already passes its own --maxWorkers=1 on the CLI (CLI flags
    // override this file).
    maxWorkers: 4,
  },
});
