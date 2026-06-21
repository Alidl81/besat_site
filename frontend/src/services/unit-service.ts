import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse, SchoolUnit, UnitScopedContent } from "@/types/api";

export function getUnits() {
  return apiRequest<ApiListResponse<SchoolUnit>>(apiEndpoints.units);
}

export function getUnitBySlug(slug: string) {
  return apiRequest<SchoolUnit>(`${apiEndpoints.units}${slug}/`);
}

export function getUnitNews(unitId: string | number) {
  return apiRequest<ApiListResponse<UnitScopedContent>>(
    `${apiEndpoints.content}?scope=unit&unit_id=${unitId}&type=news&status=published`,
  );
}

export function getUnitAnnouncements(unitId: string | number) {
  return apiRequest<ApiListResponse<UnitScopedContent>>(
    `${apiEndpoints.content}?scope=unit&unit_id=${unitId}&type=announcement&status=published`,
  );
}

export function getUnitGallery(unitId: string | number) {
  return apiRequest<ApiListResponse<UnitScopedContent>>(
    `${apiEndpoints.content}?scope=unit&unit_id=${unitId}&type=gallery&status=published`,
  );
}
