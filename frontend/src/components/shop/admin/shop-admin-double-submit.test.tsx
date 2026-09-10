import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopCategoriesManager } from "@/components/shop/admin/shop-categories-manager";
import { ShopEnrollmentsManager } from "@/components/shop/admin/shop-enrollments-manager";
import { ShopOrdersManager } from "@/components/shop/admin/shop-orders-manager";
import { ShopProductsManager } from "@/components/shop/admin/shop-products-manager";
import { ShopSettingsManager } from "@/components/shop/admin/shop-settings-manager";
import { ShopShippingManager } from "@/components/shop/admin/shop-shipping-manager";

const { service, requestImpl } = vi.hoisted(() => ({
  service: {
    cmsCreateCategory: vi.fn(),
    cmsDeleteCategory: vi.fn(),
    cmsGetCategories: vi.fn(),
    cmsUpdateCategory: vi.fn(),
    cmsCreateShippingMethod: vi.fn(),
    cmsDeleteShippingMethod: vi.fn(),
    cmsGetShippingMethods: vi.fn(),
    cmsUpdateShippingMethod: vi.fn(),
    cmsGetSettings: vi.fn(),
    cmsUpdateSettings: vi.fn(),
    cmsGetProducts: vi.fn(),
    cmsCreateProduct: vi.fn(),
    cmsRunProductWorkflowAction: vi.fn(),
    cmsDeleteProduct: vi.fn(),
    cmsGetOrders: vi.fn(),
    cmsGetOrder: vi.fn(),
    cmsGetOrderEvents: vi.fn(),
    cmsRunOrderAction: vi.fn(),
    cmsGetCourseEnrollments: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/shop-cms-service", () => service);
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

vi.mock("@/components/crud/crud-ui", async () => {
  const React = await import("react");
  const { forwardRef } = React;
  const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props} />);
  Input.displayName = "Input";
  const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />;
  const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => <select ref={ref} {...props} />);
  Select.displayName = "Select";
  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />;
  return {
    CrudSection: ({ action, children }: { action?: React.ReactNode; children: React.ReactNode }) => <section>{action}{children}</section>,
    EmptyState: ({ text }: { text: string }) => <p>{text}</p>,
    Field: ({ label, children }: { label: string; children: React.ReactNode }) => <label>{label}{children}</label>,
    GhostButton: Button,
    PrimaryButton: Button,
    TextInput: Input,
    TextArea,
    Select,
    StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
    Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
    ConfirmDialog: ({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void }) => open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>تأیید</button>
        <button type="button" onClick={onCancel}>انصراف</button>
      </div>
    ) : null,
  };
});

vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/cms/media-picker-dialog", () => ({ MediaPickerDialog: () => null }));
vi.mock("@/components/cms/seo-panel", () => ({
  emptySeoDraft: {},
  seoDraftFrom: () => ({}),
  seoDraftToPayload: () => ({}),
  SeoPanel: () => null,
}));
vi.mock("@/components/editor/rich-editor", () => ({ RichEditor: () => null }));
vi.mock("@/services/panel-service", () => ({ panelService: { uploadMedia: vi.fn() } }));

const pending = () => new Promise<never>(() => undefined);

const settings = {
  reservation_hold_minutes: 15,
  low_stock_default_threshold: 3,
};

const category = { id: 7, title: "دوره‌ها", slug: "courses", description: null, order: 1, is_active: true };
const shippingMethod = { id: 8, title: "پست", price_amount: 50000, is_default: true };
const product = {
  id: 9,
  title: "دوره نمونه",
  product_type: "online_course",
  status: "draft",
  price_amount: 100000,
  sale_price_amount: null,
};
const order = {
  id: 10,
  order_number: "B-10",
  user_display: "والد نمونه",
  total_amount: 100000,
  status: "paid",
};
const orderDetail = {
  ...order,
  items: [{ id: 1, title_snapshot: "دوره نمونه", quantity: 1, line_total_amount: 100000 }],
  requires_shipping: false,
  shipping_address_line1: null,
};

beforeEach(() => {
  requestImpl.mockImplementation(() => ({ loading: false, error: null, data: null, reload: vi.fn() }));
  service.cmsCreateCategory.mockReturnValue(pending());
  service.cmsDeleteCategory.mockReturnValue(pending());
  service.cmsCreateShippingMethod.mockReturnValue(pending());
  service.cmsDeleteShippingMethod.mockReturnValue(pending());
  service.cmsUpdateSettings.mockReturnValue(pending());
  service.cmsRunProductWorkflowAction.mockReturnValue(pending());
  service.cmsDeleteProduct.mockReturnValue(pending());
  service.cmsCreateProduct.mockReturnValue(pending());
  service.cmsRunOrderAction.mockReturnValue(pending());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-ADMIN-SETTINGS-DOUBLE-SUBMIT-001, FE-SHOP-CATEGORY-CREATE-DOUBLE-SUBMIT-001,
// FE-SHOP-CATEGORY-DELETE-DOUBLE-SUBMIT-001, FE-SHOP-SHIPPING-CREATE-DOUBLE-SUBMIT-001,
// FE-SHOP-SHIPPING-DELETE-DOUBLE-SUBMIT-001, FE-SHOP-PRODUCT-WORKFLOW-DOUBLE-SUBMIT-001,
// FE-SHOP-PRODUCT-DELETE-DOUBLE-SUBMIT-001, FE-SHOP-PRODUCT-CMS-CREATE-DOUBLE-SUBMIT-001,
// FE-SHOP-ORDER-ACTION-DOUBLE-SUBMIT-001: every handler below was guarded
// only with state-backed booleans (or, for products, a shared `busyId`), so
// two same-tick clicks/submits both reached the mutation before either
// state update committed. Each now uses a synchronous ref guard.
describe("shop admin mutation duplicate boundary", () => {
  it("collapses two same-tick settings updates to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: settings, reload: vi.fn() });
    render(<ShopSettingsManager />);
    const form = screen.getByRole("button", { name: "ذخیره تنظیمات" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(service.cmsUpdateSettings).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick category creates to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [] }, reload: vi.fn() });
    render(<ShopCategoriesManager />);
    fireEvent.click(screen.getByRole("button", { name: "دسته‌بندی جدید" }));
    const dialog = screen.getByRole("dialog", { name: "دسته‌بندی جدید" });
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "دسته جدید" } });
    const form = within(dialog).getByRole("button", { name: "ذخیره" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(service.cmsCreateCategory).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick shipping creates to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [] }, reload: vi.fn() });
    render(<ShopShippingManager />);
    fireEvent.click(screen.getByRole("button", { name: "روش جدید" }));
    const dialog = screen.getByRole("dialog", { name: "روش ارسال جدید" });
    const textboxes = within(dialog).getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "پست پیشتاز" } });
    fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "50000" } });
    const form = within(dialog).getByRole("button", { name: "ذخیره" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(service.cmsCreateShippingMethod).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick category deletes to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [category] }, reload: vi.fn() });
    render(<ShopCategoriesManager />);
    fireEvent.click(screen.getByRole("button", { name: "حذف دوره‌ها" }));
    const dialog = screen.getByRole("dialog", { name: "حذف دسته‌بندی" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      await Promise.resolve();
    });

    expect(service.cmsDeleteCategory).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick shipping deletes to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [shippingMethod] }, reload: vi.fn() });
    render(<ShopShippingManager />);
    fireEvent.click(screen.getByRole("button", { name: "حذف پست" }));
    const dialog = screen.getByRole("dialog", { name: "حذف روش ارسال" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      await Promise.resolve();
    });

    expect(service.cmsDeleteShippingMethod).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick product workflow actions to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [product] }, reload: vi.fn() });
    render(<ShopProductsManager mode="admin" />);
    const action = screen.getByRole("button", { name: "ارسال برای بررسی" });

    await act(async () => {
      fireEvent.click(action);
      fireEvent.click(action);
      await Promise.resolve();
    });

    expect(service.cmsRunProductWorkflowAction).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick product deletes to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [product] }, reload: vi.fn() });
    render(<ShopProductsManager mode="admin" />);
    fireEvent.click(screen.getByRole("button", { name: "حذف دوره نمونه" }));
    const dialog = screen.getByRole("dialog", { name: "حذف محصول" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "تأیید" }));
      await Promise.resolve();
    });

    expect(service.cmsDeleteProduct).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick product creates to one request", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [] }, reload: vi.fn() });
    service.cmsCreateProduct.mockReturnValue(pending());
    render(<ShopProductsManager mode="media" />);
    fireEvent.click(screen.getByRole("button", { name: "محصول جدید" }));
    const dialog = screen.getByRole("dialog", { name: "محصول جدید" });
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "محصول جدید" } });
    const form = within(dialog).getByRole("button", { name: "ذخیره" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(service.cmsCreateProduct).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick order actions to one request", async () => {
    requestImpl.mockImplementation((loader: () => unknown) => {
      const source = String(loader);
      if (source.includes("cmsGetOrderEvents")) return { loading: false, error: null, data: [], reload: vi.fn() };
      if (source.includes("cmsGetOrder)")) return { loading: false, error: null, data: orderDetail, reload: vi.fn() };
      return { loading: false, error: null, data: { results: [order] }, reload: vi.fn() };
    });
    render(<ShopOrdersManager />);
    fireEvent.click(screen.getByRole("button", { name: "مشاهده جزئیات" }));
    const dialog = screen.getByRole("dialog", { name: "جزئیات سفارش" });
    const action = within(dialog).getByRole("button", { name: "شروع پردازش" });

    await act(async () => {
      fireEvent.click(action);
      fireEvent.click(action);
      await Promise.resolve();
    });

    expect(service.cmsRunOrderAction).toHaveBeenCalledTimes(1);
  });
});

// FE-DASH-RTL-SHOP-ORDER-ACTION-001: on a narrow RTL viewport this table's
// sole row action ("مشاهده جزئیات") sat entirely outside the visible
// panel-table-scroll wrapper at initial scroll position -- the edge-cue
// fade signals scrollability but doesn't make the action reachable at a
// glance. Same sticky-column fix as shop-products-manager.tsx.
describe("shop admin orders action column stickiness", () => {
  it("marks the actions header and each row's actions cell as sticky", () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [order] }, reload: vi.fn() });
    render(<ShopOrdersManager />);

    const actionButton = screen.getByRole("button", { name: "مشاهده جزئیات" });
    const actionsCell = actionButton.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    const actionsHeader = headerRow.lastElementChild;
    expect(actionsHeader).toHaveClass("panel-table-action-sticky");
  });
});

// FE-DASH-RTL-SHOP-CATEGORY-ACTION-001: the actions <td> in both
// shop-categories-manager.tsx and shop-shipping-manager.tsx had `flex`
// applied directly to it, computing display:flex instead of the
// table-cell layout every other cell in the row relies on -- the flex
// layout now lives on an inner div instead. This table structure is the
// meaningful assertion here; jsdom doesn't apply this app's compiled
// Tailwind CSS, so the actual display:table-cell-vs-flex computed-style
// regression was instead verified directly in real Chromium (see
// FIXES.md). Both actions cells also get the same sticky-column fix as
// the Products/Orders tables.
describe("shop admin category/shipping action cell structure", () => {
  it("wraps categories' row-action buttons in a div instead of applying flex to the td, and marks it sticky", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [category] }, reload: vi.fn() });
    render(<ShopCategoriesManager />);

    const editButton = await screen.findByRole("button", { name: "ویرایش دوره‌ها" });
    const actionsCell = editButton.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");
    expect(actionsCell?.className).not.toMatch(/\bflex\b/);
    expect(editButton.parentElement?.tagName).toBe("DIV");
    expect(editButton.parentElement).toHaveClass("flex");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    expect(headerRow.lastElementChild).toHaveClass("panel-table-action-sticky");
  });

  it("wraps shipping's row-action buttons in a div instead of applying flex to the td, and marks it sticky", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: { results: [shippingMethod] }, reload: vi.fn() });
    render(<ShopShippingManager />);

    const editButton = await screen.findByRole("button", { name: "ویرایش پست" });
    const actionsCell = editButton.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");
    expect(actionsCell?.className).not.toMatch(/\bflex\b/);
    expect(editButton.parentElement?.tagName).toBe("DIV");
    expect(editButton.parentElement).toHaveClass("flex");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    expect(headerRow.lastElementChild).toHaveClass("panel-table-action-sticky");
  });
});

// FE-DASH-SHOP-ORDER-DESTRUCTIVE-CONFIRM-001: "لغو سفارش"/"بازگشت کامل وجه"
// used to go straight from the action button to window.prompt("دلیل
// (اختیاری):"), then run the action REGARDLESS of how that prompt was
// dismissed -- prompt() returning null (Cancel/Escape/backdrop) was only
// ever used to null out the optional reason text, never checked as "abort
// the action". A real ConfirmDialog makes Cancel genuinely abort.
describe("shop admin destructive order action confirmation", () => {
  function renderOrderDetail() {
    requestImpl.mockImplementation((loader: () => unknown) => {
      const source = String(loader);
      if (source.includes("cmsGetOrderEvents")) return { loading: false, error: null, data: [], reload: vi.fn() };
      if (source.includes("cmsGetOrder)")) return { loading: false, error: null, data: orderDetail, reload: vi.fn() };
      return { loading: false, error: null, data: { results: [order] }, reload: vi.fn() };
    });
    render(<ShopOrdersManager />);
    fireEvent.click(screen.getByRole("button", { name: "مشاهده جزئیات" }));
    return screen.getByRole("dialog", { name: "جزئیات سفارش" });
  }

  it("does not run the refund when the confirmation dialog is dismissed", async () => {
    const detailDialog = renderOrderDetail();
    fireEvent.click(within(detailDialog).getByRole("button", { name: "بازگشت کامل وجه" }));

    const confirmDialog = screen.getByRole("dialog", { name: "بازگشت کامل وجه" });
    await act(async () => {
      fireEvent.click(within(confirmDialog).getByRole("button", { name: "انصراف" }));
      await Promise.resolve();
    });

    expect(service.cmsRunOrderAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "بازگشت کامل وجه" })).not.toBeInTheDocument();
  });

  it("runs the refund only after the confirmation dialog's explicit Confirm", async () => {
    const detailDialog = renderOrderDetail();
    fireEvent.click(within(detailDialog).getByRole("button", { name: "بازگشت کامل وجه" }));

    const confirmDialog = screen.getByRole("dialog", { name: "بازگشت کامل وجه" });
    await act(async () => {
      fireEvent.click(within(confirmDialog).getByRole("button", { name: "تأیید" }));
      await Promise.resolve();
    });

    expect(service.cmsRunOrderAction).toHaveBeenCalledTimes(1);
    expect(service.cmsRunOrderAction).toHaveBeenCalledWith(order.id, "refund", undefined);
  });
});

// FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: every one of these collection panels
// rendered a plain, non-interactive error message on a failed initial load
// with no retry action, even though usePanelRequest always returns `reload`
// -- a dead end during any transient backend failure. Fixed with the shared
// PanelError component (message + "تلاش دوباره" button wired to `reload`).
describe("shop admin collection error retry", () => {
  it("categories: offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopCategoriesManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shipping: offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopShippingManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("products: offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopProductsManager mode="admin" />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("orders (list): offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopOrdersManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("enrollments: offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopEnrollmentsManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("settings: offers a retry action that calls reload", () => {
    const reload = vi.fn();
    requestImpl.mockReturnValue({ loading: false, error: "خطای آزمایشی", data: null, reload });
    render(<ShopSettingsManager />);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

// FE-PANEL-ADMIN-COURSE-ENROLLMENTS-PAGINATION-001: the backend's
// StandardResultsSetPagination returns ten items per page (count/next/
// previous), but this never sent a page param and never rendered any
// next/previous control -- any enrollment list exceeding one page made
// every older enrollment permanently unreachable. Same defect and fix
// shape as FE-PANEL-MESSAGES-PAGINATION-001 (messaging-panel.tsx).
describe("shop admin course enrollments pagination", () => {
  it("renders a next/previous control when a next page exists, and requests page 2 on click", () => {
    const enrollment = {
      id: 1,
      user_display: "دانش‌آموز نمونه",
      product_title: "دوره نمونه",
      status: "active",
      is_confirmed: true,
      granted_at: "2026-01-01T00:00:00Z",
    };
    const paginatedEnrollments = { results: [enrollment], count: 12, next: "…?page=2", previous: null };
    let lastDeps: unknown[] = [];

    requestImpl.mockImplementation((loader: () => unknown, deps: unknown[]) => {
      lastDeps = deps;
      return { loading: false, error: null, data: paginatedEnrollments, reload: vi.fn() };
    });

    render(<ShopEnrollmentsManager />);

    expect(lastDeps).toEqual([1]);
    const nav = screen.getByRole("navigation", { name: "صفحه‌بندی ثبت‌نام‌ها" });
    expect(within(nav).getByRole("button", { name: "صفحه قبل" })).toBeDisabled();
    const nextButton = within(nav).getByRole("button", { name: "صفحه بعد" });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    expect(lastDeps).toEqual([2]);
  });

  it("renders no pagination nav when there is only one page", () => {
    requestImpl.mockReturnValue({
      loading: false,
      error: null,
      data: { results: [], count: 0, next: null, previous: null },
      reload: vi.fn(),
    });

    render(<ShopEnrollmentsManager />);

    expect(screen.queryByRole("navigation", { name: "صفحه‌بندی ثبت‌نام‌ها" })).not.toBeInTheDocument();
  });
});

// FE-PANEL-SHOP-SETTINGS-NUMERIC-VALIDATION-001: both settings fields are
// backend PositiveIntegerFields (min 0) but had no client-side bound -- an
// out-of-range value (e.g. -1) round-tripped to a rejected PATCH with the
// input left showing the invalid value and focus dropped to <body>.
describe("shop admin settings numeric validation", () => {
  it("rejects a negative reservation-hold value before submitting, with a localized field error", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: settings, reload: vi.fn() });
    render(<ShopSettingsManager />);

    const reservationInput = screen.getByLabelText("مدت زمان رزرو موجودی هنگام تسویه حساب (دقیقه)");
    fireEvent.change(reservationInput, { target: { value: "-1" } });
    const form = screen.getByRole("button", { name: "ذخیره تنظیمات" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(service.cmsUpdateSettings).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("مدت زمان رزرو باید عددی صحیح و صفر یا بزرگ‌تر باشد.");
    expect(reservationInput).toHaveAttribute("aria-invalid", "true");
    expect(reservationInput).toHaveAttribute("aria-describedby", alert.id);
    expect(reservationInput).toHaveFocus();
  });

  it("clears the reservation-hold error once the field is edited to a valid value", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: settings, reload: vi.fn() });
    render(<ShopSettingsManager />);

    const reservationInput = screen.getByLabelText("مدت زمان رزرو موجودی هنگام تسویه حساب (دقیقه)");
    fireEvent.change(reservationInput, { target: { value: "-1" } });
    const form = screen.getByRole("button", { name: "ذخیره تنظیمات" }).closest("form");
    await act(async () => {
      fireEvent.submit(form!);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(reservationInput, { target: { value: "20" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(reservationInput).toHaveAttribute("aria-invalid", "false");
  });

  it("rejects a negative low-stock threshold before submitting, with a localized field error", async () => {
    requestImpl.mockReturnValue({ loading: false, error: null, data: settings, reload: vi.fn() });
    render(<ShopSettingsManager />);

    const lowStockInput = screen.getByLabelText("آستانه پیش‌فرض موجودی کم");
    fireEvent.change(lowStockInput, { target: { value: "-2" } });
    const form = screen.getByRole("button", { name: "ذخیره تنظیمات" }).closest("form");
    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(service.cmsUpdateSettings).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("آستانه موجودی کم باید عددی صحیح و صفر یا بزرگ‌تر باشد.");
    expect(lowStockInput).toHaveAttribute("aria-invalid", "true");
    expect(lowStockInput).toHaveFocus();
  });
});
