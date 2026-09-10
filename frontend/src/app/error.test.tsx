import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
  usePathname: () => "/",
}));

import GlobalError from "@/app/error";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// REL-FE-BACKEND-TIMEOUT-001-R4: same fix as shop/[slug]/error.tsx --
// reset() alone does not reliably re-invoke a Server Component that threw
// during its initial render; router.refresh() is needed to force a fresh
// server request.
describe("GlobalError retry", () => {
  it("calls both router.refresh() and reset() when the retry button is clicked", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc" });

    render(<GlobalError error={error} reset={reset} />);
    screen.getByRole("button", { name: "بارگذاری مجدد" }).click();

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // REL-FE-BACKEND-TIMEOUT-RETRY-DOUBLE-REFRESH-001: same double-click
  // guard as the sibling boundary.
  it("ignores a second same-turn click while the first retry is still pending", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc" });

    render(<GlobalError error={error} reset={reset} />);
    const button = screen.getByRole("button", { name: "بارگذاری مجدد" });

    // See the sibling shop/[slug]/error.test.tsx for why this needs a
    // synchronous ref guard rather than relying on `isRetrying` state.
    button.click();
    button.click();

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
