import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";
import type {
  AboutInfo,
  ContactInfo,
  ContactMessagePayload,
  PublicAchievement,
  PublicDepartment,
  PublicGalleryItem,
  PublicHomeSlide,
  PublicNewsDetail,
  PublicNewsItem,
  PublicSchoolUnit,
  PublicSiteSettings,
  RegistrationInfo,
} from "@/types/public-content";

type Scalar = string | number | boolean | null | undefined;

function withQuery(endpoint: string, query: Record<string, Scalar>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `${endpoint}?${encoded}` : endpoint;
}

export function getPublicNews(query: Record<string, Scalar> = {}) {
  return apiRequest<ApiListResponse<PublicNewsItem>>(
    withQuery(apiEndpoints.news, query),
  );
}

export function getPublicNewsDetail(slug: string) {
  return apiRequest<PublicNewsDetail>(
    `${apiEndpoints.news}${encodeURIComponent(slug)}/`,
  );
}

export function getPublicGallery(query: Record<string, Scalar> = {}) {
  return apiRequest<ApiListResponse<PublicGalleryItem>>(
    withQuery(apiEndpoints.gallery, query),
  );
}

export function getPublicAchievements(query: Record<string, Scalar> = {}) {
  return apiRequest<ApiListResponse<PublicAchievement>>(
    withQuery(apiEndpoints.achievements, query),
  );
}

export function getPublicAchievement(slug: string) {
  return apiRequest<PublicAchievement>(
    `${apiEndpoints.achievements}${encodeURIComponent(slug)}/`,
  );
}

export async function getPublicUnits() {
  const response = await apiRequest<
    PublicSchoolUnit[] | ApiListResponse<PublicSchoolUnit>
  >(apiEndpoints.units);
  return Array.isArray(response) ? response : response.results;
}

export async function getPublicDepartments() {
  const response = await apiRequest<
    PublicDepartment[] | ApiListResponse<PublicDepartment>
  >(apiEndpoints.departments);
  return Array.isArray(response) ? response : response.results;
}

export function getPublicHomeSlides() {
  return apiRequest<PublicHomeSlide[]>("home/slides/");
}

export function getPublicUnit(slug: string) {
  return apiRequest<PublicSchoolUnit>(
    `${apiEndpoints.units}${encodeURIComponent(slug)}/`,
  );
}

export function getAboutInfo() {
  return apiRequest<AboutInfo>(apiEndpoints.about);
}

export function getContactInfo() {
  return apiRequest<ContactInfo>(apiEndpoints.contact);
}

export function submitContactMessage(payload: ContactMessagePayload) {
  return apiRequest<{ message: string }>(apiEndpoints.messages, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRegistrationInfo() {
  return apiRequest<RegistrationInfo>(apiEndpoints.registration);
}

export function getPublicSiteSettings() {
  return apiRequest<PublicSiteSettings>(apiEndpoints.siteSettings);
}
