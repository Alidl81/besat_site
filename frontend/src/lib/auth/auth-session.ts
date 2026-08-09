export type BesatRole = "general_manager" | "unit_manager" | "unit_media" | "parent" | string;

export type BesatSession = {
  username: string;
  fullName: string | null;
  role: BesatRole;
  redirectPath: string;
  unitId: string | null;
};

type SessionUser = {
  username?: string;
  full_name?: string | null;
  fullName?: string | null;
  role?: string;
  redirect_path?: string;
  redirectPath?: string;
  unit_id?: string | number | null;
  unitId?: string | number | null;
};

const displayKey = "besat_session_display";
const legacyKeys = [
  "besat_access_token",
  "besat_refresh_token",
  "besat_user_role",
  "besat_redirect_path",
  "besat_user",
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function removeLegacyCredentialStorage() {
  if (typeof window === "undefined") return;
  for (const key of legacyKeys) window.localStorage.removeItem(key);
}

export function sessionFromUser(user: SessionUser): BesatSession {
  return {
    username: user.username ?? "",
    fullName: user.full_name ?? user.fullName ?? null,
    role: user.role ?? "",
    redirectPath:
      user.redirect_path ?? user.redirectPath ?? redirectPathForRole(user.role ?? ""),
    unitId:
      user.unit_id === null || user.unit_id === undefined
        ? user.unitId === null || user.unitId === undefined
          ? null
          : String(user.unitId)
        : String(user.unit_id),
  };
}

export function readBesatSession(): BesatSession | null {
  if (!canUseStorage()) return null;
  removeLegacyCredentialStorage();

  try {
    const raw = window.sessionStorage.getItem(displayKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed.role) return null;
    return sessionFromUser(parsed);
  } catch {
    return null;
  }
}

export function writeBesatSession(session: BesatSession) {
  if (!canUseStorage()) return;
  removeLegacyCredentialStorage();
  window.sessionStorage.setItem(displayKey, JSON.stringify(session));
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function clearBesatSession() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(displayKey);
  removeLegacyCredentialStorage();
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function getBesatSessionDisplayName(session: BesatSession) {
  return session.fullName || session.username || "حساب کاربری";
}

export function redirectPathForRole(role: BesatRole): string {
  switch (role) {
    case "general_manager":
    case "unit_manager":
      return "/dashboard/admin";
    case "unit_media":
      return "/dashboard/content-manager";
    case "parent":
      return "/dashboard/parents";
    default:
      return "/dashboard/admin";
  }
}

export function rolesForDashboardSegment(segment: string): BesatRole[] {
  switch (segment) {
    case "admin":
      return ["general_manager", "unit_manager"];
    case "content-manager":
      return ["general_manager", "unit_manager", "unit_media"];
    case "parents":
      return ["parent"];
    default:
      return [];
  }
}
