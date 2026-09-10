import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const placeOrder = vi.fn();
const startPayment = vi.fn();
const refreshCart = vi.fn();
const getCheckoutPreview = vi.fn();
const getShippingMethods = vi.fn();
const getMyAddresses = vi.fn();
const createAddress = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("lucide-react", () => ({
  Loader2: () => React.createElement("span", { "data-testid": "loader" }),
  MapPin: () => React.createElement("span", { "data-testid": "map-pin" }),
  Plus: () => React.createElement("span", { "data-testid": "plus" }),
}));
vi.mock("@/components/shared/container", () => ({
  Container: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("main", props, children),
}));
vi.mock("@/components/shop/address-form", () => ({ AddressForm: () => React.createElement("div") }));
vi.mock("@/lib/auth/auth-session", () => ({ readBesatSession: vi.fn(() => ({ access: "qa" })) }));
vi.mock("@/lib/shop/cart-context", () => ({
  useShopCart: () => ({
    cart: {
      id: 1,
      items: [
        {
          id: 11,
          product: { id: 7, title: "کتاب آزمون", slug: "book", product_type: "online_course", featured_image: null },
          variant: null,
          variant_title: null,
          quantity: 1,
          unit_price_amount: 100,
          unit_price_display: "۱۰۰",
          line_total_amount: 100,
          line_total_display: "۱۰۰",
          issue: null,
        },
      ],
      item_count: 1,
      subtotal_amount: 100,
      subtotal_display: "۱۰۰",
      requires_shipping: false,
      has_blocking_issue: false,
    },
    loading: false,
    error: null,
    announcement: "",
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    refresh: refreshCart,
    mergeAfterLogin: vi.fn(),
  }),
}));
vi.mock("@/services/shop-account-service", () => ({
  createAddress,
  getMyAddresses,
  placeOrder,
  startPayment,
}));
vi.mock("@/services/shop-service", () => ({ getCheckoutPreview, getShippingMethods }));

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

async function renderReadyCheckout() {
  getCheckoutPreview.mockResolvedValue({
    items: [{ cart_item_id: 11, product_id: 7, title: "کتاب آزمون", quantity: 1, unit_price_amount: 100, line_total_amount: 100, issue: null }],
    subtotal_amount: 100,
    shipping_amount: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 100,
    requires_shipping: false,
    can_checkout: true,
  });
  getShippingMethods.mockResolvedValue([]);
  getMyAddresses.mockResolvedValue([]);
  refreshCart.mockResolvedValue(undefined);

  const { CheckoutView } = await import("@/components/shop/checkout-view");
  render(<CheckoutView />);

  const submit = await screen.findByRole("button", { name: "پرداخت و ثبت سفارش" });
  await waitFor(() => expect(submit).toBeEnabled());
  return submit;
}

// FE-SHOP-CHECKOUT-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("CheckoutView duplicate order submission guard", () => {
  it("only calls placeOrder once when two clicks arrive before the first order request resolves", async () => {
    const deferred = createDeferred<{ order_number: string }>();
    placeOrder.mockReturnValue(deferred.promise);
    startPayment.mockRejectedValue(new Error("stop QA flow after order call"));
    const submit = await renderReadyCheckout();

    act(() => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ order_number: "QA-ORDER" });
      await deferred.promise;
      await Promise.resolve();
    });
  });

  it("allows a genuine retry after a failed order request resolves", async () => {
    placeOrder.mockRejectedValueOnce(new Error("سفارش ثبت نشد"));
    const submit = await renderReadyCheckout();

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(placeOrder).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<{ order_number: string }>();
    placeOrder.mockReturnValue(deferred.promise);
    startPayment.mockRejectedValue(new Error("stop QA flow after order call"));
    act(() => {
      fireEvent.click(submit);
    });
    expect(placeOrder).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve({ order_number: "QA-ORDER-2" });
      await deferred.promise;
      await Promise.resolve();
    });
  });
});

// FE-SHOP-CHECKOUT-POST-ORDER-REFRESH-GAP-001: placeOrder() already
// created the order and its stock reservation server-side by the time
// refreshCart() runs -- refreshing the local cart display is a courtesy,
// not a precondition for payment. A refresh failure used to abort the
// whole flow, stranding an already-placed order with no path to payment
// and only a generic error message. refreshCart() is now best-effort and
// must never block startPayment.
describe("CheckoutView order/payment sequencing", () => {
  it("does not abandon a successful order when the post-order cart refresh fails", async () => {
    placeOrder.mockResolvedValue({ order_number: "QA-ORDER-CREATED" });
    startPayment.mockResolvedValue({ redirect_url: "/shop/payment/mock/1" });
    const submit = await renderReadyCheckout();
    // renderReadyCheckout() sets refreshCart to resolve for the initial
    // render -- override it to reject only now, right before submitting.
    refreshCart.mockRejectedValue(new Error("cart refresh unavailable"));

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(refreshCart).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledWith("QA-ORDER-CREATED");
  });
});

// FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001: placeOrder() is a durable
// server-side mutation -- the order and its stock reservation already
// exist once it resolves. If startPayment() then fails, retrying used to
// call placeOrder() again, risking a second order/reservation for the
// same cart. pendingOrderRef now remembers the created order so a retry
// goes straight to a fresh startPayment() attempt for that same order
// instead of placing another one.
//
// This finding was REOPENED after its first fix: the original acceptance
// criteria (order number never exposed in the UI) was superseded by an
// adjacent Codex probe requiring the opposite -- an order-specific
// recovery link, since silently retrying internally isn't enough if the
// user navigates away before retrying. The order number and a link to its
// own order-detail page (which has its own "تلاش دوباره برای پرداخت"
// retry action) are now shown in the error alert.
describe("CheckoutView payment-start recovery", () => {
  it("exposes an order-specific recovery link when payment initiation fails", async () => {
    placeOrder.mockResolvedValue({ order_number: "QA-ORDER-PAYMENT-FAILED" });
    startPayment.mockRejectedValue(new Error("درگاه پرداخت در دسترس نیست"));
    const submit = await renderReadyCheckout();

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(refreshCart).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledWith("QA-ORDER-PAYMENT-FAILED");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("درگاه پرداخت در دسترس نیست");
    expect(alert).toHaveTextContent("QA-ORDER-PAYMENT-FAILED");
    const link = screen.getByRole("link", { name: /QA-ORDER-PAYMENT-FAILED/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("QA-ORDER-PAYMENT-FAILED"));
  });

  it("retries payment for the existing order instead of placing a second order", async () => {
    placeOrder.mockResolvedValue({ order_number: "QA-ORDER-RETRY-SAFE" });
    startPayment.mockRejectedValue(new Error("درگاه موقتاً قطع است"));
    const submit = await renderReadyCheckout();

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });
    await screen.findByRole("alert");

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledTimes(2);
    expect(startPayment).toHaveBeenNthCalledWith(2, "QA-ORDER-RETRY-SAFE");
  });
});
