import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import {
  clearBesatSession,
  writeBesatSession,
} from "@/lib/auth/auth-session";

afterEach(() => {
  clearBesatSession();
  vi.unstubAllGlobals();
});

describe("apiRequest token refresh", () => {
  it("shares one refresh request across concurrent 401 responses", async () => {
    writeBesatSession({
      accessToken: "expired",
      refreshToken: "refresh",
      username: "manager",
      fullName: "Manager",
      role: "general_manager",
      redirectPath: "/dashboard/admin",
      unitId: null,
    });
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("Authorization");
      if (url.endsWith("/auth/refresh/")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Response.json({ access: "fresh", refresh: "rotated" });
      }
      if (authorization === "Bearer expired") {
        return Response.json({ detail: "expired" }, { status: 401 });
      }
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      apiRequest<{ ok: boolean }>("me/", { token: "expired" }),
      apiRequest<{ ok: boolean }>("me/permissions/", { token: "expired" }),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });
});
