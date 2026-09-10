import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createHotspot = vi.fn();
const deleteHotspot = vi.fn();
const getHotspots = vi.fn();
vi.mock("@/services/virtual-tour-cms-service", () => ({
  cmsCreateTourHotspot: createHotspot,
  cmsDeleteTourHotspot: deleteHotspot,
  cmsGetTourHotspots: getHotspots,
}));
vi.mock("pannellum", () => ({}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const scene = {
  id: 1,
  title: "صحن اصلی",
  slug: "main",
  description: null,
  door_key: "unit-1",
  panorama: "/media/main.jpg",
  thumbnail: null,
  status: "draft",
  workflow_status: "draft",
  is_default: false,
  order: 0,
  is_published: false,
  is_active: true,
  unit: { id: 1, title: "واحد آزمون", slug: "central" },
  department: null,
  created_by: null,
  updated_by: null,
  published_by: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  initial_yaw: 0,
  initial_pitch: 0,
  initial_hfov: 100,
} as const;

const target = { ...scene, id: 2, title: "سالن" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as unknown as { pannellum?: unknown }).pannellum;
});

// FE-TOUR-HOTSPOT-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("TourHotspotEditor duplicate-save boundary", () => {
  it("collapses two same-turn hotspot-create clicks to one request", async () => {
    const request = deferred<Hotspot>();
    createHotspot.mockReturnValue(request.promise);
    getHotspots.mockResolvedValue({ results: [] });
    const viewer = {
      mouseEventToCoords: vi.fn(() => [12, 24]),
      destroy: vi.fn(),
    };
    const pannellumStub = { viewer: vi.fn(() => viewer) };
    // Pannellum's UMD bundle can assign a real global during the dynamic
    // import. Keep the test double authoritative so the click coordinates do
    // not depend on a real canvas/WebGL instance.
    Object.defineProperty(window, "pannellum", {
      configurable: true,
      get: () => pannellumStub,
      set: () => undefined,
    });
    const { TourHotspotEditor } = await import("@/components/virtual-tour/tour-hotspot-editor");
    render(<TourHotspotEditor scene={scene} doorScenes={[scene, target]} onClose={vi.fn()} />);
    // The dynamic pannellum import may install its own global viewer function;
    // observe the rendered viewer host instead of asserting the implementation
    // identity of that third-party function.
    await waitFor(() => expect(pannellumStub.viewer).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /افزودن نقطه اتصال/ }));
    const viewerHost = document.querySelector("[id^='besat-hotspot-editor-']");
    expect(viewerHost).not.toBeNull();
    fireEvent.click(viewerHost!);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    const save = screen.getByRole("button", { name: /ذخیره نقطه اتصال/ });
    await act(async () => {
      fireEvent.click(save);
      fireEvent.click(save);
      await Promise.resolve();
    });
    expect(createHotspot).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({ id: 3, scene: 1, target_scene: 2, yaw: 24, pitch: 12, label: "" }));
  });

  it("collapses two same-turn hotspot-delete confirmations to one request", async () => {
    const request = deferred<void>();
    deleteHotspot.mockReturnValue(request.promise);
    getHotspots.mockResolvedValue({
      results: [{ id: 8, scene: 1, target_scene: 2, yaw: 24, pitch: 12, label: "ورودی" }],
    });
    const viewer = { mouseEventToCoords: vi.fn(() => [12, 24]), destroy: vi.fn() };
    const pannellumStub = { viewer: vi.fn(() => viewer) };
    Object.defineProperty(window, "pannellum", {
      configurable: true,
      get: () => pannellumStub,
      set: () => undefined,
    });
    const { TourHotspotEditor } = await import("@/components/virtual-tour/tour-hotspot-editor");
    render(<TourHotspotEditor scene={scene} doorScenes={[scene, target]} onClose={vi.fn()} />);
    await waitFor(() => expect(pannellumStub.viewer).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "حذف ورودی" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "حذف ورودی" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = screen.getByRole("button", { name: "حذف" });
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      await Promise.resolve();
    });
    expect(deleteHotspot).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve());
    expect(dialog).toBeTruthy();
  });
});

type Hotspot = { id: number; scene: number; target_scene: number; yaw: number; pitch: number; label: string };
