import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { CurrentUser, SchoolUnit, UserPermissions } from "@/types/api";

export function getCurrentUser(token?: string) {
  return apiRequest<CurrentUser>(apiEndpoints.me, { token });
}

export function getMyPermissions(token?: string) {
  return apiRequest<UserPermissions>(apiEndpoints.myPermissions, { token });
}

export function getMyUnits(token?: string) {
  return apiRequest<SchoolUnit[]>(apiEndpoints.myUnits, { token });
}
