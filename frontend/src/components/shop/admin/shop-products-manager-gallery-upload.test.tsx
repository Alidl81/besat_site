import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestImpl, uploadMock } = vi.hoisted(() => ({
  requestImpl: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

vi.mock("@/services/shop-cms-service", () => ({
  cmsGetProducts: vi.fn(),
  cmsGetProduct: vi.fn(),
  cmsGetCategories: vi.fn(),
  cmsCreateProduct: vi.fn(),
  cmsUpdateProduct: vi.fn(),
  cmsDeleteProduct: vi.fn(),
  cmsRunProductWorkflowAction: vi.fn(),
  cmsUploadProductGalleryImage: uploadMock,
}));

vi.mock("@/services/panel-service", () => ({ panelService: { uploadMedia: vi.fn() } }));
vi.mock("@/components/cms/media-picker-dialog", () => ({ MediaPickerDialog: () => null }));
vi.mock("@/components/cms/seo-panel", () => ({
  emptySeoDraft: {},
  seoDraftFrom: () => ({}),
  seoDraftToPayload: () => ({}),
  SeoPanel: () => null,
}));
vi.mock("@/components/editor/rich-editor", () => ({ RichEditor: () => null }));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));

vi.mock("@/components/crud/crud-ui", async () => {
  const { forwardRef } = await import("react");
  const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  ));
  Input.displayName = "Input";
  const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => (
    <select ref={ref} {...props} />
  ));
  Select.displayName = "Select";
  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />;
  return {
    CrudSection: ({ action, children }: { action?: React.ReactNode; children: React.ReactNode }) => (
      <section>{action}{children}</section>
    ),
    EmptyState: ({ text }: { text: string }) => <p>{text}</p>,
    Field: ({ label, children }: { label: string; children: React.ReactNode }) => (
      <div><span>{label}</span>{children}</div>
    ),
    GhostButton: Button,
    PrimaryButton: Button,
    TextInput: Input,
    TextArea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
    Select,
    StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
    Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => (
      open ? <div role="dialog" aria-label={title}>{children}</div> : null
    ),
    ConfirmDialog: () => null,
  };
});

import { ShopProductsManager } from "@/components/shop/admin/shop-products-manager";

const product = {
  id: 9,
  title: "دوره نمونه",
  product_type: "online_course" as const,
  status: "draft" as const,
  price_amount: 100000,
  sale_price_amount: null,
};

const detail = {
  ...product,
  slug: "sample-course",
  category: null,
  short_description: null,
  description: null,
  featured_image: null,
  is_featured: false,
  physical_detail: null,
  course_detail: null,
  gallery_images: [],
  seo: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requestImpl.mockImplementation((loader: () => unknown) => {
    const source = String(loader);
    if (source.includes("cmsGetProduct(productId)")) {
      return { loading: false, error: null, data: detail, reload: vi.fn() };
    }
    if (source.includes("cmsGetCategories")) {
      return { loading: false, error: null, data: { results: [] }, reload: vi.fn() };
    }
    return { loading: false, error: null, data: { results: [product] }, reload: vi.fn() };
  });
  uploadMock.mockImplementation(() => new Promise(() => undefined));
});

afterEach(() => cleanup());

// FE-SHOP-ADMIN-PRODUCT-GALLERY-UPLOAD-DOUBLE-SUBMIT-001: the gallery
// file-input handler guarded uploads only with state-backed
// `uploadingGalleryImage`, so two same-tick file-input changes both
// started an upload before either update committed.
describe("ShopProductsManager gallery upload duplicate boundary", () => {
  it("collapses two same-turn file changes to one gallery upload", async () => {
    render(<ShopProductsManager mode="admin" />);
    fireEvent.click(screen.getByRole("button", { name: "ویرایش دوره نمونه" }));
    const dialog = await screen.findByRole("dialog", { name: "ویرایش محصول" });
    const input = dialog.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["image"], "cover.jpg", { type: "image/jpeg" });

    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
      fireEvent.change(input!, { target: { files: [file] } });
      await Promise.resolve();
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
  });
});

// FE-DASH-RTL-SHOP-PRODUCT-ACTION-001: on a narrow RTL viewport the Admin
// Products table is wide enough that its actions column sits far outside
// the visible panel-table-scroll wrapper -- the edge-cue fade signals that
// the table is scrollable, but the controls themselves are only reachable
// after already knowing to scroll ~250-300px, which reads as a read-only
// list on first glance. Pinning the actions column with `position: sticky`
// makes it visible immediately, with no scroll gesture required.
describe("ShopProductsManager action column stickiness", () => {
  it("marks the actions header and each row's actions cell as sticky", async () => {
    render(<ShopProductsManager mode="admin" />);

    const editButton = await screen.findByRole("button", { name: "ویرایش دوره نمونه" });
    const actionsCell = editButton.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    const actionsHeader = headerRow.lastElementChild;
    expect(actionsHeader).toHaveClass("panel-table-action-sticky");
  });
});
