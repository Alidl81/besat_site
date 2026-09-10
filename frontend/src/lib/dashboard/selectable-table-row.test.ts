import { describe, expect, it, vi } from "vitest";
import { handleSelectableRowKeyDown } from "./selectable-table-row";

function makeEvent(overrides: Partial<{ key: string; sameTarget: boolean }> = {}) {
  const row = {} as EventTarget;
  const child = {} as EventTarget;
  const preventDefault = vi.fn();
  return {
    key: overrides.key ?? "Enter",
    target: overrides.sameTarget === false ? child : row,
    currentTarget: row,
    preventDefault,
  } as unknown as Parameters<typeof handleSelectableRowKeyDown>[0];
}

// A11Y-FE-REGISTRATION-ROW-SELECTION-001: selectable dashboard table rows
// (registration/editorial/students workspaces) were pointer-only. This
// shared helper is what makes Enter/Space on the focused row select it,
// while ignoring the same keydown bubbling up from a nested interactive
// child (a row's own checkbox/edit button).
describe("handleSelectableRowKeyDown", () => {
  it("selects on Enter when the row itself is the event target", () => {
    const onSelect = vi.fn();
    const event = makeEvent({ key: "Enter" });

    handleSelectableRowKeyDown(event, onSelect);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("selects on Space when the row itself is the event target", () => {
    const onSelect = vi.fn();
    const event = makeEvent({ key: " " });

    handleSelectableRowKeyDown(event, onSelect);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("ignores an unrelated key", () => {
    const onSelect = vi.fn();
    const event = makeEvent({ key: "Tab" });

    handleSelectableRowKeyDown(event, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores Enter/Space bubbling up from a nested interactive child (e.g. the row's own checkbox)", () => {
    const onSelect = vi.fn();
    const event = makeEvent({ key: "Enter", sameTarget: false });

    handleSelectableRowKeyDown(event, onSelect);

    expect(onSelect).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
