import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { DashboardResponse } from "@/types/api";

export function getGeneralManagerDashboard(token?: string) {
  return apiRequest<DashboardResponse>(apiEndpoints.dashboard.generalManager, { token });
}

export function getUnitManagerDashboard(token?: string) {
  return apiRequest<DashboardResponse>(apiEndpoints.dashboard.unitManager, { token });
}

export function getMediaDashboard(token?: string) {
  return apiRequest<DashboardResponse>(apiEndpoints.dashboard.media, { token });
}

export function getParentsDashboard(token?: string) {
  return apiRequest<DashboardResponse>(apiEndpoints.dashboard.parents, { token });
}
