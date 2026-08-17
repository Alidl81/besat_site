import {
  BackendConfigurationError,
  requestBackend,
} from "@/lib/server/backend-client";
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

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host")?.trim();

  if (!host) {
    return url.origin;
  }

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = forwardedProtocol || url.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function isCrossOriginMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== requestOrigin(request);
}

async function readRefreshPayload(response: Response) {
  try {
    const payload = (await response.json()) as {
      access?: unknown;
      refresh?: unknown;
    };
    return typeof payload.access === "string" && typeof payload.refresh === "string"
      ? { access: payload.access, refresh: payload.refresh }
      : null;
  } catch {
    return null;
  }
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
      const refreshResponse = await requestBackend({
        requestUrl: request.url,
        path: ["auth", "refresh"],
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ refresh }),
        requestId,
        inboundHost,
      });
      refreshedTokens = await readRefreshPayload(refreshResponse);

      if (refreshedTokens) {
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
      } else {
        clearCookies = true;
      }
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
