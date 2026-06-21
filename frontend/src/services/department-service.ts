import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";

export type DepartmentInfo = {
  id: string | number;
  title: string;
  description: string | null;
};

export function getDepartments() {
  return apiRequest<ApiListResponse<DepartmentInfo>>(apiEndpoints.departments);
}
