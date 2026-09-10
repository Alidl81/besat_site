import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setAccountPassword = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("@/components/shared/besat-logo", () => ({
  BesatLogoMark: () => React.createElement("span", { "data-testid": "logo-mark" }),
}));
vi.mock("@/lib/api/account-api", () => ({ setAccountPassword }));

afterEach(() => {
  cleanup();
  setAccountPassword.mockReset();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function fillAndGetForm() {
  const { SetPasswordCard } = await import("@/components/auth/set-password-card");
  render(<SetPasswordCard token="qa-invitation-token" />);

  fireEvent.change(screen.getByLabelText("رمز عبور جدید"), { target: { value: "ValidPassword123!" } });
  fireEvent.change(screen.getByLabelText("تکرار رمز عبور جدید"), { target: { value: "ValidPassword123!" } });
  const form = screen.getByRole("button", { name: "تعیین رمز عبور" }).closest("form");
  expect(form).not.toBeNull();
  return form!;
}

// AUTH-UI-SET-PASSWORD-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.test.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("SetPasswordCard duplicate submission guard", () => {
  it("only calls setAccountPassword once when two submits arrive before the first resolves", async () => {
    // Rejects (not resolves) so the component stays on the form -- letting
    // it reach the success screen would exercise a scrollIntoView() call
    // jsdom doesn't implement, unrelated to what this test verifies.
    const deferred = createDeferred<void>();
    setAccountPassword.mockReturnValue(deferred.promise);
    const form = await fillAndGetForm();

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(setAccountPassword).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.reject(new Error("خطا"));
      await deferred.promise.catch(() => undefined);
    });
  });

  it("allows a genuine retry after a failed submission resolves", async () => {
    const deferred = createDeferred<void>();
    setAccountPassword.mockReturnValueOnce(deferred.promise);
    const form = await fillAndGetForm();

    act(() => {
      fireEvent.submit(form);
    });
    await act(async () => {
      deferred.reject(new Error("خطا"));
      await deferred.promise.catch(() => undefined);
    });
    expect(setAccountPassword).toHaveBeenCalledTimes(1);

    const secondDeferred = createDeferred<void>();
    setAccountPassword.mockReturnValue(secondDeferred.promise);
    act(() => {
      fireEvent.submit(form);
    });
    expect(setAccountPassword).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondDeferred.reject(new Error("خطا"));
      await secondDeferred.promise.catch(() => undefined);
    });
  });
});

// FE-AUTH-SET-PASSWORD-TOKEN-RERENDER-001: `status`'s initial value used
// to be seeded from `token` only once, at mount -- if the App Router keeps
// this same client component instance alive across a query-string
// navigation (e.g. correcting an invalid invitation link by re-navigating
// to the same route with a valid `?token=`, or the reverse), `token`
// changes on a re-render but `status` never re-derived from it, leaving
// the component stuck on whichever screen it started on.
describe("SetPasswordCard token navigation boundary", () => {
  it("shows the password form when a same-instance navigation supplies a token", async () => {
    const { SetPasswordCard } = await import("@/components/auth/set-password-card");
    const view = render(<SetPasswordCard token={null} />);
    expect(screen.getByText(/لینک دعوت نامعتبر است/)).toBeTruthy();

    view.rerender(<SetPasswordCard token="qa-invitation-token" />);

    expect(screen.getByLabelText("رمز عبور جدید")).toBeTruthy();
    expect(screen.getByLabelText("تکرار رمز عبور جدید")).toBeTruthy();
  });

  it("does not leave a stale password form after a token is removed", async () => {
    const { SetPasswordCard } = await import("@/components/auth/set-password-card");
    const view = render(<SetPasswordCard token="qa-invitation-token" />);
    expect(screen.getByLabelText("رمز عبور جدید")).toBeTruthy();

    view.rerender(<SetPasswordCard token={null} />);

    expect(screen.getByText(/لینک دعوت نامعتبر است/)).toBeTruthy();
    expect(screen.queryByLabelText("رمز عبور جدید")).toBeNull();
  });
});

// FE-AUTH-SET-PASSWORD-TOKEN-RERENDER-001 (REOPENED, in-flight case): the
// render-time token synchronization above already lets a new token's form
// accept a fresh submission attempt right away -- but the *old* token's
// still-in-flight setAccountPassword() call keeps running regardless, and
// its own completion used to call setStatus("success") unconditionally
// once it settled, silently flipping whatever screen is now showing to
// "success" for a request that was never actually about the token now on
// screen. currentTokenRef lets handleSubmit's completion check whether the
// token it was called for is still the active one; if not, the result is
// discarded.
describe("SetPasswordCard in-flight token navigation", () => {
  it("does not let a previous token's completion mark the new token successful", async () => {
    const deferred = createDeferred<void>();
    setAccountPassword.mockReturnValue(deferred.promise);
    const { SetPasswordCard } = await import("@/components/auth/set-password-card");
    const view = render(<SetPasswordCard token="token-A" />);

    fireEvent.change(screen.getByLabelText("رمز عبور جدید"), { target: { value: "ValidPassword123!" } });
    fireEvent.change(screen.getByLabelText("تکرار رمز عبور جدید"), { target: { value: "ValidPassword123!" } });
    const form = screen.getByRole("button", { name: "تعیین رمز عبور" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      await Promise.resolve();
    });
    expect(setAccountPassword).toHaveBeenCalledWith({ token: "token-A", password: "ValidPassword123!" });

    view.rerender(<SetPasswordCard token="token-B" />);
    expect(screen.getByLabelText("رمز عبور جدید")).toBeTruthy();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(screen.queryByText(/با موفقیت تعیین شد/)).toBeNull();
    expect(screen.getByLabelText("رمز عبور جدید")).toBeTruthy();
  });
});
