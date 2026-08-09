import { getApiErrorMessage } from "@/lib/api/client";
import { sessionFromUser, type BesatSession } from "@/lib/auth/auth-session";

export type LoginResult =
  | { ok: true; session: BesatSession }
  | { ok: false; message: string };

export async function performLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(
        payload && typeof payload === "object" && typeof payload.detail === "string"
          ? payload.detail
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
  await fetch("/api/session", { method: "DELETE" });
}
