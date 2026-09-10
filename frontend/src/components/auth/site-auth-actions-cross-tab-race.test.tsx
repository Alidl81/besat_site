import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/services/auth-service", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/auth/login-service", () => ({ destroySession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/shop",
}));

import { SiteAuthActions } from "@/components/auth/site-auth-actions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const staleUser = {
  username: "old-user",
  full_name: "کاربر قدیمی",
  role: "parent",
  redirect_path: "/dashboard/parents",
  unit_id: null,
};

const freshUser = {
  username: "new-user",
  full_name: "کاربر جدید",
  role: "parent",
  redirect_path: "/dashboard/parents",
  unit_id: null,
};

beforeEach(() => {
  window.localStorage.clear();
  getCurrentUserMock.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

// AUTH-FE-SESSION-DISPLAY-STALE-RESURRECT-001: the mount-time getCurrentUser()
// call was fenced only by `active` (unmount), so a besat-auth-changed event
// (this tab's own logout, or a storage event from another tab) landing while
// it was still pending was invisible to it. sessionGenerationRef, bumped by
// syncSession() on every such event, now fences both the success path (a
// stale success must not resurrect a display an external event already
// cleared) and the error path (a stale rejection must not clear a display an
// external event already replaced with a newer, valid account).
describe("SiteAuthActions session identity invalidation", () => {
  it("does not resurrect a stale /me result after an external logout event", async () => {
    const pending = deferred<typeof staleUser>();
    getCurrentUserMock.mockReturnValue(pending.promise);
    window.localStorage.setItem("besat_session_display", JSON.stringify(staleUser));

    render(<SiteAuthActions />);

    await waitFor(() => expect(getCurrentUserMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new Event("besat-auth-changed"));
    });
    expect(screen.getByRole("link", { name: "پنل من" })).toBeInTheDocument();

    await act(async () => {
      window.localStorage.removeItem("besat_session_display");
      window.dispatchEvent(new Event("besat-auth-changed"));
    });
    expect(screen.getByRole("link", { name: "ورود" })).toBeInTheDocument();

    await act(async () => {
      pending.resolve(staleUser);
    });

    await waitFor(() => expect(screen.getByRole("link", { name: "ورود" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "پنل من" })).not.toBeInTheDocument();
  });

  it("does not clear a newly written account when the old /me request rejects", async () => {
    const pending = deferred<typeof staleUser>();
    getCurrentUserMock.mockReturnValue(pending.promise);
    window.localStorage.setItem("besat_session_display", JSON.stringify(staleUser));

    render(<SiteAuthActions />);

    await waitFor(() => expect(getCurrentUserMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new Event("besat-auth-changed"));
    });
    await waitFor(() => expect(screen.getByRole("link", { name: "پنل من" })).toBeInTheDocument());

    await act(async () => {
      window.localStorage.setItem("besat_session_display", JSON.stringify(freshUser));
      window.dispatchEvent(new Event("besat-auth-changed"));
    });
    await waitFor(() => expect(screen.getByRole("link", { name: "پنل من" })).toBeInTheDocument());

    await act(async () => {
      pending.reject(new Error("stale request rejected"));
    });

    await waitFor(() => expect(screen.getByRole("link", { name: "پنل من" })).toBeInTheDocument());
    expect(window.localStorage.getItem("besat_session_display")).toContain("new-user");
  });
});
