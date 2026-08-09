import type { ApiId, ApiListResponse, ContentScope } from "@/types/api";

export type PublicUnitBrief = {
  id: number;
  title: string;
  slug: string;
};

export type PublicCategory = {
  id?: number;
  title: string;
  slug: string;
};

export type PublicNewsItem = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  cover_image: string | null;
  image?: string | null;
  content?: string | null;
  published_at: string;
  category: PublicCategory | null;
  scope: ContentScope;
  unit: PublicUnitBrief | null;
  status: "published";
  is_featured: boolean;
  is_important: boolean;
  priority: number;
  is_published: true;
};

export type PublicNewsDetail = PublicNewsItem & {
  body_html?: string | null;
  body_json?: Record<string, unknown> | null;
  content_json: {
    time?: number;
    version?: string;
    blocks?: Array<{
      id?: string;
      type: string;
      data: Record<string, unknown>;
    }>;
  };
};

export type PublicHomeSlide = {
  id: number;
  title: string | null;
  subtitle: string | null;
  image: string;
  alt_text: string | null;
  href: string | null;
  is_active: boolean;
  order: number;
};

export type PublicDepartment = {
  id: number;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  icon: string | null;
  cover_image: string | null;
};

export type PublicGalleryItem = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  image: string | null;
  album: string | null;
  alt_text: string | null;
  caption: string | null;
  event_date: string | null;
  published_at: string;
  scope: ContentScope;
  unit_id: number | null;
  unit: PublicUnitBrief | null;
  status: "published";
  is_featured: boolean;
  is_published: true;
};

export type PublicAchievement = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  cover_image: string | null;
  image: string | null;
  achievement_date: string | null;
  achieved_at: string | null;
  related_unit: PublicUnitBrief | null;
  unit_id: number | null;
  scope: ContentScope;
  status: "published";
  is_featured: boolean;
};

export type PublicSchoolUnit = {
  id: number;
  title: string;
  slug: string;
  kind: "preschool" | "elementary" | "middle_school" | "high_school";
  gender: "boys" | "girls" | "mixed";
  subtitle: string | null;
  description: string | null;
  cover_image: string | null;
  icon: string | null;
  age_range: string | null;
  grade_range: string | null;
  address: string | null;
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  office_hours: string | null;
  map_url: string | null;
  latitude: string | null;
  longitude: string | null;
  accepts_registration: boolean;
};

export type AboutPerson = {
  name: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
};

export type AboutImage = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

export type AboutInfo = {
  title: string | null;
  description: string | null;
  image: string | null;
  meta_description: string | null;
  history: string | null;
  founders: AboutPerson[];
  key_people: AboutPerson[];
  mission: string | null;
  values: string[];
  goals: string[];
  images: AboutImage[];
  video_url: string | null;
  video_poster_url: string | null;
  video_title: string | null;
  video_description: string | null;
  video_caption: string | null;
};

export type ContactInfo = {
  title: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  working_hours: string | null;
  map_url: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type RegistrationInfo = {
  title: string;
  description: string | null;
  is_open: boolean;
  open_message: string | null;
  closed_message: string | null;
  required_documents: string[];
  notes: string | null;
};

export type PublicSiteSettings = {
  school_name: string | null;
  short_name: string | null;
  slogan: string | null;
  intro_text: string | null;
  logo: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  address: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email: string | null;
  working_hours: string | null;
  instagram_url: string | null;
  telegram_url: string | null;
  eitaa_url: string | null;
};

export type PublicList<T> = ApiListResponse<T>;

export type ContactMessagePayload = {
  full_name: string;
  phone?: string;
  email?: string;
  related_unit?: ApiId | null;
  message_type: "general" | "criticism" | "suggestion" | "complaint" | "feedback";
  subject?: string;
  message: string;
};
