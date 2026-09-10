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
  vi.resetModules();
});

async function invoke(
  routeName: "session" | "customer-registration",
  access: string,
  refresh: string,
) {
  const expectedPath = routeName === "session" ? "/auth/login/" : "/auth/register/";
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith(expectedPath)) {
      throw new Error(`unexpected upstream request: ${url}`);
    }
    return Response.json({
      access,
      refresh,
      user: { id: "qa-user", role: "parent" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  vi.resetModules();
  const handler = routeName === "session"
    ? (await import("@/app/api/session/route")).POST
    : (await import("@/app/api/customer-registration/route")).POST;
  const request = routeName === "session"
    ? new Request("https://besat.org/api/session", {
        method: "POST",
        headers: { Host: "besat.org", "Content-Type": "application/json" },
        body: JSON.stringify({ username: "qa-parent", password: "ValidPassword123!" }),
      })
    : new Request("https://besat.org/api/customer-registration", {
        method: "POST",
        headers: { Host: "besat.org", "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "QA Parent",
          email: "qa-parent@example.invalid",
          password: "ValidPassword123!",
          password_confirm: "ValidPassword123!",
        }),
      });
  const response = await handler(request);
  return { response, fetchMock };
}

// AUTH-FE-SESSION-EMPTY-TOKENS-001: a mere typeof check accepted an empty
// or whitespace-only string just as readily as a real token -- login and
// customer-registration both accepted a malformed upstream 200 body shaped
// this way, returned 200, and issued nonzero-lifetime session cookies with
// a blank value. isNonEmptyToken() (shared with the BFF refresh path, see
// lib/server/token-validation.ts) now rejects both, surfacing a clear 502
// instead of a silently-broken session.
describe("session cookie issuance rejects unusable token payloads", () => {
  it.each([
    ["login", "", "", "session"],
    ["login", "   ", "\t", "session"],
    ["registration", "", "", "customer-registration"],
    ["registration", "   ", "\t", "customer-registration"],
  ] as const)(
    "returns a server error and does not set blank %s tokens (%s)",
    async (_label, access, refresh, routeName) => {
      const { response, fetchMock } = await invoke(routeName, access, refresh);
      const setCookies = response.headers.getSetCookie?.() ?? [];
      expect(response.status).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(setCookies.some((value) => value.startsWith("besat_access="))).toBe(false);
      expect(setCookies.some((value) => value.startsWith("besat_refresh="))).toBe(false);
      expect(setCookies.some((value) => value.startsWith("besat_has_session="))).toBe(false);
    },
  );
});
