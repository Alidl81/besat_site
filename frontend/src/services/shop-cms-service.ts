import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";
import type {
  CMSCourseEnrollment,
  CMSOrderDetail,
  CMSOrderEvent,
  CMSOrderListItem,
  CMSPaymentAttempt,
  CMSProductDetail,
  CMSProductListItem,
  CMSProductWritePayload,
  CMSShopCategory,
  CMSShopSettings,
  ProductImage,
  ShippingMethod,
} from "@/types/shop";

type Scalar = string | number | boolean | null | undefined;

function withQuery(endpoint: string, query: Record<string, Scalar> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `${endpoint}?${encoded}` : endpoint;
}

// --- Products -----------------------------------------------------------

export function cmsGetProducts(query: { status?: string; product_type?: string; search?: string } = {}) {
  return apiRequest<ApiListResponse<CMSProductListItem>>(withQuery(apiEndpoints.cmsShop.products, query));
}

export function cmsGetProduct(id: number) {
  return apiRequest<CMSProductDetail>(`${apiEndpoints.cmsShop.products}${id}/`);
}

export function cmsCreateProduct(payload: CMSProductWritePayload) {
  return apiRequest<CMSProductDetail>(apiEndpoints.cmsShop.products, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cmsUpdateProduct(id: number, payload: CMSProductWritePayload) {
  return apiRequest<CMSProductDetail>(`${apiEndpoints.cmsShop.products}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cmsDeleteProduct(id: number) {
  return apiRequest<void>(`${apiEndpoints.cmsShop.products}${id}/`, { method: "DELETE" });
}

export type ProductWorkflowAction =
  | "submit-review"
  | "approve"
  | "publish"
  | "reject"
  | "archive"
  | "restore";

export function cmsRunProductWorkflowAction(id: number, action: ProductWorkflowAction, reason?: string) {
  return apiRequest<CMSProductDetail>(`${apiEndpoints.cmsShop.products}${id}/${action}/`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function cmsUploadProductGalleryImage(
  productId: number,
  file: File,
  options: { altText?: string; caption?: string } = {},
) {
  const form = new FormData();
  form.set("image", file);
  if (options.altText) form.set("alt_text", options.altText);
  if (options.caption) form.set("caption", options.caption);
  return apiRequest<ProductImage>(
    `${apiEndpoints.cmsShop.products}${productId}/upload-image/`,
    { method: "POST", body: form },
  );
}

// --- Categories -----------------------------------------------------------

export function cmsGetCategories() {
  return apiRequest<ApiListResponse<CMSShopCategory>>(apiEndpoints.cmsShop.categories);
}

export function cmsCreateCategory(payload: Partial<CMSShopCategory>) {
  return apiRequest<CMSShopCategory>(apiEndpoints.cmsShop.categories, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cmsUpdateCategory(id: number, payload: Partial<CMSShopCategory>) {
  return apiRequest<CMSShopCategory>(`${apiEndpoints.cmsShop.categories}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cmsDeleteCategory(id: number) {
  return apiRequest<void>(`${apiEndpoints.cmsShop.categories}${id}/`, { method: "DELETE" });
}

// --- Orders -----------------------------------------------------------

export function cmsGetOrders(query: { status?: string } = {}) {
  return apiRequest<ApiListResponse<CMSOrderListItem>>(withQuery(apiEndpoints.cmsShop.orders, query));
}

export function cmsGetOrder(id: number) {
  return apiRequest<CMSOrderDetail>(`${apiEndpoints.cmsShop.orders}${id}/`);
}

export function cmsGetOrderEvents(id: number) {
  return apiRequest<CMSOrderEvent[]>(`${apiEndpoints.cmsShop.orders}${id}/events/`);
}

export type OrderFulfillmentAction =
  | "mark-processing"
  | "mark-shipped"
  | "mark-completed"
  | "cancel"
  | "refund"
  | "partial-refund";

export function cmsRunOrderAction(id: number, action: OrderFulfillmentAction, reason?: string) {
  return apiRequest<CMSOrderDetail>(`${apiEndpoints.cmsShop.orders}${id}/${action}/`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

// --- Payments -----------------------------------------------------------

export function cmsGetPayments() {
  return apiRequest<ApiListResponse<CMSPaymentAttempt>>(apiEndpoints.cmsShop.payments);
}

// --- Shipping methods -----------------------------------------------------------

export function cmsGetShippingMethods() {
  return apiRequest<ApiListResponse<ShippingMethod> | ShippingMethod[]>(apiEndpoints.cmsShop.shippingMethods);
}

export function cmsCreateShippingMethod(payload: Partial<ShippingMethod>) {
  return apiRequest<ShippingMethod>(apiEndpoints.cmsShop.shippingMethods, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cmsUpdateShippingMethod(id: number, payload: Partial<ShippingMethod>) {
  return apiRequest<ShippingMethod>(`${apiEndpoints.cmsShop.shippingMethods}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cmsDeleteShippingMethod(id: number) {
  return apiRequest<void>(`${apiEndpoints.cmsShop.shippingMethods}${id}/`, { method: "DELETE" });
}

// --- Settings -----------------------------------------------------------

export function cmsGetSettings() {
  return apiRequest<CMSShopSettings>(apiEndpoints.cmsShop.settings);
}

export function cmsUpdateSettings(payload: Partial<CMSShopSettings>) {
  return apiRequest<CMSShopSettings>(apiEndpoints.cmsShop.settings, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// --- Course enrollments -----------------------------------------------------------

export function cmsGetCourseEnrollments() {
  return apiRequest<ApiListResponse<CMSCourseEnrollment>>(apiEndpoints.cmsShop.courseEnrollments);
}
