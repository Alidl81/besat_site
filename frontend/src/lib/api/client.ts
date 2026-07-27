export type ApiRequestOptions = RequestInit & {
  token?: string;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

import {
  clearBesatSession,
  readBesatSession,
  writeBesatSession,
} from "@/lib/auth/auth-session";

type ApiErrorPayload = {
  detail?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payload: ApiErrorPayload | string | null;

  constructor({
    status,
    url,
    payload,
  }: {
    status: number;
    url: string;
    payload: ApiErrorPayload | string | null;
  }) {
    const detail =
      typeof payload === "object" && payload
        ? payload.detail ?? payload.message
        : typeof payload === "string"
          ? payload
          : null;

    super(detail || `Request failed with status ${status}.`);
    this.name = "ApiRequestError";
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

function getApiBaseUrl() {
  const publicApiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

  if (typeof window === "undefined") {
    return process.env.NEXT_SERVER_API_BASE_URL ?? publicApiBaseUrl;
  }

  return publicApiBaseUrl;
}

function normalizeEndpoint(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanEndpoint = endpoint.replace(/^\//, "");

  return `${baseUrl}/${cleanEndpoint}`;
}

let refreshPromise: Promise<string | null> | null = null;

function tokenNeedsRefresh(accessToken: string): boolean {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      return true;
    }

    const encodedPayload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const payload = JSON.parse(atob(encodedPayload)) as { exp?: unknown };

    return (
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000) + 30
    );
  } catch {
    return true;
  }
}

async function refreshAccessToken(staleAccessToken: string): Promise<string | null> {
  const session = readBesatSession();

  if (!session) {
    return null;
  }

  if (tokenNeedsRefresh(session.refreshToken)) {
    return null;
  }

  // Another request may already have refreshed the shared session.
  if (session.accessToken !== staleAccessToken) {
    return session.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(normalizeEndpoint("auth/refresh/"), {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh: session.refreshToken }),
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as { access?: unknown };

        if (typeof payload.access !== "string" || !payload.access) {
          return null;
        }

        writeBesatSession({
          ...session,
          accessToken: payload.access,
        });

        return payload.access;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function readErrorPayload(
  response: Response,
): Promise<ApiErrorPayload | string | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiErrorPayload;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const url = normalizeEndpoint(endpoint);

  const performRequest = (accessToken?: string) => {
    const requestHeaders: HeadersInit = {
      Accept: "application/json",
      ...(requestOptions.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    };

    return fetch(url, {
      ...requestOptions,
      headers: requestHeaders,
    });
  };

  let accessToken = token;

  if (accessToken && tokenNeedsRefresh(accessToken)) {
    const refreshedAccessToken = await refreshAccessToken(accessToken);

    if (refreshedAccessToken) {
      accessToken = refreshedAccessToken;
    } else {
      clearBesatSession();
      accessToken = undefined;
    }
  }

  let response = await performRequest(accessToken);

  if (response.status === 401 && accessToken) {
    const refreshedAccessToken = await refreshAccessToken(accessToken);

    if (refreshedAccessToken) {
      response = await performRequest(refreshedAccessToken);
    } else {
      clearBesatSession();

      // Invalid authentication must not break endpoints that are intentionally
      // public. Unsafe requests are never replayed without credentials.
      const method = (requestOptions.method ?? "GET").toUpperCase();
      if (method === "GET" || method === "HEAD") {
        response = await performRequest();
      }
    }
  }

  if (!response.ok) {
    throw new ApiRequestError({
      status: response.status,
      url,
      payload: await readErrorPayload(response),
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
