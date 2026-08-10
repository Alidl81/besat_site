import type { DashboardAccessProfile } from "@/types/panel-access";

export const dashboardAccessProfiles: DashboardAccessProfile[] = [
  {
    role: "general_manager",
    title: "مدیر کل",
    description: "مدیریت مجموعه، واحدها، کاربران، محتوا و پیام‌ها",
    dashboardPath: "/dashboard/admin",
    canSeeAllUnits: true,
    canManageOwnUnit: false,
    canPublishOwnUnitContent: true,
    canReviewAllContent: true,
    canSeeOwnChildren: false,
  },
  {
    role: "unit_media",
    title: "همکار رسانه",
    description: "مدیریت خبر، اطلاعیه، گالری و پوشش رسانه‌ای مربوط به واحد خودش",
    dashboardPath: "/dashboard/content-manager",
    canSeeAllUnits: false,
    canManageOwnUnit: false,
    canPublishOwnUnitContent: false,
    canReviewAllContent: false,
    canSeeOwnChildren: false,
  },
  {
    role: "parent",
    title: "والدین",
    description: "مشاهده اطلاعات فرزندان، پیام‌ها، برنامه‌ها، اطلاعیه‌ها و درخواست‌های خانوادگی",
    dashboardPath: "/dashboard/parents",
    canSeeAllUnits: false,
    canManageOwnUnit: false,
    canPublishOwnUnitContent: false,
    canReviewAllContent: false,
    canSeeOwnChildren: true,
  },
];

export const unitScopedContentKinds = [
  "news",
  "announcement",
  "gallery",
  "event",
  "message",
  "registration_request",
] as const;

export const dashboardRoutes = [
  "/dashboard/admin",
  "/dashboard/content-manager",
  "/dashboard/parents",
] as const;
