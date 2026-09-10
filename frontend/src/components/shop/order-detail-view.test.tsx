import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDetail } from "@/types/shop";

const getMyOrder = vi.fn();
const startPayment = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("lucide-react", () => ({
  CheckCircle2: () => React.createElement("span"),
  Clock: () => React.createElement("span"),
  Loader2: () => React.createElement("span"),
  PackageX: () => React.createElement("span"),
  TriangleAlert: () => React.createElement("span"),
}));
vi.mock("@/lib/api/client", () => ({ getApiErrorMessage: (reason: unknown) => String(reason) }));
vi.mock("@/lib/shop/money", () => ({ formatPrice: (value: number) => String(value) }));
vi.mock("@/services/shop-account-service", () => ({ getMyOrder, startPayment }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function renderFailedOrder() {
  getMyOrder.mockResolvedValue({
    order_number: "BST-QA-1",
    status: "payment_failed",
    items: [],
    subtotal_amount: 0,
    shipping_amount: 0,
    total_amount: 0,
    requires_shipping: false,
    shipping_address_line1: null,
    shipping_recipient_name: null,
    shipping_province: null,
    shipping_city: null,
  });

  const { OrderDetailView } = await import("@/components/shop/order-detail-view");
  render(<OrderDetailView orderNumber="BST-QA-1" />);
  return screen.findByRole("button", { name: "تلاش دوباره برای پرداخت" });
}

async function renderPendingPaymentOrder() {
  getMyOrder.mockResolvedValue({
    order_number: "BST-QA-2",
    status: "pending_payment",
    items: [],
    subtotal_amount: 0,
    shipping_amount: 0,
    total_amount: 0,
    requires_shipping: false,
    shipping_address_line1: null,
    shipping_recipient_name: null,
    shipping_province: null,
    shipping_city: null,
  });

  const { OrderDetailView } = await import("@/components/shop/order-detail-view");
  render(<OrderDetailView orderNumber="BST-QA-2" />);
  return screen.findByRole("button", { name: "تلاش دوباره برای پرداخت" });
}

// FE-SHOP-ORDER-PENDING-PAYMENT-RETRY-001: PaymentStartAPIView/
// start_payment() already accept PENDING_PAYMENT (the normal state right
// after placing an order, before any attempt exists) as well as
// PAYMENT_FAILED, but this component only ever rendered the retry button
// for "payment_failed" -- an order whose payment-start attempt failed
// before ever reaching the provider is left at pending_payment forever
// with no visible way to retry.
describe("OrderDetailView pending-payment retry affordance", () => {
  it("shows a retry button for a pending_payment order, not just a payment_failed one", async () => {
    const retry = await renderPendingPaymentOrder();

    expect(retry).toBeInTheDocument();
    expect(screen.getByText("پرداخت این سفارش هنوز انجام نشده است.")).toBeInTheDocument();
  });

  it("starts payment from the pending-payment retry button", async () => {
    startPayment.mockResolvedValue({ redirect_url: "https://gateway.example/pay" });
    const retry = await renderPendingPaymentOrder();

    fireEvent.click(retry);

    await act(async () => {
      await Promise.resolve();
    });
    expect(startPayment).toHaveBeenCalledWith("BST-QA-2");
  });
});

// FE-SHOP-PAYMENT-RETRY-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("OrderDetailView payment-retry duplicate submission guard", () => {
  it("only calls startPayment once when two retry clicks arrive before the first resolves", async () => {
    const deferred = createDeferred<never>();
    startPayment.mockReturnValue(deferred.promise);
    const retry = await renderFailedOrder();

    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });

    expect(startPayment).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(undefined as never);
      await deferred.promise;
    });
  });

  it("allows a genuine retry after a failed payment attempt resolves", async () => {
    startPayment.mockRejectedValueOnce(new Error("پرداخت آغاز نشد"));
    const retry = await renderFailedOrder();

    await act(async () => {
      fireEvent.click(retry);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(startPayment).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<never>();
    startPayment.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.click(retry);
    });
    expect(startPayment).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve(undefined as never);
      await deferred.promise;
    });
  });
});

// FE-SHOP-ORDER-PAYMENT-RETRY-ERROR-001: handleRetryPayment() correctly set
// `error` on a failed retry, but the component's only error-rendering
// branch was `error && !order` (the initial-load-failure page) -- once
// `order` had loaded, a failed retry silently reset the button with no
// visible or announced feedback at all.
describe("OrderDetailView payment-retry error surface", () => {
  it("shows an alert with the failure message after a failed retry, and clears it on the next retry", async () => {
    startPayment.mockRejectedValueOnce(new Error("پرداخت آغاز نشد"));
    const retry = await renderFailedOrder();

    await act(async () => {
      fireEvent.click(retry);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("پرداخت آغاز نشد");

    const deferred = createDeferred<never>();
    startPayment.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.click(retry);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      deferred.resolve(undefined as never);
      await deferred.promise;
    });
  });
});

function deferredOrder<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildOrder(orderNumber: string): OrderDetail {
  return {
    order_number: orderNumber,
    status: "pending_payment",
    status_display: "در انتظار پرداخت",
    total_amount: 100,
    total_display: null,
    requires_shipping: false,
    item_count: 1,
    can_retry_payment: false,
    created_at: "2026-01-01T00:00:00Z",
    paid_at: null,
    subtotal_amount: 100,
    shipping_amount: 0,
    discount_amount: 0,
    tax_amount: 0,
    shipping_recipient_name: null,
    shipping_phone: null,
    shipping_province: null,
    shipping_city: null,
    shipping_address_line1: null,
    shipping_address_line2: null,
    shipping_postal_code: null,
    customer_note: null,
    items: [{
      id: 1,
      product: 10,
      product_slug: "qa-product",
      product_type_snapshot: "physical",
      title_snapshot: "محصول آزمون",
      sku_snapshot: "QA-1",
      unit_price_amount_snapshot: 100,
      unit_price_display: null,
      quantity: 1,
      line_total_amount: 100,
      line_total_display: null,
    }],
    latest_payment_attempt: null,
  };
}

// FE-SHOP-ORDER-DETAIL-STALE-NAV-001: load() had no abort/sequence/
// current-order fence at all -- if the App Router reuses this same
// component instance across an A -> B order-number navigation, whichever
// request happens to resolve *last* wins, even if it's for an order the
// user has since navigated away from.
describe("OrderDetailView navigation response ordering", () => {
  it("does not let a slower prior order overwrite the current route", async () => {
    const first = deferredOrder<OrderDetail>();
    const second = deferredOrder<OrderDetail>();
    getMyOrder.mockImplementation((number: string) => number === "QA-A" ? first.promise : second.promise);

    const { OrderDetailView } = await import("@/components/shop/order-detail-view");
    const view = render(<OrderDetailView orderNumber="QA-A" />);
    await act(async () => { await Promise.resolve(); });
    expect(getMyOrder).toHaveBeenCalledWith("QA-A");

    view.rerender(<OrderDetailView orderNumber="QA-B" />);
    await act(async () => { await Promise.resolve(); });
    expect(getMyOrder).toHaveBeenCalledWith("QA-B");

    await act(async () => { second.resolve(buildOrder("QA-B")); await second.promise; });
    expect(screen.getByText("QA-B")).toBeTruthy();

    await act(async () => { first.resolve(buildOrder("QA-A")); await first.promise; });
    expect(screen.getByText("QA-B")).toBeTruthy();
    expect(screen.queryByText("QA-A")).toBeNull();
  });

  // FE-SHOP-ORDER-DETAIL-STALE-NAV-001 (REOPENED, adjacent case): the
  // sequence fence above already stops a stale response from overwriting
  // the current order, but never CLEARED the previous order's data when a
  // new order-number navigation started -- `order` kept holding order A's
  // data until a successful response for B eventually arrived. If B's
  // request failed instead, `error` was set correctly, but the error
  // panel is gated on `!order`, so A's stale content kept rendering under
  // B's route instead of the retryable error state.
  it("does not keep the previous order visible when the new route fails", async () => {
    const first = deferredOrder<OrderDetail>();
    const second = deferredOrder<OrderDetail>();
    getMyOrder.mockImplementation((number: string) => number === "QA-A" ? first.promise : second.promise);

    const { OrderDetailView } = await import("@/components/shop/order-detail-view");
    const view = render(<OrderDetailView orderNumber="QA-A" />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { first.resolve(buildOrder("QA-A")); await first.promise; });
    expect(screen.getByText("QA-A")).toBeTruthy();

    view.rerender(<OrderDetailView orderNumber="QA-B" />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      second.reject(new Error("order B unavailable"));
      await second.promise.catch(() => undefined);
    });

    expect(screen.queryByText("QA-A")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("مشکلی در نمایش این سفارش پیش آمد")).toBeTruthy();
  });
});
