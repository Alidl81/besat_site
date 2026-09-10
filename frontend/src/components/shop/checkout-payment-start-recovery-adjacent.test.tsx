import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const placeOrder = vi.fn();
const startPayment = vi.fn();
const refreshCart = vi.fn();
const getCheckoutPreview = vi.fn();
const getShippingMethods = vi.fn();
const getMyAddresses = vi.fn();

const initialCartItems = [{ id: 11, product: { id: 7, title: "کتاب آزمون", slug: "book", product_type: "online_course", featured_image: null }, variant: null, variant_title: null, quantity: 1, unit_price_amount: 100, unit_price_display: "۱۰۰", line_total_amount: 100, line_total_display: "۱۰۰", issue: null }];
// FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001 (reopen): mutable so a test
// can simulate the REAL post-order refreshCart() behavior -- the server
// cart is genuinely empty once placeOrder() has consumed it, which the
// earlier static "always has 1 item" mock never exercised, hiding the
// real early-return-before-recovery-markup bug from this test file.
let mockCartItems = initialCartItems;

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { ...props, href }, children),
}));
vi.mock("lucide-react", () => ({ Loader2: () => React.createElement("span"), MapPin: () => React.createElement("span"), Plus: () => React.createElement("span") }));
vi.mock("@/components/shared/container", () => ({ Container: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("main", props, children) }));
vi.mock("@/components/shop/address-form", () => ({ AddressForm: () => React.createElement("div") }));
vi.mock("@/lib/auth/auth-session", () => ({ readBesatSession: vi.fn(() => ({ access: "qa" })) }));
vi.mock("@/lib/shop/cart-context", () => ({
  useShopCart: () => ({
    cart: { id: 1, items: mockCartItems, item_count: mockCartItems.length, subtotal_amount: 100, subtotal_display: "۱۰۰", requires_shipping: false, has_blocking_issue: false },
    loading: false, error: null, announcement: "", addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), refresh: refreshCart, mergeAfterLogin: vi.fn(),
  }),
}));
vi.mock("@/services/shop-account-service", () => ({ createAddress: vi.fn(), getMyAddresses, placeOrder, startPayment }));
vi.mock("@/services/shop-service", () => ({ getCheckoutPreview, getShippingMethods }));

beforeEach(() => {
  mockCartItems = initialCartItems;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderReadyCheckout() {
  getCheckoutPreview.mockResolvedValue({ items: [{ cart_item_id: 11, product_id: 7, title: "کتاب آزمون", quantity: 1, unit_price_amount: 100, line_total_amount: 100, issue: null }], subtotal_amount: 100, shipping_amount: 0, discount_amount: 0, tax_amount: 0, total_amount: 100, requires_shipping: false, can_checkout: true });
  getShippingMethods.mockResolvedValue([]);
  getMyAddresses.mockResolvedValue([]);
  refreshCart.mockResolvedValue(undefined);
  const { CheckoutView } = await import("@/components/shop/checkout-view");
  render(<CheckoutView />);
  const submit = await screen.findByRole("button", { name: "پرداخت و ثبت سفارش" });
  await waitFor(() => expect(submit).toBeEnabled());
  return submit;
}

// FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001 (adjacent, post-REOPEN):
// the order-detail recovery link (see checkout-view.test.tsx) and the
// internal pendingOrderRef retry guard (recover the same order instead of
// re-placing it) work together -- this exercises both at once.
describe("CheckoutView payment-start recovery adjacent behavior", () => {
  it("exposes an order-specific recovery affordance after payment start fails", async () => {
    const orderNumber = "QA-ORDER-RECOVER-ME";
    placeOrder.mockResolvedValue({ order_number: orderNumber });
    startPayment.mockRejectedValue(new Error("درگاه در دسترس نیست"));
    const submit = await renderReadyCheckout();

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(orderNumber);
    expect(screen.getByRole("link", { name: new RegExp(orderNumber) })).toHaveAttribute("href", expect.stringContaining(orderNumber));
  });

  it("uses the remembered order for repeated payment attempts and keeps the submit guard synchronous", async () => {
    const orderNumber = "QA-ORDER-RETRY-REMEMBERED";
    const paymentPending = new Promise<never>(() => undefined);
    placeOrder.mockResolvedValue({ order_number: orderNumber });
    startPayment.mockRejectedValueOnce(new Error("درگاه موقتاً قطع است")).mockReturnValueOnce(paymentPending);
    const submit = await renderReadyCheckout();

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
      await Promise.resolve();
    });
    await screen.findByRole("alert");

    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
      await Promise.resolve();
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledTimes(2);
    expect(startPayment).toHaveBeenNthCalledWith(2, orderNumber);
  });

  it("still shows the order recovery link when the real post-order cart refresh comes back empty", async () => {
    // FE-SHOP-CHECKOUT-PAYMENT-START-RECOVERY-001-R1: the two tests above
    // never let refreshCart() actually change what useShopCart() returns,
    // so they could not catch the real bug Codex found live -- the
    // cart-is-empty early return (CheckoutView, before the main form) ran
    // before ever reaching the error/recoverableOrderNumber markup, once
    // the cart had genuinely gone empty after the order consumed it.
    const orderNumber = "QA-ORDER-EMPTY-CART-RECOVER";
    placeOrder.mockResolvedValue({ order_number: orderNumber });
    startPayment.mockRejectedValue(new Error("درگاه در دسترس نیست"));
    const submit = await renderReadyCheckout();
    // renderReadyCheckout() itself sets refreshCart.mockResolvedValue(undefined)
    // -- this must be configured after that call or it gets overwritten.
    refreshCart.mockImplementation(async () => {
      mockCartItems = [];
    });

    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByText("سبد خرید شما خالی است")).toBeInTheDocument());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(orderNumber);
    expect(screen.getByRole("link", { name: new RegExp(orderNumber) })).toHaveAttribute("href", expect.stringContaining(orderNumber));
  });
});
