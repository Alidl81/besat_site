import { getApiErrorMessage, resolveRequestSignal } from "@/lib/api/client";
import { sessionFromUser, type BesatSession } from "@/lib/auth/auth-session";

export type LoginResult =
  | { ok: true; session: BesatSession }
  | { ok: false; message: string };

export async function performLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    // REL-FE-AUTH-TRANSPORT-TIMEOUT-001: this raw fetch() had no
    // AbortSignal at all, so a stalled BFF/upstream held the login request
    // open indefinitely (or until the platform's own uncontrolled
    // connection-level default) instead of settling deterministically at
    // apiRequest()'s shared 8s application deadline -- the exact defect
    // REL-FE-BACKEND-TIMEOUT-001/REL-FE-CART-TIMEOUT-001 already fixed for
    // apiRequest and the cart transport. resolveRequestSignal() is the
    // same shared default those two use, applied here rather than
    // duplicating the policy a third time.
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      signal: resolveRequestSignal(undefined, undefined),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      // Deliberately not surfacing payload.detail here: SimpleJWT's default
      // invalid-credentials response is raw untranslated English ("No
      // active account found with the given credentials"), which would
      // otherwise render as-is on an RTL Persian form. A wrong username or
      // password is the overwhelmingly common case for a 401 here, so it
      // gets its own clear message instead of a generic fallback.
      throw new Error(
        response.status === 401
          ? "نام کاربری یا رمز عبور اشتباه است."
          : response.status >= 500
            ? "بک‌اند در دسترس نیست. کمی بعد دوباره تلاش کنید."
            : "ورود به حساب انجام نشد.",
      );
    }
    const result = payload as {
      user?: Parameters<typeof sessionFromUser>[0];
      redirect_path?: string;
    };
    if (!result.user) throw new Error("پاسخ ورود کامل نیست.");
    const session = sessionFromUser({
      ...result.user,
      redirect_path: result.redirect_path ?? result.user.redirect_path,
    });
    return {
      ok: true,
      session,
    };
  } catch (reason) {
    return { ok: false, message: getApiErrorMessage(reason) };
  }
}

export async function destroySession() {
  // REL-FE-AUTH-TRANSPORT-TIMEOUT-001: same missing-deadline defect as
  // performLogin() above -- see that comment for the full rationale.
  await fetch("/api/session", { method: "DELETE", signal: resolveRequestSignal(undefined, undefined) });
}
