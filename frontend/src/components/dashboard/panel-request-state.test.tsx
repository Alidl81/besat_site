import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelEmpty, PanelError } from "@/components/dashboard/panel-request-state";

afterEach(() => cleanup());

// FE-PANEL-RETRY-DOUBLE-SUBMIT-001 (residual): usePanelRequest.reload()'s
// own ref guard already collapses two same-tick reload() calls, but a real
// browser can dispatch a second, genuinely later click on this same button
// before the parent's `loading` state has re-rendered PanelError away.
// Disabling the button the instant it's clicked closes that residual
// without requiring any of PanelError's ~20 consumers to thread a loading
// flag through onRetry.
describe("PanelError retry button", () => {
  it("disables the retry button immediately after it is clicked", () => {
    const onRetry = vi.fn();
    render(<PanelError message="خطای آزمایشی" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "تلاش دوباره" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it("still calls onRetry exactly once even if the disabled button is clicked again", () => {
    const onRetry = vi.fn();
    render(<PanelError message="خطای آزمایشی" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "تلاش دوباره" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// FE-PANEL-ADMIN-OVERVIEW-EMPTY-DENSITY-001: several dashboard overview Feed
// cards can render empty at once, and the default PanelEmpty height (sized
// for a standalone page/section) repeated 2-3 times dominated the no-data
// overview and pushed populated content below the fold. `compact` swaps to
// a shorter variant for that specific stacked-feed-card context.
describe("PanelEmpty compact variant", () => {
  it("uses the compact empty-state class when compact is set", () => {
    render(<PanelEmpty title="چیزی نیست" compact />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("panel-empty-state-compact");
    expect(status).not.toHaveClass("panel-empty-state");
  });

  it("uses the default empty-state class when compact is not set", () => {
    render(<PanelEmpty title="چیزی نیست" />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("panel-empty-state");
    expect(status).not.toHaveClass("panel-empty-state-compact");
  });
});
