import type { PanelIconName } from "@/components/dashboard/panel-icons";

export type DashboardPageKey = string;
export type DashboardMenuRole = "general_manager" | "unit_manager" | "unit_media" | "parent";

export type DashboardCard = {
  title: string;
  value: number | string | null;
  detail: string;
  icon: PanelIconName;
  tone?: "blue" | "amber" | "green" | "purple";
  trend?: string;
};

export type DashboardMenuItem = {
  key: DashboardPageKey;
  label: string;
  href: string;
  icon: PanelIconName;
  description: string;
  emptyText: string;
  dividerBefore?: boolean;
  roles?: DashboardMenuRole[];
};

export type DashboardPageData = {
  eyebrow: string;
  title: string;
  description: string;
  currentPath: string;
  accent: string;
  roleTitle: string;
  menu: DashboardMenuItem[];
  cards: DashboardCard[];
};

const emptyDetail = "موردی برای نمایش وجود ندارد.";

export const dashboardPages = {
  admin: {
    eyebrow: "پنل مدیریت",
    title: "داشبورد مدیریت",
    description: "نمای کلی اطلاعات جاری مجموعه آموزشی",
    currentPath: "/dashboard/admin",
    accent: "مدیریت مجموعه",
    roleTitle: "مدیر مجموعه",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/admin", icon: "dashboard", description: "نمای کلی مجموعه", emptyText: emptyDetail },
      { key: "events", label: "تقویم و رویدادها", href: "/dashboard/admin/events", icon: "calendar", description: "تقویم و رویدادهای مجموعه", emptyText: emptyDetail },
      { key: "settings", label: "تنظیمات مجموعه", href: "/dashboard/admin/settings", icon: "settings", description: "تنظیمات عملیاتی مجموعه", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "units", label: "واحدهای آموزشی", href: "/dashboard/admin/units", icon: "units", description: "مدیریت واحدهای آموزشی", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager"] },
      { key: "content", label: "مدیریت محتوا", href: "/dashboard/admin/content", icon: "file", description: "مدیریت خبرها و اطلاعیه‌ها", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager"] },
      { key: "gallery", label: "رسانه و گالری", href: "/dashboard/admin/gallery", icon: "albums", description: "مدیریت رسانه‌ها و آلبوم‌های تصویری", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "registrations", label: "ثبت‌نام‌ها", href: "/dashboard/admin/registrations", icon: "registration", description: "مدیریت درخواست‌های ثبت‌نام و پیگیری وضعیت متقاضیان", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager"] },
      { key: "users", label: "کاربران و دسترسی‌ها", href: "/dashboard/admin/users", icon: "users", description: "مدیریت کاربران و سطح دسترسی", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "shopProducts", label: "محصولات فروشگاه", href: "/dashboard/admin/shop/products", icon: "shop", description: "مدیریت محصولات، قیمت و موجودی", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager"] },
      { key: "shopCategories", label: "دسته‌بندی‌های فروشگاه", href: "/dashboard/admin/shop/categories", icon: "packageBox", description: "دسته‌بندی محصولات و دوره‌ها", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "shopOrders", label: "سفارش‌های فروشگاه", href: "/dashboard/admin/shop/orders", icon: "cash", description: "پردازش و پیگیری سفارش‌ها", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "shopShipping", label: "روش‌های ارسال", href: "/dashboard/admin/shop/shipping", icon: "truck", description: "روش‌ها و هزینه‌های ارسال", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "shopEnrollments", label: "ثبت‌نام دوره‌ها", href: "/dashboard/admin/shop/course-enrollments", icon: "graduationCap", description: "ثبت‌نام‌های دوره‌های فروشگاه", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "shopSettings", label: "تنظیمات فروشگاه", href: "/dashboard/admin/shop/settings", icon: "settings", description: "تنظیمات عملیاتی فروشگاه", emptyText: emptyDetail, roles: ["general_manager"] },
      { key: "messages", label: "پیام‌ها و ارتباطات", href: "/dashboard/admin/messages", icon: "message", description: "پیام‌های داخلی و ارتباطات", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager"] },
      { key: "profile", label: "پروفایل", href: "/dashboard/admin/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
    ],
    cards: [],
  },
  contentManager: {
    eyebrow: "پنل مدیریت محتوا",
    title: "داشبورد",
    description: "خوش آمدید؛ نمای کلی وضعیت رسانه‌ها و فعالیت‌ها",
    currentPath: "/dashboard/content-manager",
    accent: "مدیریت محتوا و رسانه",
    roleTitle: "مدیر محتوا",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/content-manager", icon: "dashboard", description: "نمای کلی فعالیت‌های محتوا و رسانه", emptyText: emptyDetail },
      { key: "content", label: "مدیریت محتوا", href: "/dashboard/content-manager/content", icon: "file", description: "مدیریت خبرها و اطلاعیه‌ها", emptyText: emptyDetail },
      { key: "news", label: "اخبار", href: "/dashboard/content-manager/news", icon: "news", description: "خبرهای واحد و مجموعه", emptyText: emptyDetail },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/dashboard/content-manager/announcements", icon: "megaphone", description: "اطلاعیه‌های واحد و مجموعه", emptyText: emptyDetail },
      { key: "calendar", label: "تقویم تحریریه", href: "/dashboard/content-manager/calendar", icon: "calendar", description: "زمان‌بندی رویدادها و انتشار محتوا", emptyText: emptyDetail },
      { key: "media", label: "کتابخانه رسانه", href: "/dashboard/content-manager/media", icon: "media", description: "کتابخانه فایل‌های رسانه‌ای", emptyText: emptyDetail, dividerBefore: true },
      { key: "albums", label: "گالری و آلبوم‌ها", href: "/dashboard/content-manager/albums", icon: "albums", description: "آلبوم‌های تصویری واحد", emptyText: emptyDetail },
      { key: "review", label: "صف بررسی", href: "/dashboard/content-manager/review", icon: "review", description: "محتواهای در انتظار بررسی", emptyText: emptyDetail },
      { key: "shopProducts", label: "محتوای محصولات فروشگاه", href: "/dashboard/content-manager/shop/products", icon: "shop", description: "ویرایش عنوان، توضیحات و تصاویر محصولات (بدون دسترسی مالی)", emptyText: emptyDetail, dividerBefore: true, roles: ["general_manager", "unit_media"] },
      { key: "messages", label: "پیام‌ها و ارتباطات", href: "/dashboard/content-manager/messages", icon: "message", description: "پیام‌ها و هماهنگی‌ها", emptyText: emptyDetail, dividerBefore: true },
      { key: "services", label: "خدمات نرم‌افزاری", href: "/dashboard/content-manager/services", icon: "services", description: "خدمات فعال برای نقش محتوا", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/content-manager/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
    ],
    cards: [],
  },
  parents: {
    eyebrow: "پنل والدین",
    title: "داشبورد والدین",
    description: "خلاصه وضعیت تحصیلی و فعالیت‌های فرزندان",
    currentPath: "/dashboard/parents",
    accent: "پنل خانواده",
    roleTitle: "والد",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/parents", icon: "dashboard", description: "نمای کلی وضعیت فرزند", emptyText: emptyDetail },
      { key: "children", label: "فرزندان من", href: "/dashboard/parents/children", icon: "children", description: "پرونده‌های فرزندان متصل به این حساب", emptyText: emptyDetail },
      { key: "programs", label: "برنامه‌ها", href: "/dashboard/parents/programs", icon: "programs", description: "برنامه‌های قابل مشاهده برای فرزندان", emptyText: emptyDetail },
      { key: "registration", label: "ثبت‌نام", href: "/dashboard/parents/registration", icon: "registration", description: "پیگیری درخواست‌های ثبت‌نام", emptyText: emptyDetail },
      { key: "services", label: "خدمات نرم‌افزاری", href: "/dashboard/parents/services", icon: "services", description: "خدمات فعال خانواده", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/dashboard/parents/messages", icon: "message", description: "ارتباط با دبیران و مدرسه", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/parents/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
    ],
    cards: [],
  },
} satisfies Record<string, DashboardPageData>;
