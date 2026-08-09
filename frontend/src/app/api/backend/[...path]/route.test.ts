import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/backend/[...path]/route";

const originalBackendApiUrl = process.env.BESAT_BACKEND_API_URL;

afterEach(() => {
  if (originalBackendApiUrl === undefined) {
    delete process.env.BESAT_BACKEND_API_URL;
  } else {
    process.env.BESAT_BACKEND_API_URL = originalBackendApiUrl;
  }
  vi.unstubAllGlobals();
});

describe("backend API proxy route normalization", () => {
  it.each([
    ["dashboard context", "dashboard/context"],
    ["general manager dashboard", "dashboard/general-manager"],
  ])(
    "sends slash and non-slash %s requests to the canonical Django route",
    async (_label, path) => {
      process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api";
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          void init;
          return Response.json({ upstream: String(input) });
        },
      );
      vi.stubGlobal("fetch", fetchMock);

      for (const suffix of ["", "/"]) {
        const request = new Request(
          `http://frontend:3000/api/backend/${path}${suffix}?unit=7`,
          {
            headers: {
              Authorization: "Bearer test-access-token",
              Cookie: "sessionid=test-session",
            },
          },
        );
        const response = await GET(request, {
          params: Promise.resolve({ path: path.split("/") }),
        });

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenLastCalledWith(
          new URL(`http://backend:8000/api/${path}/?unit=7`),
          expect.objectContaining({
            redirect: "manual",
            headers: expect.any(Headers),
          }),
        );
        const [, init] = fetchMock.mock.lastCall ?? [];
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer test-access-token",
        );
        expect(new Headers(init?.headers).get("cookie")).toBeNull();
      }
    },
  );

  it("preserves the already-working current-user route", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async () => Response.json({ username: "manager" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://frontend:3000/api/backend/me/"),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://backend:8000/api/me/"),
      expect.any(Object),
    );
  });

  it("uses the HttpOnly access cookie internally without forwarding browser cookies", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async (...requestArgs: Parameters<typeof fetch>) => {
      void requestArgs;
      return Response.json({ username: "manager" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: "besat_access=server-only-token; theme=light" },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.lastCall ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer server-only-token");
    expect(headers.get("cookie")).toBeNull();
  });

  it("refreshes an expired server-side session once and rotates only HttpOnly cookies", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const authorization = new Headers(init?.headers).get("authorization");
        if (url.endsWith("/auth/refresh/")) {
          expect(authorization).toBeNull();
          return Response.json({ access: "fresh-access", refresh: "fresh-refresh" });
        }
        if (authorization === "Bearer stale-access") return new Response(null, { status: 401 });
        expect(authorization).toBe("Bearer fresh-access");
        return Response.json({ username: "manager" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: "besat_access=stale-access; besat_refresh=refresh-token" },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.headers.get("set-cookie")).toContain("besat_access=fresh-access");
    expect(response.headers.get("set-cookie")).toContain("besat_refresh=fresh-refresh");
  });

  it("rejects cross-origin state-changing proxy requests before they reach the backend", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://frontend:3000/api/backend/cms/content/", {
        method: "POST",
        headers: { Origin: "https://untrusted.example", "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["cms", "content"] }) },
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
