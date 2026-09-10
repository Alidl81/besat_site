import React from "react";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressForm } from "@/components/shop/address-form";

const values: Record<string, string> = {
  "نام گیرنده": "QA Parent",
  "شماره تماس": "09120000000",
  استان: "تهران",
  شهر: "تهران",
  آدرس: "خیابان آزمون",
};

afterEach(() => cleanup());

// See login-card.test.tsx's identical helper for why this exists: resolving
// a pending mock promise explicitly before the test ends keeps every test
// fully settled before the next one starts.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fillAndGetForm(onSubmit: (...args: unknown[]) => Promise<void>) {
  const view = render(<AddressForm onSubmit={onSubmit} />);
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(within(view.container).getByRole("textbox", { name: label }), { target: { value } });
  }
  const form = within(view.container).getByRole("button", { name: "ذخیره آدرس" }).closest("form");
  expect(form).not.toBeNull();
  return form!;
}

// FE-SHOP-ADDRESS-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("AddressForm duplicate submission guard", () => {
  it("only calls the supplied onSubmit once when two submits arrive before the first resolves", async () => {
    const deferred = createDeferred<void>();
    const onSubmit = vi.fn().mockReturnValue(deferred.promise);
    const form = fillAndGetForm(onSubmit);

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  it("allows a genuine retry after a failed submission resolves", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("failed"));
    const form = fillAndGetForm(onSubmit);

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<void>();
    onSubmit.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.submit(form);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });
});
