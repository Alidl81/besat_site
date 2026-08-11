import { ApiError, normalizeEndpoint, type ApiFieldErrors } from "@/lib/api/client";

/**
 * Cart endpoints exchange a guest-cart token via response/request headers
 * (see backend/apps/shop/views/cart.py's X-Guest-Cart-Token contract),
 * which the shared `apiRequest` helper in @/lib/api/client has no way to
 * surface (it only ever returns the parsed body). This is a small,
 * cart-specific fetch wrapper rather than a change to that shared
 * helper -- every other API call in the app goes through it, so it stays
 * untouched here.
 */

export const GUEST_CART_TOKEN_HEADER = "X-Guest-Cart-Token";
export const GUEST_CART_TOKEN_CLEAR_HEADER = "X-Guest-Cart-Token-Clear";

export type CartTransportResult<T> = {
  data: T;
  guestToken: string | null;
  clearGuestToken: boolean;
};

function normalizeFieldErrors(payload: unknown): ApiFieldErrors {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => !["detail", "message", "code"].includes(key))
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]),
  );
}

export async function cartApiRequest<T>(
  endpoint: string,
  options: RequestInit & { guestToken?: string | null } = {},
): Promise<CartTransportResult<T>> {
  const { guestToken, headers, ...requestOptions } = options;

  const response = await fetch(normalizeEndpoint(endpoint), {
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(guestToken ? { [GUEST_CART_TOKEN_HEADER]: guestToken } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = null;
    }
    const payload = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
    const message =
      typeof payload.detail === "string"
        ? payload.detail
        : "درخواست مربوط به سبد خرید انجام نشد. لطفاً دوباره تلاش کنید.";
    throw new ApiError({
      message,
      status: response.status,
      fieldErrors: normalizeFieldErrors(detail),
      detail,
    });
  }

  const data = (response.status === 204 ? undefined : await response.json()) as T;

  return {
    data,
    guestToken: response.headers.get(GUEST_CART_TOKEN_HEADER),
    clearGuestToken: response.headers.get(GUEST_CART_TOKEN_CLEAR_HEADER) === "1",
  };
}
