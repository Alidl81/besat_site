import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";

export type RegistrationInfo = {
  title: string | null;
  description: string | null;
  is_open: boolean;
};

export function getRegistrationInfo() {
  return apiRequest<RegistrationInfo>(apiEndpoints.registration);
}
