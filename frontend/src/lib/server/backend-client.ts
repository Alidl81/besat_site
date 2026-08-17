import "server-only";

import { handleMockApiRequest } from "@/lib/mock-api/handler";

export const MOCK_BACKEND_API_URL = "mock://local";
export const UPSTREAM_TIMEOUT_MS = 30_000;

export class BackendConfigurationError extends Error {
  constructor() {
    super(
      "BESAT_BACKEND_API_URL is not configured. Set it to an HTTP(S) Django API URL or explicitly to mock://local for isolated tests.",
    );
    this.name = "BackendConfigurationError";
  }
}

function createConfigurationResponse() {
  return Response.json(
    {
      detail: "پیکربندی سرویس پشتیبان کامل نیست. لطفاً با مدیر سامانه تماس بگیرید.",
      code: "backend_not_configured",
    },
    { status: 503 },
  );
}

const REQUEST_HEADERS_TO_REMOVE = [
  "connection",
  "content-length",
  "cookie",
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

export type BackendRequest = {
  requestUrl: string;
  path: string[];
  method: string;
  headers?: HeadersInit;
  body?: ArrayBuffer | string | null;
  requestId: string;
  accessToken?: string | null;
  /** The inbound Next.js request's real Host header
   * (request.headers.get('host')), forwarded to the backend as
   * X-Forwarded-Host. request.url's own host cannot be used as a fallback
   * source of truth here: it reflects the Node server's bind address (e.g.
   * "0.0.0.0:3000" when the dev server listens on all interfaces inside a
   * container), not the browser's real origin. Every caller must pass this
   * explicitly rather than relying on `headers` being forwarded verbatim,
   * since some callers (login, registration) intentionally send a minimal
   * header set upstream. */
  inboundHost?: string | null;
};

export function getConfiguredBackendApiUrl() {
  const configuredUrl = process.env.BESAT_BACKEND_API_URL?.trim();
  if (!configuredUrl) throw new BackendConfigurationError();
  return configuredUrl;
}

export function getBackendBaseUrl() {
  const backendUrl = new URL(getConfiguredBackendApiUrl());

  if (!['http:', 'https:'].includes(backendUrl.protocol)) {
    throw new Error('Unsupported backend protocol');
  }

  backendUrl.hash = '';
  backendUrl.search = '';
  backendUrl.pathname = `${backendUrl.pathname.replace(/\/+$/, '')}/`;
  return backendUrl;
}

export function createUpstreamUrl(requestUrl: string, path: string[]) {
  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        segment === '.' || segment === '..' || segment.includes('\0'),
    )
  ) {
    throw new Error('Invalid backend path');
  }

  const frontendUrl = new URL(requestUrl);
  const upstreamUrl = getBackendBaseUrl();
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/');

  upstreamUrl.pathname = `${upstreamUrl.pathname}${encodedPath}/`;
  upstreamUrl.search = frontendUrl.search;
  return upstreamUrl;
}

// This Next.js process is not guaranteed to sit behind a reverse proxy that
// overwrites client-supplied forwarded headers, so x-forwarded-for read from
// an inbound request is untrustworthy by default: any client can set it, and
// forwarding it verbatim would let them spoof the IP Django uses for
// throttling and audit logs. Only forward it when the deployment explicitly
// confirms a trusted proxy sanitizes it before it reaches this process,
// mirroring the backend's TRUST_PROXY_HEADERS opt-in.
const TRUST_FORWARDED_FOR = process.env.BESAT_TRUST_FORWARDED_FOR === 'true';

function createUpstreamHeaders({
  requestUrl,
  requestId,
  headers: sourceHeaders,
  accessToken,
  inboundHost,
}: Pick<BackendRequest, 'requestUrl' | 'requestId' | 'headers' | 'accessToken' | 'inboundHost'>) {
  const headers = new Headers(sourceHeaders);
  const inboundForwardedFor = TRUST_FORWARDED_FOR
    ? headers.get('x-forwarded-for')
    : null;

  for (const header of REQUEST_HEADERS_TO_REMOVE) {
    headers.delete(header);
  }

  const frontendUrl = new URL(requestUrl);
  headers.set('accept-encoding', 'identity');
  headers.set('x-request-id', requestId);
  headers.set('x-forwarded-host', inboundHost || frontendUrl.host);
  headers.set('x-forwarded-proto', frontendUrl.protocol.replace(':', ''));
  if (inboundForwardedFor) {
    headers.set('x-forwarded-for', inboundForwardedFor);
  }
  if (accessToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

export async function requestBackend({
  requestUrl,
  path,
  method,
  headers,
  body = null,
  requestId,
  accessToken,
  inboundHost,
}: BackendRequest) {
  let configuredBackendUrl: string;
  try {
    configuredBackendUrl = getConfiguredBackendApiUrl();
  } catch (reason) {
    if (reason instanceof BackendConfigurationError) {
      return createConfigurationResponse();
    }
    throw reason;
  }
  const upstreamHeaders = createUpstreamHeaders({
    requestUrl,
    requestId,
    headers,
    accessToken,
    inboundHost,
  });

  if (configuredBackendUrl === MOCK_BACKEND_API_URL) {
    return handleMockApiRequest(
      new Request(requestUrl, {
        method,
        headers: upstreamHeaders,
        body:
          method === 'GET' || method === 'HEAD' || body === null
            ? undefined
            : body,
      }),
      path,
    );
  }

  const init: RequestInit = {
    method,
    headers: upstreamHeaders,
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };

  if (method !== 'GET' && method !== 'HEAD' && body !== null) {
    init.body = body;
  }

  return fetch(createUpstreamUrl(requestUrl, path), init);
}
