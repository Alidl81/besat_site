import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { workflowMock, createMock, deleteMock, updateMock, reloadMock } = vi.hoisted(() => ({
  workflowMock: vi.fn(),
  createMock: vi.fn(),
  deleteMock: vi.fn(),
  updateMock: vi.fn(),
  reloadMock: vi.fn(),
}));

const oneScene = {
  id: 41,
  title: "ورودی اصلی",
  status: "draft" as const,
  is_default: false,
  is_active: true,
  order: 0,
  unit: { id: 7, title: "واحد مرکزی", slug: "central" },
  department: null,
  panorama: null,
  thumbnail: null,
  door_key: "unit-7",
};

const twoScenes = [
  oneScene,
  { ...oneScene, id: 42, title: "ورودی دوم", order: 1 },
];

let sceneResults: typeof twoScenes = [oneScene];
let mockListError: string | null = null;

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({
    data: { results: sceneResults },
    loading: false,
    error: mockListError,
    reload: reloadMock,
  }),
}));

vi.mock("@/services/virtual-tour-cms-service", () => ({
  cmsGetTourScenes: vi.fn(),
  cmsGetTourScene: vi.fn(),
  cmsCreateTourScene: createMock,
  cmsCreateTourSceneWithProgress: vi.fn(),
  cmsUpdateTourScene: updateMock,
  cmsUpdateTourSceneWithProgress: vi.fn(),
  cmsDeleteTourScene: deleteMock,
  cmsRunTourSceneWorkflowAction: workflowMock,
  cmsGetTourHotspots: vi.fn(),
  cmsCreateTourHotspot: vi.fn(),
  cmsUpdateTourHotspot: vi.fn(),
  cmsDeleteTourHotspot: vi.fn(),
}));

vi.mock("@/lib/data/repositories", () => ({
  unitsRepository: { list: vi.fn().mockResolvedValue([]) },
  departmentsRepository: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/components/virtual-tour/panorama-viewer", () => ({
  PanoramaViewer: () => null,
}));

vi.mock("@/components/virtual-tour/tour-hotspot-editor", () => ({
  TourHotspotEditor: () => null,
}));

import { VirtualTourManager } from "@/components/virtual-tour/virtual-tour-manager";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  sceneResults = [oneScene];
  mockListError = null;
});

afterEach(() => {
  cleanup();
});

// FE-TOUR-MANAGER-ACTION-DOUBLE-SUBMIT-001 / FE-TOUR-SCENE-FORM-DOUBLE-
// SUBMIT-001 / FE-TOUR-MANAGER-DELETE-DOUBLE-SUBMIT-001 / FE-TOUR-MANAGER-
// REORDER-DOUBLE-SUBMIT-001: same guard/rationale as login-card.tsx's
// AUTH-UI-DOUBLE-SUBMIT-001, applied across every mutating action in this
// manager (workflow transitions, scene create/update, delete, reorder).
describe("VirtualTourManager duplicate-mutation guards", () => {
  it("collapses two same-turn workflow-action clicks to one request", async () => {
    const pending = createDeferred<unknown>();
    workflowMock.mockReturnValue(pending.promise);

    render(<VirtualTourManager role="general_manager" unitId="7" />);
    const buttons = screen.getAllByRole("button", { name: "ارسال برای بررسی" });
    expect(buttons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[0]);
    });

    expect(workflowMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });

  it("collapses two same-turn scene-form saves to one create request", async () => {
    const pending = createDeferred<unknown>();
    createMock.mockReturnValue(pending.promise);

    render(<VirtualTourManager role="general_manager" unitId="7" />);
    fireEvent.click(screen.getByRole("button", { name: "صحنه جدید" }));
    fireEvent.change(screen.getByRole("textbox", { name: /عنوان صحنه/ }), { target: { value: "صحنه تست" } });
    const save = await screen.findByRole("button", { name: "ذخیره" });

    await act(async () => {
      fireEvent.click(save);
      fireEvent.click(save);
    });

    expect(createMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });

  it("collapses two same-turn destructive delete confirmations to one request", async () => {
    const pending = createDeferred<unknown>();
    deleteMock.mockReturnValue(pending.promise);

    render(<VirtualTourManager role="general_manager" unitId="7" />);
    fireEvent.click(screen.getAllByRole("button", { name: "حذف ورودی اصلی" })[0]);
    const confirm = await screen.findByRole("button", { name: "حذف" });

    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(41);

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });

  it("collapses two same-turn reorder clicks to one two-scene swap", async () => {
    sceneResults = twoScenes;
    const pending = createDeferred<unknown>();
    updateMock.mockReturnValue(pending.promise);

    render(<VirtualTourManager role="general_manager" unitId="7" />);
    const downButtons = screen.getAllByRole("button", { name: "جابه‌جایی به پایین" });
    const enabledDown = downButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(enabledDown).toBeDefined();

    await act(async () => {
      fireEvent.click(enabledDown!);
      fireEvent.click(enabledDown!);
    });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenNthCalledWith(1, 41, { order: 1 });
    expect(updateMock).toHaveBeenNthCalledWith(2, 42, { order: 0 });

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });
});

// FE-VIRTUAL-TOUR-REORDER-PARTIAL-FAILURE-001: handleReorder's pair-swap
// used to be a bare Promise.all() -- if one PATCH succeeded and its pair
// rejected, the catch block neither reverted the half that succeeded nor
// reloaded, leaving the server with a duplicate/inconsistent order value
// while the UI kept showing the pre-swap order as if nothing had
// happened. It now uses Promise.allSettled(), explicitly reverts
// (best-effort) whichever half succeeded when its pair fails, and always
// reloads afterward.
describe("VirtualTourManager reorder partial failure", () => {
  it("reverts the succeeded half of a swap and reloads when the other half fails", async () => {
    sceneResults = twoScenes;
    const serverOrders = new Map<number, number>([[41, 0], [42, 1]]);
    updateMock.mockImplementation((id: number, payload: { order: number }) => {
      if (id === 41) {
        serverOrders.set(id, payload.order);
        return Promise.resolve({});
      }
      return Promise.reject(new Error("simulated second PATCH failure"));
    });
    reloadMock.mockResolvedValue(undefined);

    render(<VirtualTourManager role="general_manager" unitId="7" />);
    const downButtons = screen.getAllByRole("button", { name: "جابه‌جایی به پایین" });
    const enabledDown = downButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(enabledDown).toBeDefined();

    await act(async () => {
      fireEvent.click(enabledDown!);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Both original PATCHes (41 succeeds, 42 fails) plus a compensating
    // revert PATCH for 41 back to its original order.
    expect(updateMock).toHaveBeenCalledTimes(3);
    expect(updateMock).toHaveBeenNthCalledWith(3, 41, { order: 0 });
    expect(serverOrders.get(41)).toBe(0);
    expect(serverOrders.get(42)).toBe(1);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("بک‌اند");
  });
});

// FE-VTOUR-MANAGER-LIST-RETRY-001: a failed scene-list fetch rendered a
// bare error paragraph with no way to recover short of a full page reload
// -- usePanelRequest's own `reload` (already used elsewhere in this
// component for post-mutation refreshes) was never wired to this specific
// error display.
describe("VirtualTourManager list load error", () => {
  it("shows a retry button alongside the list error and calls reload when clicked", () => {
    mockListError = "بارگذاری فهرست صحنه‌ها ناموفق بود.";

    render(<VirtualTourManager role="general_manager" unitId="7" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(mockListError);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("does not show the list error alert when the list loads successfully", () => {
    render(<VirtualTourManager role="general_manager" unitId="7" />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
