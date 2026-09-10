import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { unitsMock, departmentsMock, tourScenesMock } = vi.hoisted(() => ({
  unitsMock: vi.fn(),
  departmentsMock: vi.fn(),
  tourScenesMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/services/public-content-service", () => ({
  getPublicUnits: unitsMock,
  getPublicDepartments: departmentsMock,
}));
vi.mock("@/services/virtual-tour-service", () => ({
  getPublicTourDoorScenes: tourScenesMock,
}));
vi.mock("@/components/virtual-tour/panorama-viewer", () => ({
  PanoramaViewer: () => <div data-testid="panorama-viewer" />,
}));
vi.mock("@/components/shared/besat-logo", () => ({
  BesatLogoMark: () => <span data-testid="besat-logo" />,
}));

const unit = {
  id: 1,
  title: "واحد آزمایشی",
  slug: "unit-a",
  description: "توضیح",
  cover_image: "/media/unit-a.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

// FE-VTOUR-LOBBY-LOAD-ERROR-001: the lobby's units/departments fetch used
// to have its failure swallowed by a bare `.catch(() => undefined)` -- a
// real outage left the lobby quietly showing zero destinations forever,
// with no alert and no way to retry.
describe("VirtualTourLobby lobby-level load error", () => {
  it("shows an alert with a retry button when the lobby fetch fails, and recovers on retry", async () => {
    unitsMock.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([unit]);
    departmentsMock.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([]);

    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("بارگذاری لابی تور مجازی با خطا مواجه شد.");

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /واحدهای آموزشی/ })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show the lobby error alert when the fetch succeeds", async () => {
    unitsMock.mockResolvedValue([unit]);
    departmentsMock.mockResolvedValue([]);

    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    await waitFor(() => expect(screen.getByRole("button", { name: /واحدهای آموزشی/ })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// FE-VTOUR-SCENE-LOAD-ERROR-001: a scene-list fetch failure used to be
// converted to the exact same selectedScenes=[] a door with genuinely zero
// published scenes produces -- indistinguishable to a visitor, who saw the
// ordinary "no panorama yet" copy for what was actually a backend outage.
describe("VirtualTourLobby scene-level load error", () => {
  async function openUnitDoor() {
    unitsMock.mockResolvedValue([unit]);
    departmentsMock.mockResolvedValue([]);

    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    fireEvent.click(await screen.findByRole("button", { name: /واحدهای آموزشی/ }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(unit.title) }));
  }

  it("shows an alert with a retry button when the scene fetch fails, distinct from the empty-door copy", async () => {
    tourScenesMock.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([]);
    await openUnitDoor();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("بارگذاری فضاهای این بخش با خطا مواجه شد.");
    expect(screen.queryByText(/تصویر پانورامای/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText(/تصویر پانورامای/)).toBeInTheDocument();
  });

  it("shows the ordinary empty-door copy, not an alert, when the door genuinely has zero scenes", async () => {
    tourScenesMock.mockResolvedValue([]);
    await openUnitDoor();

    await waitFor(() => expect(screen.getByText(/تصویر پانورامای/)).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// FE-TOUR-CORRIDOR-LOBBY-BACK-FOCUS-001: the wing-change focus effect
// only ever handled the forward direction (lobby -> a wing, moving focus
// to the corridor heading) -- pressing the corridor's own "بازگشت به
// لابی" button unmounted that button with nothing to move focus to, so
// a keyboard user's focus silently fell back to <body>.
describe("VirtualTourLobby corridor-to-lobby back focus", () => {
  it("does not steal focus to the lobby heading on initial mount", async () => {
    unitsMock.mockResolvedValue([unit]);
    departmentsMock.mockResolvedValue([]);

    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    await waitFor(() => expect(screen.getByRole("button", { name: /واحدهای آموزشی/ })).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: "کدام مسیر را می‌خواهید ببینید؟" })).not.toHaveFocus();
  });

  it("moves focus to the lobby heading after returning from a wing via the corridor's own back button", async () => {
    unitsMock.mockResolvedValue([unit]);
    departmentsMock.mockResolvedValue([]);

    const { VirtualTourLobby } = await import("@/components/virtual-tour/virtual-tour-lobby");
    render(<VirtualTourLobby />);

    fireEvent.click(await screen.findByRole("button", { name: /واحدهای آموزشی/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "واحدهای آموزشی بعثت" })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: /بازگشت به لابی/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "کدام مسیر را می‌خواهید ببینید؟" })).toHaveFocus(),
    );
  });
});
