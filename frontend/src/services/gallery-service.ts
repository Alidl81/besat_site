import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse, UnitScopedContent } from "@/types/api";

export function getPublicGallery() {
  return apiRequest<ApiListResponse<UnitScopedContent>>(
    `${apiEndpoints.gallery}?scope=school&status=published`,
  );
}
