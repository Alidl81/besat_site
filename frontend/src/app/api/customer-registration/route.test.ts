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

// SEC-FE-AUTH-LOGIN-CSRF-001: this route issues the session cookie
// directly on a successful signup, but never checked Origin first. The
// handler now rejects a cross-origin mutation (via the shared
// isCrossOriginMutation() guard, lib/server/cross-origin-guard.ts) before
// ever forwarding to the backend or touching cookies.
describe("customer-registration CSRF boundary", () => {
  it("rejects a cross-origin customer-registration POST before forwarding credentials", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access: "qa-access-token",
        refresh: "qa-refresh-token",
        user: { username: "attacker@example.invalid", role: "parent" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/customer-registration/route");
    const response = await POST(
      new Request("https://besat.org/api/customer-registration", {
        method: "POST",
        headers: {
          Host: "besat.org",
          Origin: "https://evil.example",
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          full_name: "Attacker",
          email: "attacker@example.invalid",
          password: "ValidPassword123!",
          password_confirm: "ValidPassword123!",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
