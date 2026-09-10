import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cartApiRequest, type CartTransportResult } from "@/lib/shop/cart-transport";
import type { ApiListResponse } from "@/types/api";
import type { Cart, CheckoutPreview, ProductDetail, ProductListItem, ShippingMethod, ShopCategory } from "@/types/shop";

type Scalar = string | number | boolean | null | undefined;

function withQuery(endpoint: string, query: Record<string, Scalar>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `${endpoint}?${encoded}` : endpoint;
}

export type ProductListQuery = {
  page?: number;
  page_size?: number;
  type?: string;
  category?: string;
  price_min?: number;
  price_max?: number;
  availability?: string;
  featured?: boolean;
  search?: string;
  ordering?: string;
};

// FE-CATALOG-FILTER-URL-MIXED-REQUEST-001 (residual): accepting an
// optional AbortSignal lets a caller actually cancel a superseded request's
// transport (not just discard its result once it lands) -- see
// ShopExplorer's fetch effect, which aborts the previous request's
// controller before issuing a new one on a filter/page/URL change.
export function getShopProducts(query: ProductListQuery = {}, signal?: AbortSignal) {
  return apiRequest<ApiListResponse<ProductListItem>>(withQuery(apiEndpoints.shop.products, query), { signal });
}

export function getShopProduct(slug: string) {
  return apiRequest<ProductDetail>(`${apiEndpoints.shop.products}${encodeURIComponent(slug)}/`);
}

export function getShopCategories() {
  return apiRequest<ShopCategory[]>(apiEndpoints.shop.categories);
}

export function getShippingMethods() {
  return apiRequest<ShippingMethod[]>(apiEndpoints.shop.shippingMethods);
}

// --- Cart -------------------------------------------------------------
// Every cart function takes/returns the guest token explicitly rather
// than reading a cookie itself -- the caller (ShopCartProvider) owns
// where that token is persisted (an HttpOnly cookie via the BFF proxy).

export function getCart(guestToken: string | null): Promise<CartTransportResult<Cart>> {
  return cartApiRequest<Cart>(apiEndpoints.shop.cart, { guestToken });
}

export function addCartItem(
  guestToken: string | null,
  payload: { product_id: number; variant_id?: number | null; quantity: number; client_request_id?: string },
): Promise<CartTransportResult<Cart>> {
  return cartApiRequest<Cart>(apiEndpoints.shop.cartItems, {
    method: "POST",
    body: JSON.stringify(payload),
    guestToken,
  });
}

export function updateCartItem(
  guestToken: string | null,
  itemId: number,
  quantity: number,
): Promise<CartTransportResult<Cart>> {
  return cartApiRequest<Cart>(`${apiEndpoints.shop.cartItems}${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
    guestToken,
  });
}

export function removeCartItem(guestToken: string | null, itemId: number): Promise<CartTransportResult<Cart>> {
  return cartApiRequest<Cart>(`${apiEndpoints.shop.cartItems}${itemId}/`, {
    method: "DELETE",
    guestToken,
  });
}

export function mergeGuestCart(guestToken: string): Promise<CartTransportResult<Cart>> {
  return cartApiRequest<Cart>(apiEndpoints.shop.cartMerge, { method: "POST", guestToken });
}

export function getCheckoutPreview(shippingMethodId?: number | null) {
  return apiRequest<CheckoutPreview>(apiEndpoints.shop.checkoutPreview, {
    method: "POST",
    body: JSON.stringify({ shipping_method_id: shippingMethodId ?? undefined }),
  });
}
