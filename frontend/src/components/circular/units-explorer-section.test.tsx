import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getPublicUnits } = vi.hoisted(() => ({ getPublicUnits: vi.fn() }));

vi.mock("@/services/public-content-service", () => ({
  getPublicUnits,
  getPublicDepartments: vi.fn(),
}));

import { UnitsExplorerSection } from "@/components/circular/units-explorer-section";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-UNITS-EXPLORER-LOAD-ERROR-001: a genuine load failure (network/5xx)
// used to be swallowed into the exact same empty-catalog state a real,
// legitimately-empty catalog renders -- a live outage probe found no
// alert and no retry button, just the normal "nothing to show" text.
describe("UnitsExplorerSection load-error handling", () => {
  it("excludes internal development units before rendering the public wheel", async () => {
    getPublicUnits.mockResolvedValueOnce([
      {
        id: 1,
        title: "واحد عمومی",
        slug: "public-unit",
        kind: "elementary",
        gender: "mixed",
        subtitle: null,
        description: null,
        is_internal: false,
      },
      {
        id: 99,
        title: "واحد توسعه داخلی",
        slug: "dev-unit",
        kind: "elementary",
        gender: "mixed",
        subtitle: null,
        description: null,
        is_internal: true,
      },
    ]);

    render(<UnitsExplorerSection variant="unit" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "واحد عمومی" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "واحد توسعه داخلی" })).not.toBeInTheDocument();
  });

  it("shows a named error alert with a retry action when the load fails, not the empty-catalog state", async () => {
    getPublicUnits.mockRejectedValueOnce(new Error("network down"));

    render(<UnitsExplorerSection variant="unit" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("بارگذاری واحدهای آموزشی با خطا مواجه شد.");
    expect(screen.queryByText("موردی برای نمایش وجود ندارد.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
  });

  it("recovers and clears the error once the retry succeeds", async () => {
    getPublicUnits.mockRejectedValueOnce(new Error("network down"));
    getPublicUnits.mockResolvedValueOnce([]);

    render(<UnitsExplorerSection variant="unit" />);
    await screen.findByRole("alert");

    screen.getByRole("button", { name: "تلاش دوباره" }).click();

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("موردی برای نمایش وجود ندارد.")).toBeInTheDocument();
    expect(getPublicUnits).toHaveBeenCalledTimes(2);
  });

  it("still shows the plain empty-catalog state (no alert) when the load genuinely succeeds with zero items", async () => {
    getPublicUnits.mockResolvedValueOnce([]);

    render(<UnitsExplorerSection variant="unit" />);

    await waitFor(() => expect(screen.getByText("موردی برای نمایش وجود ندارد.")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
