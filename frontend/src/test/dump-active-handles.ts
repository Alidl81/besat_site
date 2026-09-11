import { afterEach, beforeEach } from "vitest";

// OPS-QA-FULL-SUITE-HANG-001: opt-in diagnostic for a full-suite stall that
// could not be reproduced locally across 4 investigation rounds. Codex's
// own telemetry (a single live worker, ~310MiB RSS -- modest, not resource
// exhaustion -- and no competing Vitest process) rules out memory pressure
// or a competing process; the remaining unknown is whether a leaked timer,
// an open socket, or an unresolved real network call keeps Node's event
// loop alive/blocked after a specific test file, since Codex's own report
// explicitly asked for "per-file isolation/handle diagnostics." Gated
// behind BESAT_TEST_HANDLE_DUMP so it costs nothing and changes no
// behavior in the normal `npm test`/`npm run test:unit` path -- only
// `npm run test:diagnose` sets that variable.
if (process.env.BESAT_TEST_HANDLE_DUMP) {
  let currentTest = "(none yet)";

  beforeEach((context: unknown) => {
    const ctx = context as { task?: { name?: string; file?: { name?: string } } };
    currentTest = `${ctx.task?.file?.name ?? "?"} > ${ctx.task?.name ?? "?"}`;
  });

  // No-op afterEach: exists only so `currentTest` reflects "whichever test
  // last STARTED" even if that test is the one that never finishes and
  // never reaches its own cleanup -- that's the exact case this exists to
  // diagnose, so nothing should run here that assumes normal completion.
  afterEach(() => undefined);

  type NodeProcessWithHandleIntrospection = NodeJS.Process & {
    _getActiveHandles?: () => unknown[];
    _getActiveRequests?: () => unknown[];
  };
  const nodeProcess = process as NodeProcessWithHandleIntrospection;

  const timer = setInterval(() => {
    const handles = nodeProcess._getActiveHandles?.() ?? [];
    const requests = nodeProcess._getActiveRequests?.() ?? [];
    const counts: Record<string, number> = {};
    for (const handle of handles) {
      const type =
        (handle as { constructor?: { name?: string } })?.constructor?.name ?? typeof handle;
      counts[type] = (counts[type] ?? 0) + 1;
    }
    console.error(
      `[handle-dump pid=${process.pid}] last test started: ${currentTest} | activeHandles=${handles.length} ${JSON.stringify(counts)} | activeRequests=${requests.length} | rss=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MiB`,
    );
  }, 5000);
  timer.unref();
}
