import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

// OPS-QA-DIAGNOSTIC-SOURCE-002: a disposable QA-only probe test written
// directly under src/ and deleted right after use can collide with a
// separately-running full test invocation -- that run's file-collection
// phase can discover the file moments before it's deleted, then fail with
// a confusing "Cannot find module" partway through collection once the
// import is attempted. Vitest's globalSetup runs once, before collection
// begins, regardless of whether this project is invoked via `npm test`,
// `npm run test:unit`, or `npx vitest run` directly (an npm `pretest`
// script would only fire for the literal `test` script name and be
// bypassed entirely by a direct `vitest` invocation) -- so this is the one
// place that reliably applies across every invocation path. It cannot
// prevent the race outright (a stray file could still appear after this
// check runs), but it turns a leftover diagnostic file already present at
// startup into one clear, actionable failure instead of a confusing
// module-resolution error deep in collection.
const QA_ARTIFACT_PATTERN = /^__qa_/;

function findQaArtifacts(dir: string, found: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      findQaArtifacts(full, found);
    } else if (QA_ARTIFACT_PATTERN.test(entry)) {
      found.push(full);
    }
  }
}

export default function checkNoDiagnosticArtifacts() {
  // A `__qa_*` file explicitly named on the CLI (e.g. `vitest run
  // src/.../__qa_foo.test.tsx`, the normal way a disposable probe is
  // actually run and verified during development) is intentional, not a
  // stray leftover -- only flag files that AREN'T among the explicit
  // arguments for this invocation, so this guard never blocks the very
  // workflow it exists to keep safe.
  const explicitlyRequested = process.argv.some((arg) => QA_ARTIFACT_PATTERN.test(arg.split(/[\\/]/).pop() ?? ""));
  if (explicitlyRequested) return;

  const found: string[] = [];
  findQaArtifacts(join(CURRENT_DIR, ".."), found);
  if (found.length > 0) {
    throw new Error(
      "Stray disposable QA-only diagnostic file(s) found under frontend/src before the test run even started " +
        `(matches "${QA_ARTIFACT_PATTERN.source}"): ${found.join(", ")}. ` +
        "These must never be left in the tracked source tree -- move any temporary verification probe to " +
        ".agents/qa/frontend/ (or delete it) before rerunning.",
    );
  }
}
