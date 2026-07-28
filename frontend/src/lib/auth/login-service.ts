import { loginAccount } from "@/lib/api/account-api";
import { getApiErrorMessage } from "@/lib/api/client";
import type { BesatSession } from "@/lib/auth/auth-session";

export type LoginResult =
  | { ok: true; session: BesatSession }
  | { ok: false; message: string };

export async function performLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    const response = await loginAccount({ username, password });
    return {
      ok: true,
      session: {
        accessToken: response.access,
        refreshToken: response.refresh,
        username: response.user.username,
        fullName: response.user.full_name,
        role: response.user.role,
        redirectPath: response.redirect_path,
        unitId:
          response.user.unit_id === null || response.user.unit_id === undefined
            ? null
            : String(response.user.unit_id),
      },
    };
  } catch (reason) {
    return { ok: false, message: getApiErrorMessage(reason) };
  }
}
