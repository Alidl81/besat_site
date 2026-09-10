import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationGradeSelector } from "./registration-grade-selector";
import { RegistrationUnitSelector } from "./registration-unit-selector";
import type { PublicSchoolUnit } from "@/types/public-content";

afterEach(() => cleanup());

function makeUnit(overrides: Partial<PublicSchoolUnit> = {}): PublicSchoolUnit {
  return {
    id: 1,
    title: "واحد دبستان دخترانه",
    slug: "girls-elementary",
    kind: "elementary",
    gender: "girls",
    subtitle: null,
    description: null,
    cover_image: null,
    icon: null,
    age_range: null,
    grade_range: null,
    address: null,
    phone: null,
    phone_secondary: null,
    email: null,
    office_hours: null,
    map_url: null,
    latitude: null,
    longitude: null,
    accepts_registration: true,
    ...overrides,
  };
}

// A11Y-FE-REGISTRATION-COLLAPSED-OPTIONS-001: both custom selectors keep
// their options container mounted at all times (only max-h-0/opacity-0
// when closed, so the open/close CSS transition can animate), which means
// every option <button> stays focusable by default unless explicitly
// removed from the tab order -- Tab from the closed trigger landed inside
// the invisible options list instead of moving to the next real control.
describe("registration selectors do not expose collapsed options to Tab", () => {
  it("grade selector: options are tabIndex=-1 and aria-hidden while closed, then real again once opened", () => {
    const units = [makeUnit()];
    render(<RegistrationGradeSelector units={units} selectedUnitId="1" />);

    const container = document.getElementById("registration-grade-options");
    expect(container).toHaveAttribute("aria-hidden", "true");
    const optionButtons = within(container!).getAllByRole("button", { hidden: true });
    expect(optionButtons.length).toBeGreaterThan(0);
    for (const button of optionButtons) {
      expect(button).toHaveAttribute("tabindex", "-1");
    }

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(container).toHaveAttribute("aria-hidden", "false");
    for (const button of optionButtons) {
      expect(button).toHaveAttribute("tabindex", "0");
    }
  });

  it("unit selector (mobile): options are tabIndex=-1 and aria-hidden while closed, then real again once opened", () => {
    const units = [makeUnit({ id: 1 }), makeUnit({ id: 2, title: "واحد دبیرستان دخترانه", kind: "high_school" })];
    render(
      <RegistrationUnitSelector units={units} selectedUnitId="1" onSelect={vi.fn()} display="mobile" />,
    );

    const container = document.getElementById("registration-unit-options");
    expect(container).toHaveAttribute("aria-hidden", "true");
    const optionButtons = within(container!).getAllByRole("button", { hidden: true });
    expect(optionButtons.length).toBe(2);
    for (const button of optionButtons) {
      expect(button).toHaveAttribute("tabindex", "-1");
    }

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(container).toHaveAttribute("aria-hidden", "false");
    for (const button of optionButtons) {
      expect(button).toHaveAttribute("tabindex", "0");
    }
  });
});
