import "server-only";

import { handleMockApiRequest } from "@/lib/mock-api/handler";

export const DEFAULT_BACKEND_API_URL = "mock://local";
export const UPSTREAM_TIMEOUT_MS = 30_000;

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
};

export function getConfiguredBackendApiUrl() {
  return process.env.BESAT_BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL;
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

function createUpstreamHeaders({
  requestUrl,
  requestId,
  headers: sourceHeaders,
  accessToken,
}: Pick<BackendRequest, 'requestUrl' | 'requestId' | 'headers' | 'accessToken'>) {
  const headers = new Headers(sourceHeaders);

  for (const header of REQUEST_HEADERS_TO_REMOVE) {
    headers.delete(header);
  }

  const frontendUrl = new URL(requestUrl);
  headers.set('accept-encoding', 'identity');
  headers.set('x-request-id', requestId);
  headers.set('x-forwarded-host', frontendUrl.host);
  headers.set('x-forwarded-proto', frontendUrl.protocol.replace(':', ''));
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
}: BackendRequest) {
  const upstreamHeaders = createUpstreamHeaders({
    requestUrl,
    requestId,
    headers,
    accessToken,
  });

  if (getConfiguredBackendApiUrl() === DEFAULT_BACKEND_API_URL) {
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
