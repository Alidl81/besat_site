// انواع مشترک دامنه مدرسه بعثت — آماده اتصال به بک‌اند
// تمام موجودیت‌ها snake_case هستند تا با DRF هماهنگ باشند.

export type EntityId = string;

export type PublishStatus = "draft" | "waiting_review" | "published" | "rejected";

export type ContentScope = "school" | "unit";

export type AccountRole = "general_manager" | "unit_manager" | "unit_media" | "parent";

// واحد آموزشی
export type UnitKind =
  | "preschool"
  | "elementary"
  | "middle_school"
  | "high_school";

export type UnitGender = "boys" | "girls" | "mixed";

export type SchoolUnitRecord = {
  id: EntityId;
  title: string;
  slug: string;
  kind: UnitKind;
  gender: UnitGender;
  description: string | null;
  cover_image: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

// دپارتمان
export type DepartmentRecord = {
  id: EntityId;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

// کاربر
export type UserRecord = {
  id: EntityId;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: AccountRole;
  unit_id: EntityId | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// محتوای رسانه‌ای (خبر/اطلاعیه)
export type ContentKind = "news" | "announcement";

export type ContentRecord = {
  id: EntityId;
  kind: ContentKind;
  title: string;
  slug: string;
  summary: string | null;
  body_html: string;
  cover_image: string | null;
  scope: ContentScope;
  unit_id: EntityId | null;
  category: string | null;
  status: PublishStatus;
  author_role: AccountRole | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

// آیتم گالری
export type GalleryItemRecord = {
  id: EntityId;
  title: string;
  image: string;
  album: string | null;
  scope: ContentScope;
  unit_id: EntityId | null;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
};


// افتخار واحد یا مدرسه
export type AchievementRecord = {
  id: EntityId;
  title: string;
  description: string | null;
  image: string | null;
  scope: ContentScope;
  unit_id: EntityId | null;
  status: PublishStatus;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
};
// اسلاید صفحه اصلی
export type HomeSlideRecord = {
  id: EntityId;
  image: string;
  title: string | null;
  subtitle: string | null;
  href: string | null;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

// درخواست ثبت‌نام
export type RegistrationRequestRecord = {
  id: EntityId;
  full_name: string;
  parent_phone: string;
  requested_grade: string;
  description: string | null;
  unit_id: EntityId | null;
  status: "new" | "reviewing" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
};

// پیام تماس
export type ContactMessageRecord = {
  id: EntityId;
  name: string;
  phone: string;
  email: string | null;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

// دانش‌آموز (برای والدین / مدیر واحد)
export type StudentRecord = {
  id: EntityId;
  full_name: string;
  national_code: string | null;
  unit_id: EntityId | null;
  class_title: string | null;
  parent_id: EntityId | null;
  created_at: string;
  updated_at: string;
};

// کلاس
export type ClassRecord = {
  id: EntityId;
  title: string;
  unit_id: EntityId | null;
  grade: string | null;
  capacity: number | null;
  created_at: string;
  updated_at: string;
};

// کارمند/کادر
export type StaffRecord = {
  id: EntityId;
  full_name: string;
  role_title: string;
  unit_id: EntityId | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

// برنامه (program)
export type ProgramRecord = {
  id: EntityId;
  title: string;
  description: string | null;
  unit_id: EntityId | null;
  date: string | null;
  created_at: string;
  updated_at: string;
};

// صفحات ایستا قابل ویرایش توسط مدیرکل (مثل درباره ما)
export type StaticPageRecord = {
  id: EntityId;
  slug: string;          // مثلاً "about"
  title: string;
  body_html: string;
  meta_description: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

// پیام داخلی بین کاربران سیستم
export type InternalMessageRecord = {
  id: EntityId;
  // ارسال‌کننده
  sender_id: EntityId | null;
  sender_name: string;
  sender_role: AccountRole;
  // گیرنده
  recipient_id: EntityId | null;
  recipient_name: string;
  recipient_role: AccountRole | null;
  // محتوا
  subject: string;
  body: string;
  // وضعیت
  is_read: boolean;
  unit_id: EntityId | null;
  created_at: string;
  updated_at: string;
};

// payload عمومی برای create/update (بدون فیلدهای سیستمی)
export type WithoutSystemFields<T> = Omit<T, "id" | "created_at" | "updated_at">;
