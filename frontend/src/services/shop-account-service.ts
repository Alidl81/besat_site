import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";
import type {
  Address,
  CustomerRegisterPayload,
  MyCourseEnrollment,
  OrderDetail,
  OrderListItem,
  PaymentCallbackResponse,
  PaymentStartResponse,
} from "@/types/shop";

export function registerCustomer(payload: CustomerRegisterPayload) {
  return apiRequest<{ access: string; refresh: string; user: unknown; redirect_path: string }>(
    apiEndpoints.shop.register,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function placeOrder(payload: {
  shipping_method_id?: number | null;
  address_id?: number | null;
  customer_note?: string | null;
}) {
  return apiRequest<OrderDetail>(apiEndpoints.shop.orders, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyOrders(page = 1) {
  return apiRequest<ApiListResponse<OrderListItem>>(`${apiEndpoints.shop.orders}?page=${page}`);
}

export function getMyOrder(orderNumber: string) {
  return apiRequest<OrderDetail>(`${apiEndpoints.shop.orders}${encodeURIComponent(orderNumber)}/`);
}

export function startPayment(orderNumber: string) {
  return apiRequest<PaymentStartResponse>(apiEndpoints.shop.paymentStart, {
    method: "POST",
    body: JSON.stringify({ order_number: orderNumber }),
  });
}

export function submitMockPaymentOutcome(payload: {
  attempt_id: number;
  outcome: "success" | "failure";
  mock_token: string;
}) {
  return apiRequest<PaymentCallbackResponse>(`${apiEndpoints.shop.paymentCallback}mock/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyAddresses() {
  return apiRequest<Address[]>(apiEndpoints.shop.addresses);
}

export function createAddress(payload: Omit<Address, "id" | "created_at">) {
  return apiRequest<Address>(apiEndpoints.shop.addresses, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAddress(id: number, payload: Partial<Omit<Address, "id" | "created_at">>) {
  return apiRequest<Address>(`${apiEndpoints.shop.addresses}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAddress(id: number) {
  return apiRequest<void>(`${apiEndpoints.shop.addresses}${id}/`, { method: "DELETE" });
}

export function getMyCourses() {
  return apiRequest<MyCourseEnrollment[]>(apiEndpoints.shop.myCourses);
}
