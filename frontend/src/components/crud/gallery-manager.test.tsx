import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { workflowMock, uploadMock, listMock, updateMock, createMock, reloadMock } = vi.hoisted(() => ({
  workflowMock: vi.fn(),
  uploadMock: vi.fn(),
  listMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  reloadMock: vi.fn(),
}));

vi.mock("@/components/crud/crud-manager", () => ({
  CrudManager: ({ rowActions }: { rowActions: (item: unknown, helpers: { reload: () => Promise<void> }) => ReactNode }) => (
    <div data-testid="crud-row-actions">
      {rowActions(
        {
          id: 71,
          title: "تصویر تست",
          summary: "خلاصه",
          image: "/media/test.jpg",
          status: "draft",
          is_featured: false,
          is_active: true,
          order: 0,
          scope: "school",
          unit_id: null,
        },
        { reload: reloadMock },
      )}
    </div>
  ),
  FormActions: () => null,
}));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({ data: listMock(), loading: false, error: null, reload: reloadMock }),
}));

vi.mock("@/lib/data/repositories", () => ({
  galleryRepository: { list: listMock, update: updateMock, create: createMock },
  unitsRepository: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/services/gallery-cms-service", () => ({
  runGalleryWorkflowAction: workflowMock,
}));

vi.mock("@/services/panel-service", () => ({
  panelService: { uploadMedia: uploadMock },
}));

vi.mock("@/components/cms/media-picker-dialog", () => ({
  MediaPickerDialog: () => null,
}));

vi.mock("@/components/gallery/gallery-lightbox", () => ({
  GalleryLightbox: () => null,
}));

import { GalleryManager } from "@/components/crud/gallery-manager";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
});

// FE-GALLERY-WORKFLOW-DOUBLE-SUBMIT-001 / FE-GALLERY-BATCH-UPLOAD-DOUBLE-
// SUBMIT-001 / FE-TOUR-MANAGER-REORDER-DOUBLE-SUBMIT-001 (same defect
// pattern, proactively fixed here too for GalleryReorderPanel): same
// guard/rationale as login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("GalleryManager duplicate-mutation guards", () => {
  it("collapses two same-turn workflow-action clicks on one row to one request", async () => {
    const pending = createDeferred<unknown>();
    workflowMock.mockReturnValue(pending.promise);

    render(<GalleryManager unitId={null} canPublish canReview />);
    const submit = screen.getByRole("button", { name: "ارسال برای بررسی" });

    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });

    expect(workflowMock).toHaveBeenCalledTimes(1);
    expect(workflowMock).toHaveBeenCalledWith("71", "submit-review");

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });

  it("collapses two same-turn batch-upload file changes to one upload", async () => {
    const pending = createDeferred<{ title: string; url: string }>();
    uploadMock.mockReturnValue(pending.promise);

    const view = render(<GalleryManager unitId="7" />);
    const input = view.container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
      fireEvent.change(input!, { target: { files: [file] } });
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ title: "photo.jpg", url: "/media/photo.jpg" });
      await pending.promise;
    });
  });

  it("collapses two same-turn reorder clicks in the reorder panel to one two-item swap", async () => {
    listMock.mockReturnValue([
      { id: 1, title: "اول", image: "/media/1.jpg", status: "draft", order: 0, scope: "school", unit_id: null },
      { id: 2, title: "دوم", image: "/media/2.jpg", status: "draft", order: 1, scope: "school", unit_id: null },
    ]);
    const pending = createDeferred<unknown>();
    updateMock.mockReturnValue(pending.promise);

    render(<GalleryManager unitId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /ترتیب نمایش/ }));
    const downButtons = screen.getAllByRole("button", { name: "جابه‌جایی به پایین" });
    const enabledDown = downButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(enabledDown).toBeDefined();

    await act(async () => {
      fireEvent.click(enabledDown!);
      fireEvent.click(enabledDown!);
    });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenNthCalledWith(1, "1", { order: 1 });
    expect(updateMock).toHaveBeenNthCalledWith(2, "2", { order: 0 });

    await act(async () => {
      pending.resolve({});
      await pending.promise;
    });
  });
});
