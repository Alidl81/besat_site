import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest browser session boundary", () => {
  it("does not attach a bearer credential when the same-origin proxy owns the session", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      expect(authorization).toBeNull();
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("me/")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
