export type ApiRequestOptions = RequestInit & {
  token?: string;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";
}

function normalizeEndpoint(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanEndpoint = endpoint.replace(/^\//, "");

  return `${baseUrl}/${cleanEndpoint}`;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options;

  const requestHeaders: HeadersInit = {
    Accept: "application/json",
    ...(requestOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(normalizeEndpoint(endpoint), {
    ...requestOptions,
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error("درخواست ناموفق بود.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
