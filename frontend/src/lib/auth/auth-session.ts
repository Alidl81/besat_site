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

// AUTH-FE-CROSS-TAB-SESSION-CHANNEL-001: this display cache lives in
// localStorage, not sessionStorage. sessionStorage is scoped per top-level
// browsing context (tab) and never fires the native `storage` event in
// OTHER tabs -- it isn't shared at all, so the storage listeners in
// site-auth-actions.tsx/dashboard-guard.tsx could only ever have reacted to
// a change made within the SAME tab, never a genuine logout/login in
// another tab, even though they were written to expect exactly that.
// localStorage is the browser-native mechanism for this: writing here
// fires `storage` in every OTHER same-origin tab automatically. This holds
// no secret -- BesatSession is display metadata only (username, full
// name, role, redirect path, unit id); the actual auth tokens never touch
// client JS at all, living only in HttpOnly cookies the BFF routes manage
// server-side. A stale localStorage display value is self-healing: the
// next getCurrentUser() call (already run by every consumer of this
// module) fails against the real cookie and clears it via
// clearBesatSession(), same as it always has for a stale sessionStorage
// value.
function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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
    const raw = window.localStorage.getItem(displayKey);
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
  window.localStorage.setItem(displayKey, JSON.stringify(session));
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function clearBesatSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(displayKey);
  removeLegacyCredentialStorage();
  window.dispatchEvent(new Event("besat-auth-changed"));
}

export function getBesatSessionDisplayName(session: BesatSession) {
  return session.fullName || session.username || "حساب کاربری";
}

export function redirectPathForRole(role: BesatRole): string {
  switch (role) {
    case "general_manager":
      return "/dashboard/admin";
    // Every "admin" menu item is general_manager-only (see
    // dashboard-data.ts) -- a unit_manager landing there saw only the
    // three items that happen to carry no role restriction at all
    // (Dashboard/Calendar/Profile) and no way to reach their actual
    // permitted workflows. "content-manager" is the shell whose menu
    // items are actually open to unit_manager.
    case "unit_manager":
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
      return ["general_manager"];
    case "content-manager":
      return ["general_manager", "unit_manager", "unit_media"];
    case "parents":
      return ["parent"];
    default:
      return [];
  }
}
