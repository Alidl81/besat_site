import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Column = { key: string; header: string; render: (item: unknown) => ReactNode };

const { listMock, reloadMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  reloadMock: vi.fn(),
}));

const item = {
  id: 71,
  title: "تصویر تست",
  summary: "خلاصه",
  image: "http://localhost:3000/media/gallery/photo.jpg",
  status: "draft",
  is_featured: false,
  is_active: true,
  order: 0,
  scope: "school",
  unit_id: null,
};

vi.mock("@/components/crud/crud-manager", () => ({
  CrudManager: ({ columns, rowActions }: {
    columns: Column[];
    rowActions: (item: unknown, helpers: { reload: () => Promise<void> }) => ReactNode;
  }) => (
    <div>
      {columns.map((column) => (
        <div key={column.key}>{column.render(item)}</div>
      ))}
      {rowActions(item, { reload: reloadMock })}
    </div>
  ),
  FormActions: () => null,
}));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: () => ({ data: listMock(), loading: false, error: null, reload: reloadMock }),
}));

vi.mock("@/lib/data/repositories", () => ({
  galleryRepository: { list: listMock, update: vi.fn(), create: vi.fn() },
  unitsRepository: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/services/gallery-cms-service", () => ({ runGalleryWorkflowAction: vi.fn() }));
vi.mock("@/services/panel-service", () => ({ panelService: { uploadMedia: vi.fn() } }));
vi.mock("@/components/cms/media-picker-dialog", () => ({ MediaPickerDialog: () => null }));

const { lightboxItemsCaptured } = vi.hoisted(() => ({ lightboxItemsCaptured: { current: null as unknown } }));
vi.mock("@/components/gallery/gallery-lightbox", () => ({
  GalleryLightbox: (props: { items: unknown }) => {
    lightboxItemsCaptured.current = props.items;
    return null;
  },
}));

import { GalleryManager } from "@/components/crud/gallery-manager";

const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
  // FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): safe-url.ts's effectiveSiteUrl()
  // now prefers window.location.origin over NEXT_PUBLIC_SITE_URL whenever a
  // window exists (see safe-url.test.ts) -- jsdom always provides one, so
  // this test's simulated "viewing from besat.example.com" needs it stubbed
  // to match, or jsdom's own default origin would silently win instead.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, origin: "https://besat.example.com" },
  });
  listMock.mockReturnValue([]);
  lightboxItemsCaptured.current = null;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

// FE-PUBLIC-MEDIA-ORIGIN-001 (dashboard sink): GalleryManager's row
// thumbnail (MediaThumb) and its preview lightbox both rendered the
// backend's raw, possibly wrong-host media URL directly -- CSP's img-src
// allowlist (this app's own origin only) blocked every one. Both now go
// through safePublicMediaUrl(), matching every public-facing media sink.
describe("GalleryManager media-origin normalization", () => {
  it("normalizes the row thumbnail's src instead of rendering the backend's raw wrong-host URL", () => {
    render(<GalleryManager unitId={null} canPublish canReview />);
    const image = screen.getByAltText(item.title) as HTMLImageElement;
    expect(image.src).toBe("https://besat.example.com/media/gallery/photo.jpg");
  });

  it("normalizes the preview lightbox's src the same way", () => {
    render(<GalleryManager unitId={null} canPublish canReview />);
    fireEvent.click(screen.getByRole("button", { name: `پیش‌نمایش ${item.title}` }));

    const items = lightboxItemsCaptured.current as Array<{ src: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].src).toBe("https://besat.example.com/media/gallery/photo.jpg");
  });
});
