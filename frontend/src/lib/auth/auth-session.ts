export type BesatSession = {
  accessToken: string;
  refreshToken: string;
  username: string;
  fullName: string | null;
  role: string;
  redirectPath: string;
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

  const fallbackRedirectPath = window.localStorage.getItem(redirectPathKey) || "/admin";
  const fallbackRole = window.localStorage.getItem(userRoleKey) || "";

  try {
    const rawUser = window.localStorage.getItem(userKey);

    if (rawUser) {
      const user = JSON.parse(rawUser) as {
        username?: string;
        fullName?: string | null;
        role?: string;
        redirectPath?: string;
      };

      return {
        accessToken,
        refreshToken,
        username: user.username || "",
        fullName: user.fullName || null,
        role: user.role || fallbackRole,
        redirectPath: user.redirectPath || fallbackRedirectPath,
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
