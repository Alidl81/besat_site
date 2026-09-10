import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartPageView } from "@/components/shop/cart-page-view";

const { cartContext, updateItem, removeItem } = vi.hoisted(() => ({
  cartContext: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock("@/lib/shop/cart-context", () => ({
  useShopCart: cartContext,
}));

const cart = {
  id: 1,
  item_count: 1,
  subtotal_amount: 1000,
  subtotal_display: "۱٬۰۰۰ تومان",
  requires_shipping: false,
  has_blocking_issue: false,
  items: [
    {
      id: 41,
      product: {
        id: 7,
        title: "کتاب آزمون",
        slug: "exam-book",
        product_type: "physical" as const,
        featured_image: null,
      },
      variant: null,
      variant_title: null,
      quantity: 1,
      unit_price_amount: 1000,
      unit_price_display: "۱٬۰۰۰ تومان",
      line_total_amount: 1000,
      line_total_display: "۱٬۰۰۰ تومان",
      issue: null,
    },
  ],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-SHOP-CART-CONTROLS-DOUBLE-SUBMIT-001: runMutation used to receive an
// already-started promise (the mutation had already been dispatched by the
// time it could check anything), so two same-tick clicks on a quantity
// button both computed the target quantity against the same stale
// `item.quantity` and sent the identical value twice instead of the cart
// incrementing twice.
describe("cart page mutation controls", () => {
  it("collapses two same-tick quantity-increase clicks to one mutation", async () => {
    const deferred = createDeferred<void>();
    updateItem.mockReturnValue(deferred.promise);
    cartContext.mockReturnValue({
      cart,
      loading: false,
      error: null,
      updateItem,
      removeItem,
      refresh: vi.fn(),
    });

    render(<CartPageView />);
    const increase = screen.getByRole("button", { name: "افزایش تعداد کتاب آزمون" });
    await act(async () => {
      fireEvent.click(increase);
      fireEvent.click(increase);
      await Promise.resolve();
    });

    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(updateItem).toHaveBeenCalledWith(41, 2);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  it("collapses two same-tick remove clicks to one mutation", async () => {
    const deferred = createDeferred<void>();
    removeItem.mockReturnValue(deferred.promise);
    cartContext.mockReturnValue({
      cart,
      loading: false,
      error: null,
      updateItem,
      removeItem,
      refresh: vi.fn(),
    });

    render(<CartPageView />);
    const remove = screen.getByRole("button", { name: "حذف کتاب آزمون از سبد خرید" });
    await act(async () => {
      fireEvent.click(remove);
      fireEvent.click(remove);
      await Promise.resolve();
    });

    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith(41);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  it("allows a genuine retry once the pending mutation for that item settles", async () => {
    updateItem.mockRejectedValueOnce(new Error("network"));
    cartContext.mockReturnValue({
      cart,
      loading: false,
      error: null,
      updateItem,
      removeItem,
      refresh: vi.fn(),
    });

    render(<CartPageView />);
    const increase = screen.getByRole("button", { name: "افزایش تعداد کتاب آزمون" });

    await act(async () => {
      fireEvent.click(increase);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(updateItem).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<void>();
    updateItem.mockReturnValue(deferred.promise);
    fireEvent.click(increase);
    expect(updateItem).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  it("does not block a mutation on a different cart item while one item's mutation is pending", async () => {
    const secondItem = { ...cart.items[0], id: 42, product: { ...cart.items[0].product, id: 8, title: "کتاب دوم", slug: "second-book" } };
    const twoItemCart = { ...cart, items: [cart.items[0], secondItem] };
    const firstDeferred = createDeferred<void>();
    updateItem.mockReturnValue(firstDeferred.promise);
    cartContext.mockReturnValue({
      cart: twoItemCart,
      loading: false,
      error: null,
      updateItem,
      removeItem,
      refresh: vi.fn(),
    });

    render(<CartPageView />);
    fireEvent.click(screen.getByRole("button", { name: "افزایش تعداد کتاب آزمون" }));
    fireEvent.click(screen.getByRole("button", { name: "افزایش تعداد کتاب دوم" }));

    expect(updateItem).toHaveBeenCalledTimes(2);
    expect(updateItem).toHaveBeenNthCalledWith(1, 41, 2);
    expect(updateItem).toHaveBeenNthCalledWith(2, 42, 2);

    await act(async () => {
      firstDeferred.resolve();
      await firstDeferred.promise;
    });
  });
});

// SEC-FE-SHOP-PUBLIC-MEDIA-SINK-001: item.product.featured_image was
// copied directly into <img src> with no sanitization, so a
// protocol-relative "//evil.example/..." URL would be left unchanged and
// resolved off-origin by the browser.
describe("cart page public media URL safety", () => {
  it("does not render an unsanitized protocol-relative product image", () => {
    const unsafeCart = {
      ...cart,
      items: [{ ...cart.items[0], product: { ...cart.items[0].product, featured_image: "//evil.example/product.jpg" } }],
    };
    cartContext.mockReturnValue({
      cart: unsafeCart,
      loading: false,
      error: null,
      updateItem,
      removeItem,
      refresh: vi.fn(),
    });

    render(<CartPageView />);

    expect(document.querySelector('img[src="//evil.example/product.jpg"]')).toBeNull();
  });
});
