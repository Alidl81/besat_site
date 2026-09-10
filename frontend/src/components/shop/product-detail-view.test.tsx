import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const addItem = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span");
  return {
    GraduationCap: Icon,
    Loader2: Icon,
    Minus: Icon,
    Plus: Icon,
    Share2: Icon,
    ShieldCheck: Icon,
    Truck: Icon,
  };
});
vi.mock("@/components/content/rich-content-renderer", () => ({
  RichContentRenderer: () => React.createElement("div"),
}));
vi.mock("@/lib/shop/cart-context", () => ({
  useShopCart: () => ({ addItem }),
}));
vi.mock("@/lib/api/client", () => ({
  getApiErrorMessage: (reason: unknown) => String(reason),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const product = {
  id: 41,
  product_type: "physical" as const,
  title: "کتاب آزمون",
  slug: "book",
  short_description: null,
  description: null,
  featured_image: null,
  category: null,
  tags: [],
  price_amount: 100,
  sale_price_amount: null,
  price_display: null,
  sale_price_display: null,
  is_on_sale: false,
  is_featured: false,
  is_important: false,
  status: "published" as const,
  is_published: true,
  physical_detail: {
    availability: "in_stock" as const,
    weight_grams: null,
    requires_shipping: false,
    max_purchase_quantity: null,
  },
  course_detail: null,
  gallery_images: [],
  variants: [],
  seo: {},
};

// FE-SHOP-PRODUCT-ADD-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("ProductDetailView add-to-cart duplicate guard", () => {
  it("should collapse two immediate add-to-cart clicks into one request", async () => {
    const request = deferred<void>();
    addItem.mockReturnValue(request.promise);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    render(<ProductDetailView product={product} />);

    const button = await screen.findByRole("button", { name: "افزودن به سبد خرید" });
    await waitFor(() => expect(button).toBeEnabled());

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(addItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      request.resolve();
      await request.promise;
    });
  });

  it("should allow one intentional retry after a rejected add", async () => {
    addItem.mockRejectedValueOnce(new Error("network"));
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    render(<ProductDetailView product={product} />);
    const button = await screen.findByRole("button", { name: "افزودن به سبد خرید" });

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledTimes(1);

    const request = deferred<void>();
    addItem.mockReturnValue(request.promise);
    fireEvent.click(button);
    expect(addItem).toHaveBeenCalledTimes(2);
    await act(async () => {
      request.resolve();
      await request.promise;
    });
  });
});

// SEC-FE-SHOP-PUBLIC-MEDIA-SINK-001: the gallery images array copied
// featured_image/gallery_images.image directly into <img src> with no
// sanitization, so a protocol-relative "//evil.example/..." URL would be
// left unchanged and resolved off-origin by the browser.
describe("ProductDetailView public media URL safety", () => {
  it("does not render an unsanitized protocol-relative featured image", async () => {
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    render(<ProductDetailView product={{ ...product, featured_image: "//evil.example/product.jpg" }} />);

    expect(document.querySelector('img[src="//evil.example/product.jpg"]')).toBeNull();
  });

  it("does not render an unsanitized protocol-relative gallery image", async () => {
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    render(
      <ProductDetailView
        product={{
          ...product,
          gallery_images: [{ id: 1, image: "//evil.example/gallery.jpg", alt_text: "", caption: null, order: 0 }],
        }}
      />,
    );

    expect(document.querySelector('img[src="//evil.example/gallery.jpg"]')).toBeNull();
  });
});

function variantProduct(id: number, title: string, variantId: number) {
  return {
    ...product,
    id,
    title,
    slug: `qa-${id}`,
    variants: [{ id: variantId, sku: `QA-${variantId}`, title: `گزینه ${variantId}`, price_amount: 100, price_display: null, attributes: {}, in_stock: true }],
  };
}

// FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001: `variantId` (and quantity/
// activeImage/feedback) used to be seeded from `product` via a one-time
// useState initializer, never re-derived if the App Router reuses this
// same component instance across an A -> B product navigation. The
// previous product's variant selection stayed selected under the new
// product's unrelated variant list, so "افزودن به سبد خرید" could submit
// a variant that doesn't belong to the product on screen.
describe("ProductDetailView product navigation state", () => {
  afterEach(() => {
    addItem.mockReset();
  });

  it("resets variant selection when the product prop changes", async () => {
    addItem.mockResolvedValue(undefined);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    const view = render(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);
    const firstRadio = screen.getByRole("radio", { name: "گزینه 11" });
    expect(firstRadio).toHaveProperty("checked", true);

    view.rerender(<ProductDetailView product={variantProduct(2, "محصول B", 22)} />);
    const secondRadio = screen.getByRole("radio", { name: "گزینه 22" });
    expect(secondRadio).toHaveProperty("checked", true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledWith(2, 1, 22);
  });

  it("does not submit a null or previous-product variant after navigation", async () => {
    addItem.mockResolvedValue(undefined);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    const view = render(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);
    view.rerender(<ProductDetailView product={variantProduct(2, "محصول B", 22)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledWith(2, 1, 22);
  });

  // FE-SHOP-PRODUCT-DETAIL-PROP-STATE-001 (REOPENED, in-flight case): the
  // product-keyed state reset above already lets the *new* product's
  // button accept a fresh add-to-cart click right away -- but the *old*
  // product's still-in-flight addItem() call keeps running regardless,
  // and its own completion used to call setFeedback()/setSubmitting()
  // unconditionally once it settled, silently flipping whatever product
  // is now on screen to a stale success/error message.
  // currentProductIdRef lets handlePrimaryAction's completion check
  // whether the product it was called for is still the active one.
  it("does not let a previous product's late add success overwrite the new product", async () => {
    const first = deferred<void>();
    addItem.mockReturnValue(first.promise);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    const view = render(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledWith(1, 1, 11);

    view.rerender(<ProductDetailView product={variantProduct(2, "محصول B", 22)} />);
    expect(screen.getByRole("radio", { name: "گزینه 22" })).toHaveProperty("checked", true);

    await act(async () => {
      first.resolve();
      await first.promise;
    });

    expect(screen.queryAllByText("کالا به سبد خرید اضافه شد.")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeTruthy();
  });

  it("does not let a previous product's late add failure overwrite the new product", async () => {
    const first = deferred<void>();
    addItem.mockReturnValue(first.promise);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    const view = render(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    view.rerender(<ProductDetailView product={variantProduct(2, "محصول B", 22)} />);

    await act(async () => {
      first.reject(new Error("product A add failed"));
      await first.promise.catch(() => undefined);
    });

    expect(screen.queryByText(/محصول A/)).toBeNull();
    expect(screen.queryByText("اتصال به بک‌اند برقرار نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.")).toBeNull();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeTruthy();
  });

  // FE-SHOP-PRODUCT-DETAIL-REENTRY-RACE-001: fencing on `product.id` alone
  // isn't enough -- an A -> B -> A re-entry (the user navigates away and
  // back to the *same* product) produces two visits that share the
  // identical id, so a stale completion from the FIRST visit's request
  // incorrectly passed an id-only check once the user was back on A again
  // for the second time. visitGenerationRef is a plain counter bumped on
  // every product change, including a change back to a previously-seen
  // id -- unlike product.id, it distinguishes "this exact visit" from "an
  // earlier visit to the same product." Also added an explicit
  // "در حال افزودن.../در حال ثبت‌نام..." busy label (previously the button
  // only showed a spinner icon with an unchanged text label while
  // submitting), giving this exact race a directly observable UI signal.
  it("does not let a stale first visit overwrite a later visit to the same product", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    addItem.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { ProductDetailView } = await import("@/components/shop/product-detail-view");
    const view = render(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledTimes(1);

    view.rerender(<ProductDetailView product={variantProduct(2, "محصول B", 22)} />);
    view.rerender(<ProductDetailView product={variantProduct(1, "محصول A", 11)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
      await Promise.resolve();
    });
    expect(addItem).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve();
      await first.promise;
    });

    expect(screen.queryAllByText("کالا به سبد خرید اضافه شد.")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "در حال افزودن..." }).length).toBeGreaterThan(0);

    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(screen.queryAllByText("کالا به سبد خرید اضافه شد.").length).toBeGreaterThan(0);
  });
});
