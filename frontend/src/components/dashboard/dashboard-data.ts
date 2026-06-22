export type DashboardPageKey = string;

export type DashboardCard = {
  title: string;
  value: number | null;
  detail: string;
  icon: string;
};

export type DashboardMenuItem = {
  key: DashboardPageKey;
  label: string;
  href: string;
  icon: string;
  description: string;
  emptyText: string;
};

export type DashboardPageData = {
  eyebrow: string;
  title: string;
  description: string;
  currentPath: string;
  accent: string;
  menu: DashboardMenuItem[];
  cards: DashboardCard[];
};

const emptyDetail = "موردی برای نمایش وجود ندارد.";

export const dashboardPages = {
  admin: {
    eyebrow: "پنل مدیریت",
    title: "خوش آمدید",
    description: "اطلاعات مدیریتی مجموعه در این بخش نمایش داده می‌شود.",
    currentPath: "/admin",
    accent: "مدیریت مجموعه",
    menu: [
      { key: "overview", label: "داشبورد", href: "/admin", icon: "⌂", description: "نمای کلی پنل در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "requests", label: "درخواست‌ها", href: "/admin/requests", icon: "□", description: "درخواست‌های ثبت‌شده در این بخش نمایش داده می‌شوند.", emptyText: "درخواستی برای نمایش وجود ندارد." },
      { key: "content", label: "محتوا", href: "/admin/content", icon: "▦", description: "محتوای ثبت‌شده در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/admin/messages", icon: "✉", description: "پیام‌های ثبت‌شده در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "settings", label: "تنظیمات", href: "/admin/settings", icon: "⚙", description: "تنظیمات پنل در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "درخواست‌ها", value: null, detail: emptyDetail, icon: "□" },
      { title: "محتوا", value: null, detail: emptyDetail, icon: "▦" },
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
      { title: "واحدها", value: null, detail: emptyDetail, icon: "▤" },
    ],
  },
  unitManager: {
    eyebrow: "پنل واحد",
    title: "خوش آمدید",
    description: "اطلاعات مربوط به واحد آموزشی در این بخش نمایش داده می‌شود.",
    currentPath: "/unit-manager",
    accent: "مدیریت واحد آموزشی",
    menu: [
      { key: "overview", label: "داشبورد", href: "/unit-manager", icon: "⌂", description: "نمای کلی پنل واحد در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "requests", label: "درخواست‌ها", href: "/unit-manager/requests", icon: "□", description: "درخواست‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "درخواستی برای نمایش وجود ندارد." },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/unit-manager/announcements", icon: "▤", description: "اطلاعیه‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "اطلاعیه‌ای برای نمایش وجود ندارد." },
      { key: "content", label: "محتوا", href: "/unit-manager/content", icon: "▦", description: "محتوای واحد در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/unit-manager/messages", icon: "✉", description: "پیام‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
    ],
    cards: [
      { title: "درخواست‌ها", value: null, detail: emptyDetail, icon: "□" },
      { title: "اطلاعیه‌ها", value: null, detail: emptyDetail, icon: "▤" },
      { title: "محتوا", value: null, detail: emptyDetail, icon: "▦" },
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
    ],
  },
  media: {
    eyebrow: "پنل رسانه",
    title: "خوش آمدید",
    description: "محتوای رسانه‌ای واحد آموزشی در این بخش مدیریت می‌شود.",
    currentPath: "/media",
    accent: "مدیریت رسانه واحد",
    menu: [
      { key: "overview", label: "داشبورد", href: "/media", icon: "⌂", description: "نمای کلی پنل رسانه در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "gallery", label: "گالری", href: "/media/gallery", icon: "▧", description: "تصاویر واحد در این بخش نمایش داده می‌شوند.", emptyText: "تصویری برای نمایش وجود ندارد." },
      { key: "news", label: "خبرها", href: "/media/news", icon: "▦", description: "خبرهای واحد در این بخش نمایش داده می‌شوند.", emptyText: "خبری برای نمایش وجود ندارد." },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/media/announcements", icon: "▤", description: "اطلاعیه‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "اطلاعیه‌ای برای نمایش وجود ندارد." },
      { key: "review", label: "بررسی", href: "/media/review", icon: "◇", description: "موارد قابل بررسی در این بخش نمایش داده می‌شوند.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "گالری", value: null, detail: emptyDetail, icon: "▧" },
      { title: "خبرها", value: null, detail: emptyDetail, icon: "▦" },
      { title: "اطلاعیه‌ها", value: null, detail: emptyDetail, icon: "▤" },
      { title: "بررسی", value: null, detail: emptyDetail, icon: "◇" },
    ],
  },
  parents: {
    eyebrow: "پنل والدین",
    title: "خوش آمدید",
    description: "اطلاعات مربوط به فرزند و پیام‌های مدرسه در این بخش نمایش داده می‌شود.",
    currentPath: "/parents",
    accent: "پنل والدین",
    menu: [
      { key: "overview", label: "داشبورد", href: "/parents", icon: "⌂", description: "نمای کلی پنل والدین در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/parents/messages", icon: "✉", description: "پیام‌ها در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/parents/announcements", icon: "▤", description: "اطلاعیه‌ها در این بخش نمایش داده می‌شوند.", emptyText: "اطلاعیه‌ای برای نمایش وجود ندارد." },
      { key: "requests", label: "درخواست‌ها", href: "/parents/requests", icon: "□", description: "درخواست‌ها در این بخش نمایش داده می‌شوند.", emptyText: "درخواستی برای نمایش وجود ندارد." },
      { key: "profile", label: "پرونده", href: "/parents/profile", icon: "◇", description: "اطلاعات پرونده در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
      { title: "اطلاعیه‌ها", value: null, detail: emptyDetail, icon: "▤" },
      { title: "درخواست‌ها", value: null, detail: emptyDetail, icon: "□" },
      { title: "پرونده", value: null, detail: emptyDetail, icon: "◇" },
    ],
  },
} satisfies Record<string, DashboardPageData>;
