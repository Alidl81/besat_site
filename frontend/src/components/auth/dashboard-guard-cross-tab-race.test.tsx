import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock, routerMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  // A stable object reference, matching real next/navigation's useRouter()
  // (a context value, not re-created per render) -- a mock that returns a
  // fresh object on every call makes DashboardGuard's [router, segment]
  // effect re-run on every re-render, which is a test-mock artifact, not a
  // real behavior of the component.
  routerMock: { replace: vi.fn() },
}));

vi.mock("@/services/auth-service", () => ({
  getCurrentUser: getCurrentUserMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

import { DashboardGuard } from "@/components/auth/dashboard-guard";
import { clearBesatSession } from "@/lib/auth/auth-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  document.cookie = "besat_has_session=1; path=/";
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.cookie = "besat_has_session=; Max-Age=0; path=/";
});

// AUTH-FE-DASH-GUARD-STALE-SESSION-001: DashboardGuard previously had no
// besat-auth-changed/storage listener at all -- once a guard settled to
// "allowed" it kept rendering protected children forever, even after a
// logout (this tab's or another tab's) cleared the session. Also, its
// initial getCurrentUser() call was fenced only by `active` (unmount), so a
// stale success arriving after an external clearBesatSession() re-admitted
// the guard. Fixed with a single applyGuardDecision() re-derived from the
// current session on every besat-auth-changed/storage event (covering the
// whole guard lifetime, not just the initial check) plus a
// sessionGenerationRef fence on the initial getCurrentUser() completion.
//
// Note: Codex's own probe for this finding does not mock next/navigation,
// so DashboardGuard's useRouter() call throws ("invariant expected app
// router to be mounted") before ever reaching the guard logic under test --
// a QA-harness gap, not a product bug. This copy adds that mock, using a
// stable object reference (matching real next/navigation's context-backed,
// per-render-stable useRouter() return value) -- a fresh-object-per-call
// mock would make the effect's [router, segment] dependency array treat
// `router` as changed on every re-render and needlessly re-run the effect.
describe("DashboardGuard cross-tab session invalidation", () => {
  it("must not admit a stale guard completion after an external logout event", async () => {
    const request = deferred<{ username: string; full_name: string; role: string }>();
    getCurrentUserMock.mockReturnValue(request.promise);

    render(
      <DashboardGuard segment="admin">
        <div data-testid="protected-dashboard">محرمانه</div>
      </DashboardGuard>,
    );
    await waitFor(() => expect(getCurrentUserMock).toHaveBeenCalledTimes(1));

    // A second tab (or another mounted auth action) clears the session and
    // dispatches the real application's besat-auth-changed event while this
    // guard's original /me request is still in flight.
    act(() => {
      clearBesatSession();
    });

    await act(async () => {
      request.resolve({ username: "gm", full_name: "مدیر قدیمی", role: "general_manager" });
      await request.promise;
    });

    await waitFor(() => expect(screen.queryByTestId("protected-dashboard")).toBeNull());
  });

  it("must remove an already-admitted dashboard when another tab clears the session", async () => {
    getCurrentUserMock.mockResolvedValue({ username: "gm", full_name: "مدیر", role: "general_manager" });

    render(
      <DashboardGuard segment="admin">
        <div data-testid="protected-dashboard">محرمانه</div>
      </DashboardGuard>,
    );
    await waitFor(() => expect(screen.getByTestId("protected-dashboard")).toBeInTheDocument());

    act(() => {
      clearBesatSession();
    });

    await waitFor(() => expect(screen.queryByTestId("protected-dashboard")).toBeNull());
  });
});
