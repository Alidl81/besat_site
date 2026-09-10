import { describe, expect, it } from "vitest";
import { nextTableInspectorState } from "./editorial-workspace";
import type { ActiveBlockContext } from "@/components/editor/rich-editor";

function tableBlock(index: number): Pick<ActiveBlockContext, "kind" | "index"> {
  return { kind: "table", index };
}

function nonTableBlock(index = 0): Pick<ActiveBlockContext, "kind" | "index"> {
  return { kind: "callout", index };
}

describe("nextTableInspectorState (CMS-001 regression)", () => {
  it("does not reset while staying inside the same table", () => {
    const result = nextTableInspectorState(tableBlock(2), 2);
    expect(result.shouldReset).toBe(false);
    expect(result.lastActiveTableIndex).toBe(2);
  });

  it("resets when moving from Table A directly to Table B", () => {
    // Table A (index 2) was explicitly opened -- simulated by the caller
    // already having lastActiveTableIndex = 2. The user then moves the
    // caret straight into Table B (index 5) without clicking its trigger.
    const result = nextTableInspectorState(tableBlock(5), 2);

    expect(result.shouldReset).toBe(true);
    expect(result.lastActiveTableIndex).toBe(5);
  });

  it("resets when leaving a table for a non-table block", () => {
    const result = nextTableInspectorState(nonTableBlock(), 2);
    expect(result.shouldReset).toBe(true);
    expect(result.lastActiveTableIndex).toBeNull();
  });

  it("resets when entering a table from a non-table block", () => {
    const result = nextTableInspectorState(tableBlock(0), null);
    expect(result.shouldReset).toBe(true);
    expect(result.lastActiveTableIndex).toBe(0);
  });

  it("does not reset when there is no active block and there was none before", () => {
    const result = nextTableInspectorState(null, null);
    expect(result.shouldReset).toBe(false);
  });

  it("full A -> B -> A sequence requires a fresh explicit open each time", () => {
    // This is the exact regression scenario: Table A explicitly opened,
    // then Table B selected (must reset), then back to Table A (must also
    // reset -- re-entering the same table later still requires a fresh
    // click per the component's documented intent).
    let last: number | null = null;

    // Enter Table A.
    let step = nextTableInspectorState(tableBlock(2), last);
    last = step.lastActiveTableIndex;
    expect(step.shouldReset).toBe(true); // null -> 2

    // (Explicit click on Table A's trigger would set requested=true here;
    // not modeled by this pure function -- that's the component's job.)

    // Move directly to Table B without clicking its trigger.
    step = nextTableInspectorState(tableBlock(5), last);
    last = step.lastActiveTableIndex;
    expect(step.shouldReset).toBe(true); // 2 -> 5, must force a reset

    // Move back to Table A.
    step = nextTableInspectorState(tableBlock(2), last);
    expect(step.shouldReset).toBe(true); // 5 -> 2, must force a reset
  });
});
