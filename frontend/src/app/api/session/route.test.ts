import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalBackendApiUrl = process.env.BESAT_BACKEND_API_URL;

beforeEach(() => {
  process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
});

afterEach(() => {
  if (originalBackendApiUrl === undefined) delete process.env.BESAT_BACKEND_API_URL;
  else process.env.BESAT_BACKEND_API_URL = originalBackendApiUrl;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// SEC-FE-AUTH-LOGIN-CSRF-001: this route issues (POST) and clears (DELETE)
// the session cookie directly, but never checked Origin before doing
// either. text/plain is a CORS-simple content type, so an attacker page
// can send a JSON body with fetch(..., { mode: "no-cors" }) without a
// preflight -- the route still parsed it through request.json(). Both
// handlers now reject a cross-origin mutation (via the shared
// isCrossOriginMutation() guard, lib/server/cross-origin-guard.ts) before
// ever forwarding to the backend or touching cookies.
describe("session login/logout CSRF boundary", () => {
  it("rejects a cross-origin login POST before forwarding credentials", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access: "qa-access-token",
        refresh: "qa-refresh-token",
        user: { username: "attacker-account", role: "parent" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/session/route");
    const response = await POST(
      new Request("https://besat.org/api/session", {
        method: "POST",
        headers: {
          Host: "besat.org",
          Origin: "https://evil.example",
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ username: "attacker-account", password: "ValidPassword123!" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin logout DELETE before clearing the session", async () => {
    const fetchMock = vi.fn(async () => Response.json({ detail: "logged out" }));
    vi.stubGlobal("fetch", fetchMock);

    const { DELETE } = await import("@/app/api/session/route");
    const response = await DELETE(
      new Request("https://besat.org/api/session", {
        method: "DELETE",
        headers: {
          Host: "besat.org",
          Origin: "https://evil.example",
          Cookie: "besat_access=qa-access; besat_refresh=qa-refresh",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie") ?? "").not.toContain("Max-Age=0");
  });
});
