import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/backend/[...path]/route";

const originalBackendApiUrl = process.env.BESAT_BACKEND_API_URL;
const originalTrustForwardedFor = process.env.BESAT_TRUST_FORWARDED_FOR;
const originalAnonymousThrottleSecret = process.env.BESAT_ANON_THROTTLE_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

afterEach(() => {
  if (originalBackendApiUrl === undefined) {
    delete process.env.BESAT_BACKEND_API_URL;
  } else {
    process.env.BESAT_BACKEND_API_URL = originalBackendApiUrl;
  }
  if (originalTrustForwardedFor === undefined) {
    delete process.env.BESAT_TRUST_FORWARDED_FOR;
  } else {
    process.env.BESAT_TRUST_FORWARDED_FOR = originalTrustForwardedFor;
  }
  if (originalAnonymousThrottleSecret === undefined) {
    delete process.env.BESAT_ANON_THROTTLE_SECRET;
  } else {
    process.env.BESAT_ANON_THROTTLE_SECRET = originalAnonymousThrottleSecret;
  }
  if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
  else mutableEnv.NODE_ENV = originalNodeEnv;
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

  it("gives the backend a signed per-browser identity and sets it once", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    process.env.BESAT_ANON_THROTTLE_SECRET = "test-throttle-secret";
    const fetchMock = vi.fn(async (...requestArgs: Parameters<typeof fetch>) => {
      void requestArgs;
      return Response.json({ units: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await GET(
      new Request("http://frontend:3000/api/backend/units/"),
      { params: Promise.resolve({ path: ["units"] }) },
    );
    const firstCookie = first.headers.get("set-cookie");
    expect(firstCookie).toMatch(/besat_anon_id=[0-9a-f-]+;/i);

    const [, firstInit] = fetchMock.mock.calls[0] ?? [];
    const firstIdentity = new Headers(firstInit?.headers).get("x-besat-anonymous-id");
    expect(firstIdentity).toMatch(/^[0-9a-f-]+\.[0-9a-f]{64}$/i);

    await GET(
      new Request("http://frontend:3000/api/backend/units/", {
        headers: { Cookie: firstCookie?.split(";")[0] ?? "" },
      }),
      { params: Promise.resolve({ path: ["units"] }) },
    );
    const [, secondInit] = fetchMock.mock.calls[1] ?? [];
    expect(new Headers(secondInit?.headers).get("x-besat-anonymous-id")).toBe(firstIdentity);
  });

  it("fails closed in production when the shared throttle secret is missing", async () => {
    mutableEnv.NODE_ENV = "production";
    delete process.env.BESAT_ANON_THROTTLE_SECRET;
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://besat.org/api/backend/units/"),
      { params: Promise.resolve({ path: ["units"] }) },
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ code: "backend_not_configured" });
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

  it("accepts a same-origin mutation when Next normalizes the request URL host", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async () => Response.json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost:3418/api/backend/messages/", {
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1:3418",
          Host: "127.0.0.1:3418",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["messages"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  // SEC-FE-BFF-XFP-TRUST-001: requestOrigin() must not honor a client-
  // supplied x-forwarded-proto unless this deployment has explicitly opted
  // in (BESAT_TRUST_FORWARDED_FOR=true, the same flag already gating
  // x-forwarded-for) -- otherwise a client could claim "https" over a
  // plain-http connection to make a genuinely cross-scheme mutation look
  // same-origin as a spoofed Origin header.
  it("rejects a spoofed x-forwarded-proto used to disguise a cross-scheme mutation as same-origin", async () => {
    delete process.env.BESAT_TRUST_FORWARDED_FOR;
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api";
    const fetchMock = vi.fn(async () => Response.json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { POST: freshPost } = await import("@/app/api/backend/[...path]/route");
    const response = await freshPost(
      new Request("http://127.0.0.1:3418/api/backend/cms/content/", {
        method: "POST",
        headers: {
          Host: "besat.org",
          Origin: "https://besat.org",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["cms", "content"] }) },
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors x-forwarded-proto only once BESAT_TRUST_FORWARDED_FOR opts in, for a deployment with a real TLS-terminating proxy", async () => {
    process.env.BESAT_TRUST_FORWARDED_FOR = "true";
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api";
    const fetchMock = vi.fn(async () => Response.json({ accepted: true }));
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { POST: freshPost } = await import("@/app/api/backend/[...path]/route");
    const response = await freshPost(
      new Request("http://127.0.0.1:3418/api/backend/cms/content/", {
        method: "POST",
        headers: {
          Host: "besat.org",
          Origin: "https://besat.org",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["cms", "content"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails clearly instead of silently falling back to mock mode without backend configuration", async () => {
    delete process.env.BESAT_BACKEND_API_URL;

    const response = await GET(
      new Request("http://frontend:3000/api/backend/units/"),
      { params: Promise.resolve({ path: ["units"] }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "backend_not_configured",
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// AUTH-FE-BFF-REFRESH-CONCURRENCY-001: two concurrent requests sharing the
// same expired access token both discover it's dead and both attempt to
// rotate the same single-use refresh token. This finding went through
// three earlier iterations of a "let every request independently call
// /auth/refresh/, then reconcile the cookie/retry decision afterward"
// design (a per-token rendezvous, then a longer-lived cache for a
// late-arriving straggler) -- all now removed. A FOURTH iteration reversed
// the acceptance contract entirely: Codex's newest probe
// (.agents/qa/frontend/bff-refresh-single-flight-current.test.ts) requires
// exactly ONE upstream /auth/refresh/ call for any number of concurrent
// requests sharing one token, not N independent calls reconciled after
// the fact. True single-flight (sharedRefreshAttempt() in route.ts) makes
// the whole "loser clears a sibling's successful rotation" class of bug
// structurally impossible rather than reconciling it after the fact --
// every concurrent caller for a given token IS the same call, not a
// separate one racing it, so there is no "loser" at all anymore.
//
// This also made the three prior REOPEN iterations' own permanent tests
// obsolete, not just their probes: their mocks assumed two DIFFERENT
// upstream calls would happen (one deliberately succeeding, one
// deliberately failing, coordinated via a barrier requiring both calls to
// have started) -- under genuine single-flight only one call ever happens,
// so those mocks' own barriers never resolve and the tests hang until
// Vitest's timeout kills them. Verified empirically before deciding this
// wasn't a fix defect: Codex's own new probe has an identical latent
// self-contradiction (its `waitFor(() => refreshCalls >= 2)` step, a
// leftover assumption from testing the prior non-deduped design, can never
// be satisfied by a correct single-flight fix -- confirmed by running the
// literal probe file, which times out at that exact line) -- correcting
// just that one line (`>= 2` to `>= 1`) makes the entire probe pass
// cleanly end to end, including its `refreshCalls === 1` and "both
// responses 200" assertions. The tests below replace the three
// now-obsolete ones with coverage for what single-flight actually
// guarantees.
describe("BFF concurrent expired-session recovery", () => {
  // Adapted from Codex's probe
  // .agents/qa/frontend/bff-refresh-single-flight-current.test.ts with one
  // line corrected per the empirical verification above (`waitFor(() =>
  // refreshCalls >= 2)` -> `>= 1`).
  it("shares one upstream refresh call across concurrent requests and lets both succeed", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const refreshRelease = deferred<void>();
    const refreshToken = "qa-single-flight-token";
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      if (url.endsWith("/me/")) {
        if (authorization === "Bearer stale-access") return new Response(null, { status: 401 });
        return Response.json({ username: "manager" });
      }
      if (url.endsWith("/auth/refresh/")) {
        refreshCalls += 1;
        await refreshRelease.promise;
        return Response.json({ access: "fresh-access", refresh: "fresh-refresh" });
      }
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const makeRequest = () => GET(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: `besat_access=stale-access; besat_refresh=${refreshToken}` },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    const first = makeRequest();
    const second = makeRequest();
    // Both requests are concurrent, sharing the same in-flight refresh
    // attempt -- wait for that one attempt to actually have started
    // (rather than an arbitrary fixed delay) before releasing it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    refreshRelease.resolve();
    const responses = await Promise.all([first, second]);

    expect(refreshCalls).toBe(1);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) =>
      (response.headers.getSetCookie?.() ?? []).some((value) => value.startsWith("besat_access=fresh-access;")),
    )).toBe(true);
  });

  it("shares one upstream refresh call across concurrent requests and clears cookies together when it is definitively rejected", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const refreshRelease = deferred<void>();
    const refreshToken = "qa-single-flight-rejected-token";
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      if (url.endsWith("/me/")) {
        if (authorization === "Bearer stale-access") return new Response(null, { status: 401 });
        throw new Error("unexpected authenticated /me/ call after a rejected refresh");
      }
      if (url.endsWith("/auth/refresh/")) {
        refreshCalls += 1;
        await refreshRelease.promise;
        return new Response(null, { status: 401 });
      }
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const makeRequest = () => GET(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: `besat_access=stale-access; besat_refresh=${refreshToken}` },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    const first = makeRequest();
    const second = makeRequest();
    await new Promise((resolve) => setTimeout(resolve, 0));
    refreshRelease.resolve();
    const responses = await Promise.all([first, second]);

    expect(refreshCalls).toBe(1);
    expect(responses.every((response) => response.status === 401)).toBe(true);
    expect(responses.every((response) =>
      (response.headers.getSetCookie?.() ?? []).some((value) => value.startsWith("besat_access=;")),
    )).toBe(true);
  });
});

// AUTH-FE-BFF-REFRESH-CONCURRENCY-001 (continued): each test below resets
// the module registry and dynamically imports a fresh `route.ts` instance
// first, so its module-scoped rotationRendezvous/recentSuccessfulRotations
// maps start empty -- necessary here because all three tests reuse the
// same literal stale-refresh-token fixture value, and without isolation a
// successful rotation recorded by one test's mock would still be sitting
// in the long-lived cache (well within its TTL) when a later, unrelated
// test in this same file checks it.
describe("BFF refresh single-flight adjacent and late-stale scenarios", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function makeRequestWith(get: typeof import("@/app/api/backend/[...path]/route").GET, token = "refresh-token") {
    return get(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: `besat_access=stale-access; besat_refresh=${token}` },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );
  }

  // Single-flight replacement for the now-obsolete three-request-burst
  // test (see the describe block above for the full REOPENED-4-times
  // history): three concurrent requests sharing one stale token now share
  // the exact same in-flight refresh attempt, so there is only ever one
  // outcome for all three to observe -- not a winner and two losers to
  // reconcile after the fact.
  it("shares one upstream refresh call across a three-request burst and lets all three succeed", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const refreshRelease = deferred<void>();
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      if (url.endsWith("/me/")) {
        if (authorization === "Bearer stale-access") return new Response(null, { status: 401 });
        return Response.json({ username: "manager" });
      }
      if (url.endsWith("/auth/refresh/")) {
        refreshCalls += 1;
        await refreshRelease.promise;
        return Response.json({ access: "fresh-access", refresh: "fresh-refresh" });
      }
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET: get } = await import("@/app/api/backend/[...path]/route");
    const requests = [makeRequestWith(get), makeRequestWith(get), makeRequestWith(get)];
    await new Promise((resolve) => setTimeout(resolve, 0));
    refreshRelease.resolve();
    const responses = await Promise.all(requests);

    expect(refreshCalls).toBe(1);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) =>
      (response.headers.getSetCookie?.() ?? []).some((value) => value.startsWith("besat_access=fresh-access;")),
    )).toBe(true);
  });
  // Adapted verbatim from Codex's probe
  // .agents/qa/frontend/bff-refresh-concurrency-adjacent.test.ts (second
  // case): a single, genuinely unraced failed refresh must still clear
  // cookies exactly as before -- neither single-flight sharing nor the
  // longer-lived cache should ever cause a real dead session to be kept
  // alive.
  it("still clears a genuinely sole failed refresh", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      if (url.endsWith("/me/") && authorization === "Bearer stale-access") {
        return new Response(null, { status: 401 });
      }
      if (url.endsWith("/auth/refresh/")) return new Response(null, { status: 401 });
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET: get } = await import("@/app/api/backend/[...path]/route");
    const response = await makeRequestWith(get);
    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(response.status).toBe(401);
    expect(cookies.filter((value) => value.startsWith("besat_access=;")).length).toBe(1);
    expect(cookies.filter((value) => value.startsWith("besat_refresh=;")).length).toBe(1);
  });

  // Adapted verbatim from Codex's REOPENED probe
  // .agents/qa/frontend/bff-refresh-concurrency-late-stale.test.ts: the
  // winner's own shared refresh attempt has already settled and been
  // removed from inFlightRefreshes, but its replay of the original
  // backend call is still in flight -- a late request presenting the
  // same now-superseded stale cookie must still be protected from a
  // destructive clear, via the longer-lived recentSuccessfulRotations
  // cache rather than a still-shared in-flight attempt (there no longer
  // is one by this point).
  it("does not clear a still-valid session while the winner's replay response is pending", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const replayResponse = deferred<Response>();
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");

      if (url.endsWith("/auth/refresh/")) {
        refreshCalls += 1;
        return refreshCalls === 1
          ? Response.json({ access: "fresh-access", refresh: "fresh-refresh" })
          : new Response(null, { status: 401 });
      }
      if (url.endsWith("/me/")) {
        if (authorization === "Bearer stale-access") return new Response(null, { status: 401 });
        if (authorization === "Bearer fresh-access") return replayResponse.promise;
      }
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET: get } = await import("@/app/api/backend/[...path]/route");

    async function waitFor(predicate: () => boolean) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error("timed out waiting for the mocked upstream request");
    }

    const winnerPromise = makeRequestWith(get);
    await waitFor(() => fetchMock.mock.calls.some(([input, init]) =>
      String(input).endsWith("/me/") && new Headers(init?.headers).get("authorization") === "Bearer fresh-access"));

    // The winner's shared refresh attempt has already settled, but its
    // replay response is still in flight. A browser request made before the
    // winner's Set-Cookie reaches the jar can still present the stale
    // refresh token.
    const lateStaleResponse = await makeRequestWith(get);
    expect(refreshCalls).toBe(2);
    expect(lateStaleResponse.status).toBe(401);
    expect((lateStaleResponse.headers.getSetCookie?.() ?? [])
      .some((value) => value.startsWith("besat_access=;"))).toBe(false);

    replayResponse.resolve(Response.json({ username: "manager" }));
    const winnerResponse = await winnerPromise;
    expect(winnerResponse.status).toBe(200);
    expect((winnerResponse.headers.getSetCookie?.() ?? [])
      .some((value) => value.startsWith("besat_access=fresh-access;"))).toBe(true);
  });

  // Adapted verbatim from Codex's probe
  // .agents/qa/frontend/bff-refresh-transient-failure.test.ts.
  //
  // AUTH-FE-BFF-REFRESH-TRANSIENT-CLEAR-001: readRefreshPayload() used to
  // collapse every non-token refresh response into the same plain outcome
  // regardless of *why* it failed -- a definitive "this refresh token is
  // invalid/expired" rejection (SimpleJWT's TokenRefreshView -> 401) looked
  // identical, at this call site, to a transient outage (a 503, a 500, a
  // malformed body from a proxy error page) that says nothing about
  // whether the token is actually still good. Only a 401 from
  // /auth/refresh/ is now ever treated as proof the token is invalid;
  // anything else falls through with cookies untouched.
  it("does not delete a session when refresh is temporarily unavailable", async () => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");

      if (url.endsWith("/me/")) {
        expect(authorization).toBe("Bearer stale-access");
        return new Response(null, { status: 401 });
      }

      if (url.endsWith("/auth/refresh/")) {
        return Response.json(
          { detail: "upstream temporarily unavailable" },
          { status: 503 },
        );
      }

      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET: get } = await import("@/app/api/backend/[...path]/route");
    const response = await get(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: {
          Cookie: "besat_access=stale-access; besat_refresh=still-valid-refresh",
        },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );

    const setCookies = response.headers.getSetCookie?.() ?? [];
    expect(response.status).toBe(401);
    expect(setCookies.some((value) => value.startsWith("besat_access=;"))).toBe(false);
    expect(setCookies.some((value) => value.startsWith("besat_refresh=;"))).toBe(false);
    expect(setCookies.some((value) => value.startsWith("besat_has_session=;"))).toBe(false);
  });

  // Adapted verbatim from Codex's probe
  // .agents/qa/frontend/bff-refresh-empty-token-current.test.ts.
  //
  // AUTH-FE-BFF-REFRESH-EMPTY-TOKENS-001: a mere `typeof value === "string"`
  // check accepted an empty string or a whitespace-only one just as
  // readily as a real token -- a malformed/misbehaving upstream 200
  // response shaped this way looked exactly like a successful rotation,
  // triggering a blank-Bearer replay of the original request and writing
  // blank tokens into the session cookies. isNonEmptyToken() now rejects
  // both.
  it.each([
    ["empty", { access: "", refresh: "" }],
    ["whitespace", { access: "   ", refresh: "\t" }],
  ])("does not treat %s token strings as a successful rotation", async (_label, body) => {
    process.env.BESAT_BACKEND_API_URL = "http://backend:8000/api/";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/me/")) {
        const authorization = new Headers(init?.headers).get("authorization");
        if (authorization === "Bearer fresh-access") return Response.json({ ok: true });
        return new Response(null, { status: 401 });
      }
      if (url.endsWith("/auth/refresh/")) {
        return Response.json(body, { status: 200 });
      }
      throw new Error(`unexpected upstream request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET: get } = await import("@/app/api/backend/[...path]/route");
    const response = await get(
      new Request("http://frontend:3000/api/backend/me/", {
        headers: { Cookie: "besat_access=stale-access; besat_refresh=empty-token-case" },
      }),
      { params: Promise.resolve({ path: ["me"] }) },
    );
    const setCookies = response.headers.getSetCookie?.() ?? [];

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setCookies.some((value) => value.startsWith("besat_access="))).toBe(false);
    expect(setCookies.some((value) => value.startsWith("besat_refresh="))).toBe(false);
    expect(setCookies.some((value) => value.startsWith("besat_has_session="))).toBe(false);
  });
});
