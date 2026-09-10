import { getApiErrorMessage, resolveRequestSignal } from "@/lib/api/client";
import { sessionFromUser, type BesatSession } from "@/lib/auth/auth-session";
import type { CustomerRegisterPayload } from "@/types/shop";

export type RegistrationResult =
  | { ok: true; session: BesatSession }
  | { ok: false; message: string };

export async function performCustomerRegistration(
  payload: CustomerRegisterPayload,
): Promise<RegistrationResult> {
  try {
    // REL-FE-AUTH-TRANSPORT-TIMEOUT-001: this raw fetch() had no
    // AbortSignal at all, so a stalled BFF/upstream held the registration
    // request open indefinitely instead of settling deterministically at
    // apiRequest()'s shared 8s application deadline -- see login-service.ts's
    // identical comment for the full rationale; resolveRequestSignal() is
    // the same shared default REL-FE-BACKEND-TIMEOUT-001/REL-FE-CART-TIMEOUT-001
    // already established.
    const response = await fetch("/api/customer-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: resolveRequestSignal(undefined, undefined),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== "object") {
      const detail =
        body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string"
          ? (body as { detail: string }).detail
          : "ثبت‌نام انجام نشد.";
      throw new Error(detail);
    }
    const result = body as { user?: Parameters<typeof sessionFromUser>[0]; redirect_path?: string };
    if (!result.user) throw new Error("پاسخ ثبت‌نام کامل نیست.");
    const session = sessionFromUser({
      ...result.user,
      redirect_path: result.redirect_path ?? result.user.redirect_path,
    });
    return { ok: true, session };
  } catch (reason) {
    return { ok: false, message: getApiErrorMessage(reason) };
  }
}
