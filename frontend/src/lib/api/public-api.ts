import { apiRequest } from "@/lib/api/client";

export type SiteSettings = {
  school_name?: string | null;
  slogan?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type SchoolUnit = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
};

export type Department = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
};

export type NewsCategory = {
  id: number;
  title: string;
  slug: string;
};

export type NewsItem = {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  image?: string | null;
  category?: NewsCategory | null;
  published_at?: string | null;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function getSiteSettings() {
  return apiRequest<SiteSettings>("site-settings/", {
    next: { revalidate: 300 },
  });
}

export function getUnits() {
  return apiRequest<SchoolUnit[] | PaginatedResponse<SchoolUnit>>("units/", {
    next: { revalidate: 300 },
  });
}

export function getUnitBySlug(slug: string) {
  return apiRequest<SchoolUnit>(`units/${slug}/`, {
    next: { revalidate: 300 },
  });
}

export function getDepartments() {
  return apiRequest<Department[] | PaginatedResponse<Department>>("departments/", {
    next: { revalidate: 300 },
  });
}

export function getDepartmentBySlug(slug: string) {
  return apiRequest<Department>(`departments/${slug}/`, {
    next: { revalidate: 300 },
  });
}

export function getNews() {
  return apiRequest<NewsItem[] | PaginatedResponse<NewsItem>>("news/", {
    next: { revalidate: 120 },
  });
}

export function getNewsBySlug(slug: string) {
  return apiRequest<NewsItem>(`news/${slug}/`, {
    next: { revalidate: 120 },
  });
}

export function getNewsCategories() {
  return apiRequest<NewsCategory[] | PaginatedResponse<NewsCategory>>("news/categories/", {
    next: { revalidate: 300 },
  });
}
