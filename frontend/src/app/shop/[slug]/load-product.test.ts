import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

vi.mock("@/services/shop-service", () => ({
  getShopProduct: vi.fn(),
  getShopProducts: vi.fn(),
}));

import { getShopProduct } from "@/services/shop-service";
import { loadProduct } from "./load-product";

// FE-SHOP-ERROR-MASKING-001: a genuine backend 404 must still resolve to
// `null` (so the page calls notFound()), but any other failure -- a 429
// rate-limit, a 500, a network error -- must propagate instead of being
// silently treated as "product not found".
// Each case below (other than the ones deliberately reusing a slug to test
// coalescing itself) uses its own slug -- `loadProduct()` now reuses a
// just-settled result for a few seconds (see load-product.ts), so two tests
// sharing a slug in the same run would otherwise see one test's mocked
// outcome leak into the next.
describe("loadProduct", () => {
  it("resolves to null on a genuine 404", async () => {
    (getShopProduct as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ message: "not found", status: 404 }),
    );

    await expect(loadProduct("missing-slug")).resolves.toBeNull();
  });

  it("propagates a 429 instead of masking it as not-found", async () => {
    (getShopProduct as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ message: "throttled", status: 429 }),
    );

    await expect(loadProduct("throttled-slug")).rejects.toMatchObject({ status: 429 });
  });

  it("propagates a 500 instead of masking it as not-found", async () => {
    (getShopProduct as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ message: "server error", status: 500 }),
    );

    await expect(loadProduct("server-error-slug")).rejects.toMatchObject({ status: 500 });
  });

  it("returns the product on success", async () => {
    const product = { id: 1, slug: "real-slug" };
    (getShopProduct as ReturnType<typeof vi.fn>).mockResolvedValueOnce(product);

    await expect(loadProduct("real-slug")).resolves.toBe(product);
  });

  // REL-FE-BACKEND-TIMEOUT-001-R1: generateMetadata() and the page
  // component call loadProduct() for the same slug within the same
  // request; overlapping calls must share one upstream fetch instead of
  // issuing it twice (React's `cache()` alone doesn't cover this -- see
  // load-product.ts's header comment for why).
  it("coalesces concurrent calls for the same slug into a single upstream request", async () => {
    let resolveFetch!: (value: unknown) => void;
    (getShopProduct as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = loadProduct("concurrent-slug");
    const second = loadProduct("concurrent-slug");

    const product = { id: 2, slug: "concurrent-slug" };
    resolveFetch(product);

    await expect(first).resolves.toBe(product);
    await expect(second).resolves.toBe(product);
    expect(getShopProduct).toHaveBeenCalledTimes(1);
  });

  // REL-FE-BACKEND-TIMEOUT-001-R1: instrumentation against a real build
  // showed Next re-invoking loadProduct() a *third* time, ~13ms after the
  // first two (already-coalesced) calls settled -- an in-flight-only map
  // that evicts the instant a call settles misses this near-immediate
  // repeat, so the upstream still saw it as a fresh request. Reusing the
  // just-settled result for a short grace window closes that gap.
  it("reuses a just-settled result for a near-immediate repeat call", async () => {
    const product = { id: 3, slug: "sequential-slug" };
    (getShopProduct as ReturnType<typeof vi.fn>).mockResolvedValue(product);

    await loadProduct("sequential-slug");
    await loadProduct("sequential-slug");

    expect(getShopProduct).toHaveBeenCalledTimes(1);
  });

  it("issues a fresh upstream request once the grace window has elapsed", async () => {
    vi.useFakeTimers();
    try {
      const product = { id: 4, slug: "stale-slug" };
      (getShopProduct as ReturnType<typeof vi.fn>).mockResolvedValue(product);

      await loadProduct("stale-slug");
      await vi.advanceTimersByTimeAsync(3_001);
      await loadProduct("stale-slug");

      expect(getShopProduct).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // REL-FE-BACKEND-TIMEOUT-001-R4: error.tsx's retry button forces
  // page.tsx's Server Component to re-run, which calls loadProduct()
  // again -- a live probe found a fast retry click (~430ms after the
  // error) reused the SAME rejected result from GRACE_MS's full 3s
  // window, producing no new upstream request at all. A rejected result
  // must still collapse the internal near-simultaneous duplicate calls
  // (this test), but on a much shorter timeline than a success (the next
  // test) -- a real retry click is always at least an order of magnitude
  // slower than those ~13ms-apart internal calls.
  it("reuses a just-rejected result for a near-immediate repeat call", async () => {
    (getShopProduct as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError({ message: "server error", status: 500 }),
    );

    await expect(loadProduct("flaky-slug")).rejects.toMatchObject({ status: 500 });
    await expect(loadProduct("flaky-slug")).rejects.toMatchObject({ status: 500 });

    expect(getShopProduct).toHaveBeenCalledTimes(1);
  });

  it("issues a fresh upstream request once the SHORTER failure grace window has elapsed, unlike a success", async () => {
    vi.useFakeTimers();
    try {
      (getShopProduct as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError({ message: "server error", status: 500 }),
      );

      await expect(loadProduct("retry-slug")).rejects.toMatchObject({ status: 500 });
      // Well past the short failure grace window, but still far short of
      // GRACE_MS -- exactly the timing a real retry-button click has.
      await vi.advanceTimersByTimeAsync(201);
      await expect(loadProduct("retry-slug")).rejects.toMatchObject({ status: 500 });

      expect(getShopProduct).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
