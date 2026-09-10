import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock, routerMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  routerMock: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/services/auth-service", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/auth/login-service", () => ({ destroySession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/shop",
}));

import { SiteAuthActions } from "@/components/auth/site-auth-actions";
import { DashboardGuard } from "@/components/auth/dashboard-guard";

const loggedInUser = {
  username: "gm",
  full_name: "مدیر",
  role: "general_manager",
  redirect_path: "/dashboard/admin",
  unit_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// AUTH-FE-CROSS-TAB-SESSION-CHANNEL-001: the display session used to live
// in sessionStorage, which is scoped per top-level browsing context (tab)
// and never fires the native `storage` event in OTHER tabs -- so a real
// second-tab logout was structurally invisible to these components' own
// `storage` listeners, even though that listener was already there and
// correctly wired. Moved the display cache to localStorage, the browser's
// actual cross-tab-propagation mechanism, and here (unlike the
// besat-auth-changed-based tests in the sibling *-cross-tab-race.test.tsx
// files, which only prove same-tab dispatch works) simulate exactly what a
// real second tab produces: writing the OTHER tab's localStorage mutation
// directly (which, like in a real browser, does not self-fire `storage` in
// this same window) and then dispatching the native StorageEvent this
// window would receive from that other tab.
function dispatchCrossTabStorageEvent(key: string, oldValue: string | null, newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      oldValue,
      newValue,
      storageArea: window.localStorage,
      url: window.location.href,
    }),
  );
}

describe("cross-tab session propagation via the native storage event", () => {
  it("SiteAuthActions logs out when another tab clears the session", async () => {
    const raw = JSON.stringify(loggedInUser);
    window.localStorage.setItem("besat_session_display", raw);
    getCurrentUserMock.mockResolvedValue(loggedInUser);

    render(<SiteAuthActions />);
    await waitFor(() => expect(screen.getByRole("link", { name: "پنل من" })).toBeInTheDocument());

    // Another tab logs out: it removes the key from the shared localStorage
    // and this window receives the native cross-tab StorageEvent.
    await act(async () => {
      window.localStorage.removeItem("besat_session_display");
      dispatchCrossTabStorageEvent("besat_session_display", raw, null);
    });

    await waitFor(() => expect(screen.getByRole("link", { name: "ورود" })).toBeInTheDocument());
  });

  it("DashboardGuard denies access when another tab clears the session", async () => {
    const raw = JSON.stringify(loggedInUser);
    window.localStorage.setItem("besat_session_display", raw);
    getCurrentUserMock.mockResolvedValue(loggedInUser);

    render(
      <DashboardGuard segment="admin">
        <div data-testid="protected-dashboard">محرمانه</div>
      </DashboardGuard>,
    );
    await waitFor(() => expect(screen.getByTestId("protected-dashboard")).toBeInTheDocument());

    await act(async () => {
      window.localStorage.removeItem("besat_session_display");
      dispatchCrossTabStorageEvent("besat_session_display", raw, null);
    });

    await waitFor(() => expect(screen.queryByTestId("protected-dashboard")).toBeNull());
  });
});
