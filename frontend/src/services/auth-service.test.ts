import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { HAS_SESSION_COOKIE_NAME } from "@/lib/auth/session-marker-cookie";
import { getCurrentUser } from "@/services/auth-service";

function setDocumentCookie(value: string) {
  Object.defineProperty(document, "cookie", { value, configurable: true, writable: true });
}

beforeEach(() => {
  setDocumentCookie("");
});

afterEach(() => {
  vi.unstubAllGlobals();
  setDocumentCookie("");
});

describe("getCurrentUser guest short-circuit", () => {
  it("rejects without calling fetch when the has-session marker cookie is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls fetch when the has-session marker cookie is present", async () => {
    setDocumentCookie(`${HAS_SESSION_COOKIE_NAME}=1`);
    const fetchMock = vi.fn(async () => Response.json({ username: "u", role: "parent" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).resolves.toEqual({ username: "u", role: "parent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still attaches an explicit token even without the marker cookie", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer explicit-token");
      return Response.json({ username: "u", role: "parent" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser("explicit-token")).resolves.toEqual({ username: "u", role: "parent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
