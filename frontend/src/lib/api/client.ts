export type ApiRequestOptions = RequestInit & {
  token?: string;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

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

function getApiBaseUrl() {
  if (typeof window === "undefined") {
    const backendApiUrl =
      process.env.BESAT_BACKEND_API_URL ?? "mock://local";

    if (backendApiUrl === "mock://local") {
      return (
        process.env.NEXT_SERVER_API_BASE_URL ??
        "http://127.0.0.1:3000/api/backend"
      );
    }

    return (
      process.env.NEXT_SERVER_API_BASE_URL ??
      backendApiUrl
    );
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";
}

export function normalizeEndpoint(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanEndpoint = endpoint.replace(/^\//, "");
  return `${baseUrl}/${cleanEndpoint}`;
}

function normalizeFieldErrors(payload: unknown): ApiFieldErrors {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => !["detail", "message", "code", "request_id"].includes(key))
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.map(String)
          : value && typeof value === "object"
            ? [JSON.stringify(value)]
            : [String(value)],
      ]),
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
  const message =
    typeof payload.detail === "string"
      ? payload.detail
      : typeof payload.message === "string"
        ? payload.message
        : response.status === 401
          ? "نشست شما منقضی شده است. دوباره وارد شوید."
          : response.status === 403
            ? "برای انجام این عملیات دسترسی ندارید."
            : response.status === 404
              ? "اطلاعات درخواستی پیدا نشد."
              : response.status >= 500
                ? "بک‌اند در دسترس نیست. کمی بعد دوباره تلاش کنید."
                : "درخواست توسط بک‌اند پذیرفته نشد.";

  return new ApiError({
    message,
    status: response.status,
    code: typeof payload.code === "string" ? payload.code : null,
    fieldErrors: normalizeFieldErrors(detail),
    requestId:
      typeof payload.request_id === "string" ? payload.request_id : requestId,
    detail,
  });
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;
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
  });

  if (!response.ok) throw await createApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(
  endpoint: string,
  options: ApiRequestOptions = {},
) {
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(normalizeEndpoint(endpoint), {
    ...requestOptions,
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
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
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "خطای پیش‌بینی‌نشده‌ای رخ داد.";
}
