import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, getApiErrorMessage, ApiError, normalizeEndpoint } from "@/lib/api/client";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

describe("apiRequest error messages", () => {
  it("surfaces DRF per-field validation errors instead of a generic fallback message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            short_description: ["برای انتشار محصول، توضیح کوتاه الزامی است."],
            description: ["برای انتشار محصول، توضیحات کامل الزامی است."],
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(apiRequest("cms/shop/products/1/publish/", { method: "POST" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.message.includes("توضیح کوتاه الزامی است") &&
        error.message.includes("توضیحات کامل الزامی است"),
    );
  });

  it("flattens nested per-field validation errors instead of showing raw JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            physical_detail: {
              sku: ["جزئیات کالای فیزیکی با این کد کالا (SKU) از قبل موجود است."],
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(apiRequest("cms/shop/products/1/", { method: "PATCH" })).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      expect(error.message).not.toContain("{");
      expect(error.message).toContain("از قبل موجود است");
      expect(error.fieldErrors.physical_detail).toEqual([
        "جزئیات کالای فیزیکی با این کد کالا (SKU) از قبل موجود است.",
      ]);
      return true;
    });
  });

  it("falls back to the generic message when the backend returns no detail or field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 400, headers: { "content-type": "application/json" } })),
    );

    await expect(apiRequest("widgets/", { method: "POST" })).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.message === "درخواست توسط بک‌اند پذیرفته نشد.",
    );
  });
});

// OPS-FE-SERVER-API-URL-RUNTIME-001: getApiBaseUrl()'s server branch
// resolves the backend origin independently of getBackendBaseUrl()
// (lib/server/backend-client.ts) -- a second, separate resolution path
// with no host validation at all, bypassing every check added there for
// OPS-FE-BACKEND-URL-RUNTIME-001.
describe("normalizeEndpoint server-side backend origin", () => {
  it.each([
    "http://127.0.0.1:8000/api",
    "http://169.254.169.254:8000/api",
    "https://attacker.example/api",
  ])("rejects an unvalidated runtime NEXT_SERVER_API_BASE_URL %j in production", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_SERVER_API_BASE_URL", value);
    vi.stubEnv("BESAT_BACKEND_API_URL", "http://backend:8000/api");
    vi.stubGlobal("window", undefined);

    expect(() => normalizeEndpoint("news/")).toThrow(/OPS-FE-SERVER-API-URL-RUNTIME-001/);
  });

  it("accepts the documented Compose service origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_SERVER_API_BASE_URL", "http://backend:8000/api");
    vi.stubGlobal("window", undefined);

    expect(normalizeEndpoint("news/")).toBe("http://backend:8000/api/news/");
  });

  it("does not apply the production host check outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_SERVER_API_BASE_URL", "http://127.0.0.1:8000/api");
    vi.stubGlobal("window", undefined);

    expect(() => normalizeEndpoint("news/")).not.toThrow();
  });
});

// OPS-FE-PUBLIC-API-BASE-001: NEXT_PUBLIC_API_BASE_URL is webpack-inlined
// into every browser bundle, so a runtime check here can't undo an
// already-poisoned build, but it does turn a silent off-origin API/
// invitation-token leak into a loud, consistent failure -- and since it's
// documented as a fixed same-origin path in every topology, unlike
// NEXT_SERVER_API_BASE_URL/BESAT_BACKEND_API_URL above there is no
// legitimate dev-only exception, so this is validated in every environment.
describe("normalizeEndpoint browser API base origin", () => {
  it.each(["https://collector.example/api", "//collector.example/api", "/\\collector.example/api"])(
    "rejects an off-origin NEXT_PUBLIC_API_BASE_URL %j",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", value);
      vi.stubGlobal("window", {});

      expect(() => normalizeEndpoint("auth/set-password/")).toThrow(/OPS-FE-PUBLIC-API-BASE-001/);
    },
  );

  it("keeps the documented same-origin BFF path when configured normally", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api/backend");
    vi.stubGlobal("window", {});

    expect(normalizeEndpoint("me/")).toBe("/api/backend/me/");
  });

  it("defaults to the same-origin BFF path when unset", () => {
    vi.stubGlobal("window", {});

    expect(normalizeEndpoint("me/")).toBe("/api/backend/me/");
  });

  // OPS-FE-PUBLIC-API-BASE-001-R1: an omitted Docker build ARG becomes an
  // empty string once assigned to ENV (`ARG X` + `ENV X=$X` with no
  // --build-arg resolves `$X` to "", not "unset") -- the actual state of
  // every build using frontend/Dockerfile today. Treating only `undefined`
  // as "use the default" broke every such build's browser bundle (an empty
  // string reached isSafeRelativePath("") -> false -> threw).
  it("defaults to the same-origin BFF path for an empty string (the value an omitted Docker ARG produces)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubGlobal("window", {});

    expect(normalizeEndpoint("me/")).toBe("/api/backend/me/");
  });
});

describe("getApiErrorMessage", () => {
  it("passes an ApiError's own message through unchanged", () => {
    const error = new ApiError({ message: "این نام کاربری قبلاً ثبت شده است.", status: 400 });
    expect(getApiErrorMessage(error)).toBe("این نام کاربری قبلاً ثبت شده است.");
  });

  it("maps a raw browser-native fetch failure to the generic Persian offline message", () => {
    // The exact shape `fetch` itself throws when it fails before any HTTP
    // response exists (offline, DNS failure, CORS, aborted connection).
    const error = new Error("Failed to fetch");
    expect(getApiErrorMessage(error)).toBe(
      "اتصال به بک‌اند برقرار نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.",
    );
  });

  it("preserves a deliberately Persian plain Error's own message instead of overwriting it", () => {
    // The exact shape performLogin (login-service.ts) throws after
    // inspecting a real 401 response itself, outside apiRequest/ApiError --
    // regressed once already (FE-LOGIN-INVALID-CREDENTIALS-MESSAGE-001)
    // when the generic-Error branch above was added without this check.
    const error = new Error("نام کاربری یا رمز عبور اشتباه است.");
    expect(getApiErrorMessage(error)).toBe("نام کاربری یا رمز عبور اشتباه است.");
  });
});
