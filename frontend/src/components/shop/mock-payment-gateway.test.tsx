import React from "react";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { searchParams, submitMockPaymentOutcome } = vi.hoisted(() => ({
  searchParams: new URLSearchParams("token=qa-token&return_url=%2Fshop"),
  submitMockPaymentOutcome: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("@/services/shop-account-service", () => ({ submitMockPaymentOutcome }));

afterEach(() => {
  cleanup();
  submitMockPaymentOutcome.mockReset();
  searchParams.set("token", "qa-token");
  searchParams.set("return_url", "/shop");
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function renderGateway() {
  const { MockPaymentGateway } = await import("@/components/shop/mock-payment-gateway");
  const view = render(<MockPaymentGateway attemptId={1} />);
  const success = within(view.container).getByRole("button", { name: /شبیه‌سازی پرداخت موفق/ });
  return { view, success };
}

// FE-SHOP-MOCK-PAYMENT-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("MockPaymentGateway duplicate choice submission guard", () => {
  it("only calls submitMockPaymentOutcome once when two clicks arrive before the first settles", async () => {
    const deferred = createDeferred<{ outcome: string }>();
    submitMockPaymentOutcome.mockReturnValue(deferred.promise);
    const { success } = await renderGateway();

    act(() => {
      fireEvent.click(success);
      fireEvent.click(success);
    });

    expect(submitMockPaymentOutcome).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ outcome: "success" });
      await deferred.promise;
    });
  });

  it("allows a genuine retry after a non-terminal failure resolves", async () => {
    submitMockPaymentOutcome.mockRejectedValueOnce(new Error("خطا"));
    const { success } = await renderGateway();

    await act(async () => {
      fireEvent.click(success);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(submitMockPaymentOutcome).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<{ outcome: string }>();
    submitMockPaymentOutcome.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.click(success);
    });
    expect(submitMockPaymentOutcome).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve({ outcome: "success" });
      await deferred.promise;
    });
  });
});
