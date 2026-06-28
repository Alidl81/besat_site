// سرویس ورود سوئیچ‌پذیر: در حالت محلی با کاربران seed کار می‌کند،
// در حالت API به endpoint واقعی auth/login/ وصل می‌شود.

import { loginAccount } from "@/lib/api/account-api";
import { isApiMode } from "@/lib/data/repository";
import { redirectPathForRole, type BesatSession } from "@/lib/auth/auth-session";
import { seedUsers } from "@/lib/data/seed-data";

export type LoginResult =
  | { ok: true; session: BesatSession }
  | { ok: false; message: string };

// کاربران تستی محلی: username / password
// رمز همه برای تست: 1234
const LOCAL_PASSWORD = "1234";

export async function performLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  if (isApiMode()) {
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
          unitId: null,
        },
      };
    } catch {
      return { ok: false, message: "نام کاربری یا رمز عبور اشتباه است." };
    }
  }

  // حالت محلی (تست بدون بک)
  const user = seedUsers.find((item) => item.username === username);

  if (!user || password !== LOCAL_PASSWORD) {
    return {
      ok: false,
      message: "نام کاربری یا رمز عبور اشتباه است. (تست: admin / 1234)",
    };
  }

  const token = `local-${user.id}-${Date.now()}`;

  return {
    ok: true,
    session: {
      accessToken: token,
      refreshToken: token,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      redirectPath: redirectPathForRole(user.role),
      unitId: user.unit_id,
    },
  };
}
