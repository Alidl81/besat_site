import { afterEach, describe, expect, it, vi } from "vitest";

import { getBackendBaseUrl, requestBackend } from "@/lib/server/backend-client";

vi.mock("@/lib/mock-api/handler", () => ({
  handleMockApiRequest: vi.fn().mockResolvedValue(Response.json({ mode: "mock" })),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// OPS-FE-BACKEND-URL-RUNTIME-001: getBackendBaseUrl() only checked the URL
// scheme -- a loopback, RFC1918/private, link-local, metadata, or
// malformed runtime BESAT_BACKEND_API_URL sailed straight through and
// requestBackend() would send every BFF request there. The Docker build-
// time validator only protects the build ARG, not this runtime resolver.
describe("production runtime backend-origin fail-closed contract", () => {
  it.each([
    "http://localhost:8000/api",
    "http://127.0.0.1:8000/api",
    "http://10.0.0.5:8000/api",
    "http://169.254.169.254:8000/api",
    "http://[::1]:8000/api",
    "http://backend..internal:8000/api",
  ])("rejects unsafe runtime BESAT_BACKEND_API_URL %j before upstream use", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BESAT_BACKEND_API_URL", value);

    expect(() => getBackendBaseUrl()).toThrow(/OPS-FE-BACKEND-URL-RUNTIME-001/);
  });

  it("accepts the documented Compose service origin and normalizes its path", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BESAT_BACKEND_API_URL", "http://backend:8000/api");

    expect(getBackendBaseUrl().toString()).toBe("http://backend:8000/api/");
  });

  it("does not apply the production host check outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BESAT_BACKEND_API_URL", "http://127.0.0.1:8000/api");

    expect(() => getBackendBaseUrl()).not.toThrow();
  });

  // OPS-FE-BACKEND-URL-RUNTIME-001 (reopened, residual): the network-class
  // checks above reject loopback/private/metadata/malformed, but an
  // arbitrary *other* public host (attacker-controlled or simply
  // unapproved) and a URL carrying embedded credentials both sailed
  // through untouched -- neither is loopback/private/metadata/malformed.
  it.each([
    "https://attacker.example/api",
    "http://public-unapproved.example:8080/api",
    "https://user:pass@attacker.example/api",
  ])("rejects an unapproved or credentialed runtime BESAT_BACKEND_API_URL %j", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BESAT_BACKEND_API_URL", value);

    expect(() => getBackendBaseUrl()).toThrow(/OPS-FE-BACKEND-URL-RUNTIME-001/);
  });

  // OPS-FE-BACKEND-URL-RUNTIME-001 (reopened, residual): mock mode is
  // documented as test/dev-only, and the Docker build-time validator
  // already rejects it in the build ARG -- but a *runtime* override to
  // mock://local bypassed that build-time-only check entirely and served
  // fabricated mock responses as if they were the real backend.
  it("rejects a runtime mock://local override in production instead of serving mock responses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BESAT_BACKEND_API_URL", "mock://local");

    const response = await requestBackend({
      requestUrl: "https://besat.org/api/backend/mock/status",
      path: ["mock", "status"],
      method: "GET",
      requestId: "test-runtime-mock-bypass",
      headers: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "backend_not_configured" });
  });

  it("still serves mock mode outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BESAT_BACKEND_API_URL", "mock://local");

    const response = await requestBackend({
      requestUrl: "https://besat.org/api/backend/mock/status",
      path: ["mock", "status"],
      method: "GET",
      requestId: "test-mock-still-works",
      headers: {},
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "mock" });
  });

  // OPS-FE-BACKEND-URL-RUNTIME-001: the production host check now lives in
  // getBackendBaseUrl(), called from createUpstreamUrl() -- requestBackend()
  // must actually reach a caught BackendConfigurationError there and return
  // the standard 503 without ever calling fetch(), not let it propagate as
  // an uncaught exception.
  it("returns the configuration 503 before fetch for an unsafe runtime host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BESAT_BACKEND_API_URL", "http://127.0.0.1:8000/api");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await requestBackend({
      requestUrl: "https://besat.org/api/backend/news",
      path: ["news"],
      method: "GET",
      requestId: "test-runtime-origin-request",
      headers: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "backend_not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
