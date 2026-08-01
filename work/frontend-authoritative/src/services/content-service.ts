import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse, UnitScopedContent } from "@/types/api";

type ContentQuery = {
  scope?: "school" | "unit";
  unitId?: string | number;
  status?: string;
};

function toQueryString(query?: ContentQuery) {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  if (query.scope) {
    params.set("scope", query.scope);
  }

  if (query.unitId) {
    params.set("unit_id", String(query.unitId));
  }

  if (query.status) {
    params.set("status", query.status);
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : "";
}

export function getContentList(query?: ContentQuery, token?: string) {
  return apiRequest<ApiListResponse<UnitScopedContent>>(
    `${apiEndpoints.content}${toQueryString(query)}`,
    { token },
  );
}
