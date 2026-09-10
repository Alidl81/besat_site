import {
  BackendConfigurationError,
  requestBackend,
} from "@/lib/server/backend-client";
import { isCrossOriginMutation } from "@/lib/server/cross-origin-guard";
import { isNonEmptyToken } from "@/lib/server/token-validation";
import {
  appendSessionCookies,
  clearSessionCookies,
  readCookie,
  sessionCookieNames,
} from "@/lib/server/session-cookies";

const RESPONSE_HEADERS_TO_REMOVE = [
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-connection",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

type BackendRouteContext = {
  params: Promise<{ path: string[] }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createClientHeaders(upstreamResponse: Response) {
  const headers = new Headers(upstreamResponse.headers);

  for (const header of RESPONSE_HEADERS_TO_REMOVE) {
    headers.delete(header);
  }

  return headers;
}

function createProxyError(requestId: string, status = 502) {
  return Response.json(
    {
      detail: "ارتباط فرانت با endpoint بک‌اند برقرار نشد.",
      code: "upstream_unavailable",
      request_id: requestId,
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

function createConfigurationError(requestId: string) {
  return Response.json(
    {
      detail: "پیکربندی سرویس پشتیبان کامل نیست. لطفاً با مدیر سامانه تماس بگیرید.",
      code: "backend_not_configured",
      request_id: requestId,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}

// SEC-FE-AUTH-LOGIN-CSRF-001: isCrossOriginMutation() moved to
// @/lib/server/cross-origin-guard so /api/session and
// /api/customer-registration -- the two other routes that also issue/clear
// the session cookie directly -- can enforce the identical origin policy
// instead of each re-deriving their own copy. See that module for the
// full rationale (including SEC-FE-BFF-XFP-TRUST-001's forwarded-proto
// trust gating).

// AUTH-FE-BFF-REFRESH-CONCURRENCY-001: two concurrent requests sharing the
// same expired access token both independently discover it's dead and both
// attempt to rotate the same (single-use) refresh token. The backend can
// only honor one of those rotations -- the other necessarily gets a 401
// from /auth/refresh/, indistinguishable at this layer from a genuinely
// dead session. Naively treating that failure as "log the user out" clears
// the very session cookies a sibling request just successfully rotated (or
// is still in the middle of rotating), destroying a valid session out from
// under the user.
//
// REOPENED: an earlier version of this fix only recorded a successful
// rotation in a cache *after* it completed -- correct when the winning
// sibling happens to finish before the losing one's own attempt fails, but
// an adjacent probe demonstrated the opposite, equally valid completion
// order: the loser's 401 can land while the winner's request is still
// in flight, at which point no success has been recorded anywhere yet, so
// the loser concluded (wrongly) that the session was genuinely dead.
//
// The fix is a per-token rendezvous rather than a cache: `joinRotationRendezvous`
// registers this attempt (incrementing a pending count) *before* this
// request's own refresh call goes out; `leaveRotationRendezvous` records
// this attempt's own outcome when it settles. Critically, a losing request
// never *awaits* a still-pending sibling (that would serialize concurrent
// requests behind whichever one happens to be slowest, and deadlocks this
// exact test, which holds the winner's response open indefinitely before
// checking the loser's) -- it only ever makes a synchronous decision from
// the registry's *current* state at the instant its own attempt finishes:
// adopt a sibling's already-recorded success if one exists yet; otherwise,
// if any sibling is still outstanding, treat the outcome as genuinely
// unknown (skip clearing, but don't fabricate a success either -- the
// original request's own 401 response is returned untouched, with no
// session cookie mutated either way); only clear cookies once this was
// truly the last outstanding attempt for this token and none of them ever
// succeeded. This is a best-effort mitigation correct only within a single
// warm Node.js process/instance, not a substitute for the backend's own
// single-use rotation invariant, which remains the authoritative defense.
// REOPENED again (4th iteration): Codex's acceptance contract changed from
// "every concurrent request may independently call /auth/refresh/, just
// coordinate the cookie/retry decision afterward" (the rendezvous design
// above) to requiring genuine single-flight: exactly ONE upstream
// /auth/refresh/ call for any number of concurrent requests sharing the
// same stale token, all of them sharing that one call's outcome directly,
// rather than each making their own call and reconciling results after
// the fact. inFlightRefreshes replaces the whole rendezvous
// (pending-count/succeeded bookkeeping is no longer needed at all once
// every concurrent caller for a given token is *the same call*, not N
// separate ones racing each other) -- the first caller for a given stale
// token creates and registers the shared promise; every other concurrent
// caller for that same token finds it already registered and awaits that
// exact promise instead of issuing its own request. The entry is removed
// once the call settles, so a later, non-concurrent request for the same
// (now already-rotated) token correctly makes its own fresh attempt
// rather than replaying a stale result forever.
type RotationOutcome = { access: string; refresh: string } | null;
type RefreshAttemptResult = { tokens: RotationOutcome; definitivelyRejected: boolean };

const inFlightRefreshes = new Map<string, Promise<RefreshAttemptResult>>();

function sharedRefreshAttempt(
  staleRefreshToken: string,
  perform: () => Promise<RefreshAttemptResult>,
): Promise<RefreshAttemptResult> {
  const existing = inFlightRefreshes.get(staleRefreshToken);
  if (existing) return existing;

  const attempt = perform().finally(() => {
    inFlightRefreshes.delete(staleRefreshToken);
  });
  inFlightRefreshes.set(staleRefreshToken, attempt);
  return attempt;
}

// REOPENED again: the rendezvous above closes (and its entry is deleted)
// the moment the *winning* request's own refresh call settles -- but that
// request still has to replay its original backend call with the new
// access token before its HTTP response (carrying the fresh Set-Cookie
// headers) ever reaches the browser. A later request -- one that arrives
// *after* the shared in-flight refresh above has already settled and been
// removed from inFlightRefreshes -- can arrive in that window still
// presenting the *old* stale cookie (the browser hasn't applied the new
// one yet, because it hasn't received that response yet). It has no
// shared attempt to join anymore, so it makes its own fresh call, which
// necessarily fails (the token was already consumed) -- concluding,
// wrongly, that the session is dead. This longer-lived cache retains a
// successful rotation's outcome for a short window after the shared
// attempt itself has already been cleaned up, specifically for this
// late-straggler case. Deliberately narrower than sharing the in-flight
// attempt directly: a late straggler that finds a stale-but-recent
// success here does NOT retry using those tokens -- it only skips
// clearing, returning its own original 401 untouched. This path can no
// longer see whether it was really racing the original rotation or is an
// unrelated later request that happens to still hold a stale cookie for
// other reasons, so it stays conservative rather than fabricating success.
const RECENT_ROTATION_TTL_MS = 30_000;
const recentSuccessfulRotations = new Map<string, RotationOutcome>();

function rememberRecentRotation(staleRefreshToken: string, outcome: RotationOutcome) {
  if (!outcome) return;
  recentSuccessfulRotations.set(staleRefreshToken, outcome);
  const timer = setTimeout(() => {
    recentSuccessfulRotations.delete(staleRefreshToken);
  }, RECENT_ROTATION_TTL_MS);
  timer.unref?.();
}

// AUTH-FE-BFF-REFRESH-TRANSIENT-CLEAR-001: readRefreshPayload() used to
// collapse every non-token response into the same plain `null` outcome,
// regardless of *why* it failed -- a definitive "this refresh token is
// invalid/expired" rejection from the backend (SimpleJWT's TokenRefreshView
// raises InvalidToken, which maps to 401) looks identical, at this
// call site, to a transient outage (a 503, a 500, a malformed body from a
// proxy/load-balancer error page) that says nothing at all about whether
// the token is actually still good. Treating both as "the session is
// dead" meant a momentary backend hiccup during refresh destructively
// logged the user out, when the correct response is to leave the session
// alone and let the client retry once the backend recovers. Only a 401
// -- SimpleJWT's own definitive rejection status -- is ever treated as
// proof the token is actually invalid.
//
// AUTH-FE-BFF-REFRESH-EMPTY-TOKENS-001: a mere `typeof value === "string"`
// check accepts an empty string or a whitespace-only one just as readily
// as a real token -- a malformed/misbehaving upstream 200 response shaped
// this way used to look exactly like a successful rotation, triggering a
// blank-`Bearer` replay of the original request and writing blank tokens
// into the session cookies. isNonEmptyToken() (shared with the two
// cookie-issuing routes, see that module) rejects both.
async function readRefreshPayload(response: Response) {
  let tokens: { access: string; refresh: string } | null = null;
  try {
    const payload = (await response.json()) as {
      access?: unknown;
      refresh?: unknown;
    };
    if (isNonEmptyToken(payload.access) && isNonEmptyToken(payload.refresh)) {
      tokens = { access: payload.access, refresh: payload.refresh };
    }
  } catch {
    tokens = null;
  }
  return { tokens, definitivelyRejected: !tokens && response.status === 401 };
}

async function forwardToBackend(
  request: Request,
  { params }: BackendRouteContext,
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (isCrossOriginMutation(request)) {
    return Response.json(
      {
        detail: "درخواست از مبدأ نامعتبر پذیرفته نشد.",
        code: "invalid_origin",
        request_id: requestId,
      },
      { status: 403, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }

  try {
    const { path } = await params;
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? null
        : await request.arrayBuffer();
    const explicitAuthorization = request.headers.has("authorization");
    const access = explicitAuthorization
      ? null
      : readCookie(request.headers.get("cookie"), sessionCookieNames.access);
    const refresh = explicitAuthorization
      ? null
      : readCookie(request.headers.get("cookie"), sessionCookieNames.refresh);

    const inboundHost = request.headers.get("host");

    let upstreamResponse = await requestBackend({
      requestUrl: request.url,
      path,
      method: request.method,
      headers: request.headers,
      body,
      requestId,
      accessToken: access,
      inboundHost,
    });
    let refreshedTokens: { access: string; refresh: string } | null = null;
    let clearCookies = false;

    if (upstreamResponse.status === 401 && refresh && !explicitAuthorization) {
      const { tokens, definitivelyRejected } = await sharedRefreshAttempt(refresh, async () => {
        const refreshResponse = await requestBackend({
          requestUrl: request.url,
          path: ["auth", "refresh"],
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ refresh }),
          requestId,
          inboundHost,
        });
        return readRefreshPayload(refreshResponse);
      });
      refreshedTokens = tokens;

      if (refreshedTokens) {
        rememberRecentRotation(refresh, refreshedTokens);
        upstreamResponse = await requestBackend({
          requestUrl: request.url,
          path,
          method: request.method,
          headers: request.headers,
          body,
          requestId,
          accessToken: refreshedTokens.access,
          inboundHost,
        });
      } else if (recentSuccessfulRotations.has(refresh)) {
        // No shared in-flight attempt was available to join (this request
        // arrived after the last one for this exact token already
        // settled and was cleaned up), and this request's own fresh
        // attempt then failed -- the token was already consumed. But a
        // successful rotation for this exact token was recorded recently,
        // meaning this really is the late-straggler case: a browser
        // request made before the previous rotation's Set-Cookie reached
        // the jar. Skip clearing (the session is not actually dead), but
        // do not adopt those tokens for a retry either -- this path can no
        // longer tell whether it was really racing that rotation or is an
        // unrelated later request that happens to still carry a stale
        // cookie for some other reason, so it stays conservative and
        // simply returns its own original 401 untouched.
      } else if (definitivelyRejected) {
        // The backend explicitly rejected this token (401 from
        // /auth/refresh/ -- SimpleJWT's own definitive "invalid/expired
        // token" status) rather than merely failing to respond with fresh
        // tokens, and no recent rotation explains it away -- the session
        // really is dead.
        clearCookies = true;
      }
      // AUTH-FE-BFF-REFRESH-TRANSIENT-CLEAR-001: if none of the above
      // branches matched (no recent rotation explains the failure, and the
      // refresh call itself failed with anything other than a definitive
      // 401 -- a 503, a 500, a network-level failure, a malformed body),
      // the outcome is genuinely unknown: the refresh endpoint said
      // nothing that actually proves this token is invalid, only that it
      // couldn't be reached or didn't answer usefully right now. Leaving
      // `clearCookies` false here (falling through with no branch taken)
      // returns the original 401 untouched -- a transient backend hiccup
      // during refresh must never destructively log the user out; the
      // client can simply retry once it recovers.
    }

    const responseHeaders = createClientHeaders(upstreamResponse);
    responseHeaders.set("cache-control", "no-store");
    if (!responseHeaders.has("x-request-id")) {
      responseHeaders.set("x-request-id", requestId);
    }
    if (refreshedTokens) appendSessionCookies(responseHeaders, refreshedTokens);
    if (clearCookies) clearSessionCookies(responseHeaders);

    if (request.method === "HEAD") {
      return new Response(null, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (reason) {
    if (reason instanceof BackendConfigurationError) {
      console.error("[besat-backend-proxy]", requestId, reason.message);
      return createConfigurationError(requestId);
    }
    console.error("[besat-backend-proxy]", requestId, reason);
    return createProxyError(requestId);
  }
}

export {
  forwardToBackend as DELETE,
  forwardToBackend as GET,
  forwardToBackend as HEAD,
  forwardToBackend as OPTIONS,
  forwardToBackend as PATCH,
  forwardToBackend as POST,
  forwardToBackend as PUT,
};
