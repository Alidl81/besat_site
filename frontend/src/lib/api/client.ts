import { describeUnsafeBackendOrigin } from "@/lib/network-address-checks";
import { isSafeRelativePath } from "@/lib/url-safety";

export type ApiRequestOptions = RequestInit & {
  token?: string;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
  /** Milliseconds before this request is aborted, if the caller doesn't
   * already supply their own `signal`. See REL-FE-BACKEND-TIMEOUT-001's
   * DEFAULT_TIMEOUT_MS comment below for why this exists at all. */
  timeoutMs?: number;
};

// REL-FE-BACKEND-TIMEOUT-001: apiRequest()/apiDownload() called raw
// fetch() with no AbortSignal at all, so a slow/unreachable backend held
// the request open until the platform's own connection-level default
// (observed as undici's ConnectTimeoutError at ~10s, and up to ~20-28s for
// routes making two serial calls) -- there was no *application* deadline,
// only whatever the underlying transport happened to give up at. The BFF
// proxy (lib/server/backend-client.ts) already has its own 30s
// UPSTREAM_TIMEOUT_MS budget for interactive, authenticated flows going
// through it, but server-rendered pages/metadata that call this generic
// client directly never inherited that guard.
//
// This default intentionally stays a few seconds inside that 30s BFF
// budget rather than matching it -- most callers here are optional public
// reads (product listings, sitemap entries) that should fail fast to
// their own already-existing `.catch()` fallback rather than hold a
// render worker open anywhere near as long as an authenticated mutation
// might reasonably need. Callers with a different appropriate budget (or
// their own AbortSignal, e.g. a user-cancellable request) can override
// via `timeoutMs`/`signal` -- an explicit `signal` always wins over the
// default timeout, never fights it.
export const DEFAULT_TIMEOUT_MS = 8_000;

// REL-FE-CART-TIMEOUT-001: exported so lib/shop/cart-transport.ts's own
// raw `fetch()` (a deliberately separate transport from `apiRequest` --
// see that file's header comment for why -- but one that had no deadline
// at all, the exact same defect REL-FE-BACKEND-TIMEOUT-001 fixed here)
// can apply the identical default deadline instead of duplicating this
// two-line policy in a second place.
export function resolveRequestSignal(signal: AbortSignal | null | undefined, timeoutMs: number | undefined) {
  return signal ?? AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  code: string | null;
  fieldErrors: ApiFieldErrors;
  requestId: string | null;
  detail: unknown;

  constructor({
    message,
    status,
    code = null,
    fieldErrors = {},
    requestId = null,
    detail = null,
  }: {
    message: string;
    status: number;
    code?: string | null;
    fieldErrors?: ApiFieldErrors;
    requestId?: string | null;
    detail?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
    this.detail = detail;
  }
}

// OPS-FE-SERVER-API-URL-RUNTIME-001: server-rendered code that calls
// apiRequest()/getShopProduct()/etc. directly (generateMetadata(), page
// components) resolves the backend origin HERE, independently of
// lib/server/backend-client.ts's getBackendBaseUrl() -- a second, separate
// "where is the backend" resolution path that had no host validation at
// all, bypassing the network-range/allowlist/credentials checks added
// there for OPS-FE-BACKEND-URL-RUNTIME-001. Same fix, same shared
// describeUnsafeBackendOrigin(), applied to whatever this function
// actually resolves to (across all three of its return branches -- the
// mock-mode fallback included, since that fallback is itself a loopback
// address and would otherwise slip through as if it were a deliberate
// choice), gated to production only for the same reason as the other two
// fixes: local dev legitimately points either env var at 127.0.0.1.
function getApiBaseUrl() {
  if (typeof window === "undefined") {
    const backendApiUrl = process.env.BESAT_BACKEND_API_URL?.trim();
    const serverApiUrl = process.env.NEXT_SERVER_API_BASE_URL?.trim();

    let resolved: string;
    if (backendApiUrl === "mock://local") {
      resolved = serverApiUrl ?? "http://127.0.0.1:3000/api/backend";
    } else if (serverApiUrl) {
      resolved = serverApiUrl;
    } else if (backendApiUrl) {
      resolved = backendApiUrl;
    } else {
      throw new Error(
        "Backend API is not configured. Set BESAT_BACKEND_API_URL or NEXT_SERVER_API_BASE_URL; mock mode requires an explicit mock://local value.",
      );
    }

    if (process.env.NODE_ENV === "production") {
      let parsed: URL;
      try {
        parsed = new URL(resolved);
      } catch {
        throw new Error(
          `OPS-FE-SERVER-API-URL-RUNTIME-001: resolved backend API base URL is not a valid URL ("${resolved}").`,
        );
      }
      const unsafeReason = describeUnsafeBackendOrigin(parsed);
      if (unsafeReason) {
        throw new Error(
          `OPS-FE-SERVER-API-URL-RUNTIME-001: resolved backend API base URL ${unsafeReason} ("${resolved}"). Set BESAT_BACKEND_API_URL/NEXT_SERVER_API_BASE_URL to the backend service's address on this deployment's private network, e.g. http://backend:8000/api.`,
        );
      }
    }

    return resolved;
  }

  // OPS-FE-PUBLIC-API-BASE-001: unlike the two server-side resolution
  // paths above, NEXT_PUBLIC_API_BASE_URL is webpack-inlined into every
  // browser bundle at `next build` time -- a runtime check here cannot
  // undo an already-poisoned build's baked-in value, but the check itself
  // is compiled into the SAME bundle as whatever value it validates, so it
  // still reliably converts a poisoned build's silent off-origin API/
  // invitation-token leak into a loud, consistent failure instead of
  // shipping it. This is documented (frontend/.env.production.example) as
  // a fixed same-origin BFF proxy path in every topology this project
  // supports, never a per-deployment absolute origin -- so unlike
  // NEXT_PUBLIC_SITE_URL/BESAT_BACKEND_API_URL, there is no legitimate
  // dev-only exception to gate around; validate in every environment.
  //
  // OPS-FE-PUBLIC-API-BASE-001-R1: an omitted Docker ARG becomes an EMPTY
  // STRING once assigned to ENV (`ARG X` + `ENV X=$X` with no --build-arg
  // resolves `$X` to "", not "unset") -- not `undefined`. Checking only
  // `=== undefined` let that empty string reach `isSafeRelativePath("")`
  // (false, since "" doesn't start with "/"), throwing on every build that
  // doesn't explicitly wire this ARG through -- which is every build today,
  // since no compose file does. Matching the `?.trim()` + truthy-check
  // convention the two server-side branches above already use for the
  // exact same "absent vs. explicitly set" distinction fixes this.
  const publicApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!publicApiBase) return "/api/backend";
  if (!isSafeRelativePath(publicApiBase)) {
    throw new Error(
      `OPS-FE-PUBLIC-API-BASE-001: NEXT_PUBLIC_API_BASE_URL ("${publicApiBase}") must be a same-origin relative path, e.g. "/api/backend" -- it is a fixed BFF proxy route in every topology this project supports, not a per-deployment value. An absolute/off-origin value here would send every browser API call, including invitation-token and password-reset requests, to that origin instead of this app's own BFF proxy.`,
    );
  }
  return publicApiBase;
}

export function normalizeEndpoint(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanEndpoint = endpoint.replace(/^\//, "");
  return `${baseUrl}/${cleanEndpoint}`;
}

function collectErrorStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectErrorStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectErrorStrings);
  }
  return [String(value)];
}

function normalizeFieldErrors(payload: unknown): ApiFieldErrors {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => !["detail", "message", "code", "request_id"].includes(key))
      .map(([key, value]) => [key, collectErrorStrings(value)]),
  );
}

async function createApiError(response: Response) {
  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("x-correlation-id");
  const contentType = response.headers.get("content-type") ?? "";
  let detail: unknown = null;

  try {
    detail = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    detail = null;
  }

  const payload =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : {};
  const fieldErrors = normalizeFieldErrors(detail);
  const fieldErrorsMessage = Object.values(fieldErrors).flat().join("؛ ") || null;
  // DRF's own default object-level errors (e.g. a plain ReadOnlyModelViewSet's
  // 404 "No Achievement matches the given query.", or an unoverridden
  // "Not found."/"Authentication credentials were not provided.") are always
  // English and were never meant to reach an end user -- every genuine
  // Besat-authored `detail` string (custom NotFound()s, validation errors,
  // etc.) is Persian. Detecting Persian script is a robust, forward-proof way
  // to tell the two apart without enumerating DRF's exact default strings.
  const hasPersianDetail =
    typeof payload.detail === "string" && /[؀-ۿ]/.test(payload.detail);
  const message =
    hasPersianDetail
      ? (payload.detail as string)
      : typeof payload.message === "string"
        ? payload.message
        : fieldErrorsMessage ??
          (response.status === 401
            ? "نشست شما منقضی شده است. دوباره وارد شوید."
            : response.status === 403
              ? "برای انجام این عملیات دسترسی ندارید."
              : response.status === 404
                ? "اطلاعات درخواستی پیدا نشد."
                : response.status >= 500
                  ? "بک‌اند در دسترس نیست. کمی بعد دوباره تلاش کنید."
                  : "درخواست توسط بک‌اند پذیرفته نشد.");

  return new ApiError({
    message,
    status: response.status,
    code: typeof payload.code === "string" ? payload.code : null,
    fieldErrors,
    requestId:
      typeof payload.request_id === "string" ? payload.request_id : requestId,
    detail,
  });
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, timeoutMs, signal, ...requestOptions } = options;
  const requestHeaders: HeadersInit = {
    Accept: "application/json",
    ...(requestOptions.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(normalizeEndpoint(endpoint), {
    ...requestOptions,
    headers: requestHeaders,
    signal: resolveRequestSignal(signal, timeoutMs),
  });

  if (!response.ok) throw await createApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(
  endpoint: string,
  options: ApiRequestOptions = {},
) {
  const { token, headers, timeoutMs, signal, ...requestOptions } = options;
  const response = await fetch(normalizeEndpoint(endpoint), {
    ...requestOptions,
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    signal: resolveRequestSignal(signal, timeoutMs),
  });

  if (!response.ok) throw await createApiError(response);

  return {
    blob: await response.blob(),
    filename:
      response.headers
        .get("content-disposition")
        ?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1] ?? null,
  };
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    // A plain Error is ambiguous: it's most often `fetch` itself failing
    // before any HTTP response ever existed -- offline, DNS failure, CORS
    // block, an aborted/reset connection, etc. -- whose `.message` is a raw,
    // un-localized browser-native string (e.g. Chrome's literal "Failed to
    // fetch") never meant to reach an end user. But callers that inspect a
    // real HTTP response themselves outside apiRequest/ApiError (e.g.
    // performLogin's own fetch to /api/session) sometimes deliberately throw
    // a plain Error with an already-correct, already-Persian message (see
    // login-service.ts's comment on why it avoids surfacing SimpleJWT's raw
    // English 401 detail). Trust the message as-is when it's already
    // Persian; only fall back to the generic offline message when it isn't
    // (the same Persian-script heuristic createApiError uses to tell a
    // genuine backend-authored message apart from a raw framework/browser
    // default).
    if (/[؀-ۿ]/.test(error.message)) return error.message;
    return "اتصال به بک‌اند برقرار نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.";
  }
  return "خطای پیش‌بینی‌نشده‌ای رخ داد.";
}
