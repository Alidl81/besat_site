import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";

export type AboutInfo = {
  title: string | null;
  description: string | null;
};

export function getAboutInfo() {
  return apiRequest<AboutInfo>(apiEndpoints.about);
}

