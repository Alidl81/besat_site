import type { PanelIconName } from "@/components/dashboard/panel-icons";

export type DashboardPageKey = string;

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
      { key: "announcements", label: "اطلاعیه‌ها", href: "/dashboard/admin/announcements", icon: "megaphone", description: "اطلاعیه‌های سراسری و واحدها", emptyText: emptyDetail },
      { key: "units", label: "واحدهای آموزشی", href: "/dashboard/admin/units", icon: "units", description: "مدیریت واحدهای آموزشی", emptyText: emptyDetail, dividerBefore: true },
      { key: "students", label: "دانش‌آموزان", href: "/dashboard/admin/students", icon: "students", description: "مدیریت اطلاعات، پرونده‌ها و وضعیت تحصیلی دانش‌آموزان", emptyText: emptyDetail },
      { key: "staff", label: "کادر آموزشی", href: "/dashboard/admin/staff", icon: "staff", description: "مدیریت کادر آموزشی و اداری", emptyText: emptyDetail },
      { key: "content", label: "مدیریت محتوا", href: "/dashboard/admin/content", icon: "file", description: "مدیریت و انتشار اخبار، اطلاعیه‌ها و محتوای سایت", emptyText: emptyDetail, dividerBefore: true },
      { key: "gallery", label: "گالری رسانه", href: "/dashboard/admin/gallery", icon: "image", description: "مدیریت تصاویر و آلبوم‌های مجموعه", emptyText: emptyDetail },
      { key: "pages", label: "مدیریت صفحات", href: "/dashboard/admin/pages", icon: "globe", description: "ویرایش صفحات ثابت سایت", emptyText: emptyDetail },
      { key: "registrations", label: "ثبت‌نام‌ها", href: "/dashboard/admin/registrations", icon: "registration", description: "مدیریت درخواست‌های ثبت‌نام و پیگیری وضعیت متقاضیان", emptyText: emptyDetail, dividerBefore: true },
      { key: "users", label: "کاربران و دسترسی‌ها", href: "/dashboard/admin/users", icon: "users", description: "مدیریت کاربران و سطح دسترسی", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها و ارتباطات", href: "/dashboard/admin/messages", icon: "message", description: "پیام‌های داخلی و ارتباطات", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/admin/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
    ],
    cards: [],
  },
  unitManager: {
    eyebrow: "پنل مدیریت واحد",
    title: "داشبورد مدیریت واحد",
    description: "نمای کلی اطلاعات جاری واحد آموزشی",
    currentPath: "/dashboard/unit-manager",
    accent: "مدیریت واحد آموزشی",
    roleTitle: "مدیر واحد",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/unit-manager", icon: "dashboard", description: "نمای کلی واحد", emptyText: emptyDetail },
      { key: "students", label: "دانش‌آموزان", href: "/dashboard/unit-manager/students", icon: "students", description: "مدیریت دانش‌آموزان واحد", emptyText: emptyDetail },
      { key: "staff", label: "کادر آموزشی", href: "/dashboard/unit-manager/staff", icon: "staff", description: "مدیریت کادر آموزشی واحد", emptyText: emptyDetail },
      { key: "content", label: "مدیریت محتوا", href: "/dashboard/unit-manager/content", icon: "file", description: "مدیریت محتوای واحد", emptyText: emptyDetail, dividerBefore: true },
      { key: "media", label: "گالری رسانه", href: "/dashboard/unit-manager/media", icon: "image", description: "رسانه‌های واحد", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها و ارتباطات", href: "/dashboard/unit-manager/messages", icon: "message", description: "پیام‌های واحد", emptyText: emptyDetail, dividerBefore: true },
      { key: "profile", label: "پروفایل", href: "/dashboard/unit-manager/profile", icon: "profile", description: "تنظیمات حساب", emptyText: emptyDetail },
    ],
    cards: [],
  },
  media: {
    eyebrow: "پنل رسانه",
    title: "داشبورد",
    description: "خوش آمدید؛ نمای کلی وضعیت رسانه‌ها و فعالیت‌ها",
    currentPath: "/dashboard/media",
    accent: "مدیریت رسانه واحد",
    roleTitle: "مسئول رسانه",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/media", icon: "dashboard", description: "نمای کلی فعالیت‌های رسانه", emptyText: emptyDetail },
      { key: "content", label: "مدیریت محتوا", href: "/dashboard/media/content", icon: "file", description: "مدیریت اخبار و اطلاعیه‌ها", emptyText: emptyDetail },
      { key: "news", label: "اخبار", href: "/dashboard/media/news", icon: "news", description: "اخبار واحد", emptyText: emptyDetail },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/dashboard/media/announcements", icon: "megaphone", description: "اطلاعیه‌های واحد", emptyText: emptyDetail },
      { key: "media", label: "کتابخانه رسانه", href: "/dashboard/media/media", icon: "media", description: "کتابخانه فایل‌های رسانه‌ای", emptyText: emptyDetail },
      { key: "albums", label: "گالری و آلبوم‌ها", href: "/dashboard/media/albums", icon: "albums", description: "آلبوم‌های تصویری واحد", emptyText: emptyDetail },
      { key: "review", label: "صف بررسی", href: "/dashboard/media/review", icon: "review", description: "محتواهای در انتظار بررسی", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها و ارتباطات", href: "/dashboard/media/messages", icon: "message", description: "پیام‌ها و هماهنگی‌های رسانه", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/media/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
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
      { key: "messages", label: "پیام‌ها", href: "/dashboard/parents/messages", icon: "message", description: "ارتباط با دبیران و مدرسه", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/parents/profile", icon: "profile", description: "تنظیمات حساب کاربری", emptyText: emptyDetail },
    ],
    cards: [],
  },
} satisfies Record<string, DashboardPageData>;
