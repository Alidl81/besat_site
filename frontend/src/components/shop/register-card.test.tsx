import React from "react";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const register = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/shared/besat-logo", () => ({
  BesatLogoMark: () => React.createElement("span", { "data-testid": "logo-mark" }),
}));
vi.mock("@/lib/auth/registration-service", () => ({
  performCustomerRegistration: register,
}));
vi.mock("@/lib/auth/auth-session", () => ({
  writeBesatSession: vi.fn(),
}));
vi.mock("@/lib/shop/cart-context", () => ({
  mergeGuestCartAfterAuth: vi.fn(),
}));

afterEach(() => {
  cleanup();
  register.mockReset();
});

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

async function fillAndGetForm() {
  const { RegisterCard } = await import("@/components/shop/register-card");
  const view = render(<RegisterCard />);

  fireEvent.change(within(view.container).getByRole("textbox", { name: "نام کامل" }), { target: { value: "QA User" } });
  fireEvent.change(within(view.container).getByRole("textbox", { name: "ایمیل" }), { target: { value: "qa@example.test" } });
  fireEvent.change(within(view.container).getByLabelText("رمز عبور"), { target: { value: "ValidPassword123!" } });
  fireEvent.change(within(view.container).getByLabelText("تکرار رمز عبور"), { target: { value: "ValidPassword123!" } });
  const form = within(view.container).getByRole("button", { name: "ساخت حساب کاربری" }).closest("form");
  expect(form).not.toBeNull();
  return form!;
}

// AUTH-UI-REGISTER-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("RegisterCard duplicate submission guard", () => {
  it("only calls performCustomerRegistration once when two submits arrive before the first resolves", async () => {
    const deferred = createDeferred<{ ok: false; message: string }>();
    register.mockReturnValue(deferred.promise);
    const form = await fillAndGetForm();

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(register).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ ok: false, message: "خطا" });
      await deferred.promise;
    });
  });

  it("allows a genuine retry after a failed submission resolves", async () => {
    register.mockResolvedValueOnce({ ok: false, message: "این ایمیل قبلاً ثبت شده است." });
    const form = await fillAndGetForm();

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledTimes(1);

    const deferred = createDeferred<{ ok: false; message: string }>();
    register.mockReturnValue(deferred.promise);
    act(() => {
      fireEvent.submit(form);
    });
    expect(register).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve({ ok: false, message: "خطا" });
      await deferred.promise;
    });
  });
});
