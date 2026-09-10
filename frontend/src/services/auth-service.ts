import { apiRequest, ApiError } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { hasSessionCookie } from "@/lib/auth/session-marker-cookie";
import type { CurrentUser, SchoolUnit, UserPermissions } from "@/types/api";

let pendingCurrentUserRequest: Promise<CurrentUser> | null = null;

export function getCurrentUser(token?: string) {
  // The public header mounts two SiteAuthActions instances (desktop +
  // mobile) plus DashboardGuard can be present at once, and each calls this
  // with no token on mount -- without sharing the in-flight request, a
  // signed-out visitor triggers multiple redundant /me 401 round-trips.
  if (token) {
    return apiRequest<CurrentUser>(apiEndpoints.me, { token });
  }
  // The real session cookies are HttpOnly (unreadable from here), but the
  // non-HttpOnly besat_has_session marker mirrors their presence. A fresh
  // guest never had it set, so skip the network round-trip -- and the red
  // 401 console error every browser logs for it -- instead of always
  // asking the backend just to find out there's no session.
  if (!hasSessionCookie()) {
    return Promise.reject(
      new ApiError({ message: "نشست فعالی وجود ندارد.", status: 401 }),
    );
  }
  if (!pendingCurrentUserRequest) {
    pendingCurrentUserRequest = apiRequest<CurrentUser>(apiEndpoints.me, { token }).finally(() => {
      pendingCurrentUserRequest = null;
    });
  }
  return pendingCurrentUserRequest;
}

export function getMyPermissions(token?: string) {
  return apiRequest<UserPermissions>(apiEndpoints.myPermissions, { token });
}

export function getMyUnits(token?: string) {
  return apiRequest<SchoolUnit[]>(apiEndpoints.myUnits, { token });
}
