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
    role: "unit_manager",
    title: "مدیر واحد",
    description: "مدیریت یک واحد آموزشی، کلاس‌ها، کارکنان، دانش‌آموزان و اطلاعیه‌های همان واحد",
    dashboardPath: "/dashboard/unit-manager",
    canSeeAllUnits: false,
    canManageOwnUnit: true,
    canPublishOwnUnitContent: true,
    canReviewAllContent: false,
    canSeeOwnChildren: false,
  },
  {
    role: "unit_media",
    title: "همکار رسانه",
    description: "مدیریت خبر، اطلاعیه، گالری و پوشش رسانه‌ای مربوط به واحد خودش",
    dashboardPath: "/dashboard/media",
    canSeeAllUnits: false,
    canManageOwnUnit: false,
    canPublishOwnUnitContent: true,
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
  "/dashboard/unit-manager",
  "/dashboard/media",
  "/dashboard/parents",
] as const;
