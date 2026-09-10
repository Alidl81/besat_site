import { afterEach, describe, expect, it, vi } from "vitest";
import { cartApiRequest } from "@/lib/shop/cart-transport";

afterEach(() => vi.unstubAllGlobals());

// REL-FE-CART-TIMEOUT-001: cartApiRequest() used a raw fetch() with no
// AbortSignal at all -- the same defect REL-FE-BACKEND-TIMEOUT-001 fixed in
// the shared apiRequest()/apiDownload(), just in this separate cart
// transport (see cart-transport.ts's header comment for why cart has its
// own transport).
describe("cartApiRequest timeout", () => {
  it("attaches a default AbortSignal instead of leaving the request unbounded", async () => {
    let capturedSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return Response.json({ items: [] });
      }),
    );

    await cartApiRequest("/api/shop/cart/");

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("rejects once the deadline elapses for a hanging cart request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
          }),
      ),
    );

    // Real timers with a short explicit override -- AbortSignal.timeout()
    // does not respond to vitest's fake timers (confirmed empirically
    // while fixing REL-FE-BACKEND-TIMEOUT-001).
    await expect(cartApiRequest("/api/shop/cart/", { timeoutMs: 30 })).rejects.toBeInstanceOf(Error);
  });

  it("honors an explicit caller-provided signal instead of the default deadline", async () => {
    let capturedSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return Response.json({ items: [] });
      }),
    );

    const controller = new AbortController();
    await cartApiRequest("/api/shop/cart/", { signal: controller.signal });

    expect(capturedSignal).toBe(controller.signal);
  });
});
