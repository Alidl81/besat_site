import { handleMockApiRequest } from "@/lib/mock-api/handler";

const DEFAULT_BACKEND_API_URL = "mock://local";
const UPSTREAM_TIMEOUT_MS = 30_000;

const REQUEST_HEADERS_TO_REMOVE = [
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
];

const RESPONSE_HEADERS_TO_REMOVE = [
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-connection",
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

function getBackendBaseUrl() {
  const configuredUrl =
    process.env.BESAT_BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL;
  const backendUrl = new URL(configuredUrl);

  if (!["http:", "https:"].includes(backendUrl.protocol)) {
    throw new Error("Unsupported backend protocol");
  }

  backendUrl.hash = "";
  backendUrl.search = "";
  backendUrl.pathname = `${backendUrl.pathname.replace(/\/+$/, "")}/`;
  return backendUrl;
}

function createUpstreamUrl(request: Request, path: string[]) {
  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        segment === "." || segment === ".." || segment.includes("\0"),
    )
  ) {
    throw new Error("Invalid backend path");
  }

  const frontendUrl = new URL(request.url);
  const upstreamUrl = getBackendBaseUrl();
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");

  upstreamUrl.pathname = `${upstreamUrl.pathname}${encodedPath}/`;
  upstreamUrl.search = frontendUrl.search;
  return upstreamUrl;
}

function createUpstreamHeaders(request: Request, requestId: string) {
  const headers = new Headers(request.headers);

  for (const header of REQUEST_HEADERS_TO_REMOVE) {
    headers.delete(header);
  }

  const frontendUrl = new URL(request.url);
  headers.set("accept-encoding", "identity");
  headers.set("x-request-id", requestId);
  headers.set("x-forwarded-host", frontendUrl.host);
  headers.set("x-forwarded-proto", frontendUrl.protocol.replace(":", ""));
  return headers;
}

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

async function forwardToBackend(
  request: Request,
  { params }: BackendRouteContext,
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const { path } = await params;
    const configuredUrl =
      process.env.BESAT_BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL;

    if (configuredUrl === "mock://local") {
      const mockRequest =
        request.method === "HEAD"
          ? new Request(request.url, {
              method: "GET",
              headers: request.headers,
            })
          : request;
      const mockResponse = await handleMockApiRequest(mockRequest, path);

      if (request.method === "HEAD") {
        return new Response(null, {
          status: mockResponse.status,
          statusText: mockResponse.statusText,
          headers: mockResponse.headers,
        });
      }

      return mockResponse;
    }

    const upstreamUrl = createUpstreamUrl(request, path);
    const init: RequestInit = {
      method: request.method,
      headers: createUpstreamHeaders(request, requestId),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      ]),
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) {
        init.body = body;
      }
    }

    const upstreamResponse = await fetch(upstreamUrl, init);
    const responseHeaders = createClientHeaders(upstreamResponse);

    if (!responseHeaders.has("x-request-id")) {
      responseHeaders.set("x-request-id", requestId);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (reason) {
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
