import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";

export type ContactInfo = {
  address: string | null;
  phone: string | null;
  email: string | null;
  map_url: string | null;
};

export function getContactInfo() {
  return apiRequest<ContactInfo>(apiEndpoints.contact);
}
