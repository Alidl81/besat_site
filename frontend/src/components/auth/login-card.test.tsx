import React from "react";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/auth/login-service", () => ({ performLogin: login }));
vi.mock("@/lib/auth/auth-session", () => ({ writeBesatSession: vi.fn() }));
vi.mock("@/lib/shop/cart-context", () => ({ mergeGuestCartAfterAuth: vi.fn() }));

afterEach(() => {
  cleanup();
  login.mockReset();
});

// A `new Promise(() => undefined)` that's never settled leaves handleSubmit
// permanently suspended on an unmounted component once the test ends --
// harmless in isolation, but resolving it explicitly before the test
// finishes keeps every test fully settled (no dangling in-flight work)
// before the next one starts, which is more robust when this file runs
// alongside many others in the same suite.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function fillAndGetForm() {
  const { LoginCard } = await import("@/components/auth/login-card");
  const view = render(<LoginCard />);

  fireEvent.change(within(view.container).getByRole("textbox", { name: "نام کاربری" }), {
    target: { value: "qa-user" },
  });
  fireEvent.change(within(view.container).getByLabelText("رمز عبور"), { target: { value: "qa-password" } });
  const form = within(view.container).getByRole("button", { name: "ورود" }).closest("form");
  expect(form).not.toBeNull();
  return form!;
}

// AUTH-UI-DOUBLE-SUBMIT-001: `disabled={isSubmitting}` alone doesn't stop a
// second form submit event that arrives before React re-renders with the
// updated state -- a synchronous ref guard is needed too.
describe("LoginCard duplicate submission guard", () => {
  it("only calls performLogin once when two submits arrive before the first resolves", async () => {
    const deferred = createDeferred<{ ok: false; message: string }>();
    login.mockReturnValue(deferred.promise);
    const form = await fillAndGetForm();

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ ok: false, message: "خطا" });
      await deferred.promise;
    });
  });

  it("allows a genuine retry after a failed submission resolves", async () => {
    login.mockResolvedValueOnce({ ok: false, message: "نام کاربری یا رمز عبور اشتباه است." });
    const form = await fillAndGetForm();

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(login).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<{ ok: false; message: string }>();
    login.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.submit(form);
    });
    expect(login).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve({ ok: false, message: "خطا" });
      await deferred.promise;
    });
  });
});
