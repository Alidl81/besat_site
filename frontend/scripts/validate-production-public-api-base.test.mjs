import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptsDir, "validate-production-public-api-base.mjs");
const frontendDir = path.dirname(scriptsDir);

function runWith(value) {
  const env = { ...process.env };
  if (value === undefined) delete env.NEXT_PUBLIC_API_BASE_URL;
  else env.NEXT_PUBLIC_API_BASE_URL = value;
  return spawnSync(process.execPath, [script], { cwd: frontendDir, env, encoding: "utf8" });
}

// OPS-FE-PUBLIC-API-BASE-001-R1: an omitted Docker ARG becomes an empty
// string once assigned to ENV in frontend/Dockerfile (`ARG X` + `ENV X=$X`
// with no --build-arg resolves `$X` to "", not "unset") -- the actual state
// of every build using this Dockerfile today, since no compose file wires
// this ARG through. The validator must treat that the same as genuinely
// unset, or every such build fails before `next build` ever runs.
describe("validate-production-public-api-base script", () => {
  it("passes for the empty string Docker produces when the optional ARG is omitted", () => {
    const result = runWith("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("using default /api/backend");
  });

  it("passes when the variable is truly absent", () => {
    const result = runWith(undefined);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("using default /api/backend");
  });

  it("passes for the documented same-origin default", () => {
    const result = runWith("/api/backend");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("/api/backend");
  });

  it.each(["https://collector.example/api", "//collector.example/api", "/\\collector.example/api"])(
    "fails for an off-origin value %j",
    (value) => {
      const result = runWith(value);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not a same-origin relative path");
    },
  );
});
