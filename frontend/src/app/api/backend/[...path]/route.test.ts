import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/backend/[...path]/route";

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
        expect(new Headers(init?.headers).get("cookie")).toBe(
          "sessionid=test-session",
        );
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
});
