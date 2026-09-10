import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { destroySessionMock, pushMock, refreshMock, getCurrentUserMock } = vi.hoisted(() => ({
  destroySessionMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/login-service", () => ({ destroySession: destroySessionMock }));
vi.mock("@/services/auth-service", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => "/shop",
}));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));

import { PanelLogoutButton } from "@/components/auth/panel-logout-button";
import { SiteAuthActions } from "@/components/auth/site-auth-actions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

// AUTH-UI-PANEL-LOGOUT-DOUBLE-SUBMIT-001 + FE-AUTH-SITE-LOGOUT-DOUBLE-SUBMIT-001:
// both logout handlers were guarded only with state-backed `loading`/
// `isLoggingOut`, so two same-tick clicks both reached destroySession.
describe("logout mutation re-entrancy", () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({
      username: "qa-user",
      full_name: "کاربر آزمون",
      role: "parent",
      redirect_path: "/dashboard/parents",
      unit_id: null,
    });
  });

  it("should send one panel logout request for two same-turn clicks", async () => {
    const pending = deferred<void>();
    destroySessionMock.mockReturnValue(pending.promise);
    render(<PanelLogoutButton />);

    const button = screen.getByRole("button", { name: /خروج از حساب/ });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(destroySessionMock).toHaveBeenCalledTimes(1);
    pending.resolve();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  it("should send one public logout request for two same-turn clicks", async () => {
    const pending = deferred<void>();
    destroySessionMock.mockReturnValue(pending.promise);
    render(<SiteAuthActions />);
    await waitFor(() => expect(screen.getByRole("button", { name: "خروج" })).toBeInTheDocument());

    const button = screen.getByRole("button", { name: "خروج" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(destroySessionMock).toHaveBeenCalledTimes(1);
    pending.resolve();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });
});
