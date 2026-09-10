import type { KeyboardEvent } from "react";

// A11Y-FE-REGISTRATION-ROW-SELECTION-001: dashboard list views (registration,
// editorial, students) select a row via a plain <tr onClick={...}>, which is
// pointer-only -- the row itself has no tabIndex/role and no keyboard
// activation, so a keyboard/AT user cannot discover or select a row at all.
// Shared here (not duplicated per file) since the same fix, including the
// same nested-interactive-element guard, is needed at all three call sites.
//
// FE-PANEL-MEDIA-REVIEW-MOBILE-CARD-KEYBOARD-001: the same defect and fix
// also applies to mobile card-based selection (editorial-workspace.tsx's
// `<article>` review cards), not just `<tr>` rows -- the guard logic is
// identical regardless of which host element is selectable, so the
// parameter type is generic rather than table-row-specific.
//
// The guard on `event.target !== event.currentTarget` matters specifically
// for rows/cards that also contain their own interactive children (a
// checkbox, an edit button) with their own `onClick={(e) =>
// e.stopPropagation()}` -- `stopPropagation()` only stops the click from
// bubbling, not a keydown, so without this guard, pressing Enter/Space
// while a nested control has focus would ALSO reselect the row on top of
// that control's own native activation (e.g. toggling a checkbox and
// reselecting the row at once).
export function handleSelectableRowKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onSelect: () => void,
) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect();
}
