export type BesatRole = "general_manager" | "unit_manager" | "unit_media" | "parent" | string;

export type BesatSession = {
  accessToken: string;
  refreshToken: string;
  username: string;
  fullName: string | null;
  role: BesatRole;
  redirectPath: string;
  unitId: string | null;
};

const accessTokenKey = "besat_access_token";
const refreshTokenKey = "besat_refresh_token";
const userRoleKey = "besat_user_role";
const redirectPathKey = "besat_redirect_path";
const userKey = "besat_user";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readBesatSession(): BesatSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const accessToken = window.localStorage.getItem(accessTokenKey);
  const refreshToken = window.localStorage.getItem(refreshTokenKey);

  if (!accessToken || !refreshToken) {
    return null;
  }

  const fallbackRedirectPath = window.localStorage.getItem(redirectPathKey) || "/dashboard/admin";
  const fallbackRole = window.localStorage.getItem(userRoleKey) || "";

  try {
    const rawUser = window.localStorage.getItem(userKey);

    if (rawUser) {
      const user = JSON.parse(rawUser) as {
        username?: string;
        fullName?: string | null;
        role?: string;
        redirectPath?: string;
        unitId?: string | null;
      };

      return {
        accessToken,
        refreshToken,
        username: user.username || "",
        fullName: user.fullName || null,
        role: user.role || fallbackRole,
        redirectPath: user.redirectPath || fallbackRedirectPath,
        unitId: user.unitId ?? null,
      };
    }
  } catch {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    username: "",
    fullName: null,
    role: fallbackRole,
    redirectPath: fallbackRedirectPath,
    unitId: null,
  };
}

export function writeBesatSession(session: BesatSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(accessTokenKey, session.accessToken);
  window.localStorage.setItem(refreshTokenKey, session.refreshToken);
  window.localStorage.setItem(userRoleKey, session.role);
  window.localStorage.setItem(redirectPathKey, session.redirectPath);
  window.localStorage.setItem(userKey, JSON.stringify(session));
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function clearBesatSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
  window.localStorage.removeItem(userRoleKey);
  window.localStorage.removeItem(redirectPathKey);
  window.localStorage.removeItem(userKey);
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function getBesatSessionDisplayName(session: BesatSession) {
  return session.fullName || session.username || "حساب کاربری";
}

// نگاشت نقش به مسیر پنل
export function redirectPathForRole(role: BesatRole): string {
  switch (role) {
    case "general_manager":
      return "/dashboard/admin";
    case "unit_manager":
      return "/dashboard/unit-manager";
    case "unit_media":
      return "/dashboard/media";
    case "parent":
      return "/dashboard/parents";
    default:
      return "/dashboard/admin";
  }
}

// نقش‌های مجاز برای هر بخش از مسیر داشبورد
export function rolesForDashboardSegment(segment: string): BesatRole[] {
  switch (segment) {
    case "admin":
      return ["general_manager"];
    case "unit-manager":
      return ["unit_manager", "general_manager"];
    case "media":
      return ["unit_media", "unit_manager", "general_manager"];
    case "parents":
      return ["parent", "general_manager"];
    default:
      return [];
  }
}
