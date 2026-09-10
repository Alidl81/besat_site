import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartWidget } from "@/components/shop/cart-drawer";

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
  document.body.style.overflow = "";
  vi.clearAllMocks();
});

function openDrawer() {
  render(<CartWidget />);
  fireEvent.click(screen.getByRole("button", { name: /سبد خرید/ }));
}

// FE-SHOP-CART-CONTROLS-DOUBLE-SUBMIT-001: mirrors the identical fix and
// rationale in cart-page-view.test.tsx -- CartWidget's runMutation has the
// exact same stale-payload double-submit shape.
describe("cart drawer mutation controls", () => {
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

    openDrawer();
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

    openDrawer();
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
});

// SEC-FE-SHOP-PUBLIC-MEDIA-SINK-001: item.product.featured_image was
// copied directly into <img src> with no sanitization, so a
// protocol-relative "//evil.example/..." URL would be left unchanged and
// resolved off-origin by the browser.
describe("cart drawer public media URL safety", () => {
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

    openDrawer();

    expect(document.querySelector('img[src="//evil.example/product.jpg"]')).toBeNull();
  });
});
