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
  roleTitle: string;
  menu: DashboardMenuItem[];
  cards: DashboardCard[];
};

const emptyDetail = "موردی برای نمایش وجود ندارد.";

export const dashboardPages = {
  admin: {
    eyebrow: "پنل مدیریت",
    title: "خوش آمدید",
    description: "اطلاعات مدیریتی مجموعه در این بخش نمایش داده می‌شود.",
    currentPath: "/dashboard/admin",
    accent: "مدیریت مجموعه",
    roleTitle: "مدیر کل",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/admin", icon: "⌂", description: "نمای کلی پنل در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "units", label: "واحدها", href: "/dashboard/admin/units", icon: "▥", description: "واحدهای آموزشی مجموعه در این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "departments", label: "دپارتمان‌ها", href: "/dashboard/admin/departments", icon: "◈", description: "دپارتمان‌ها و گروه‌های تخصصی مجموعه از این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "users", label: "کاربران", href: "/dashboard/admin/users", icon: "♙", description: "کاربران ثبت‌شده در این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "content", label: "اخبار و اطلاعیه‌ها", href: "/dashboard/admin/content", icon: "▦", description: "محتوای ثبت‌شده در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "gallery", label: "گالری", href: "/dashboard/admin/gallery", icon: "▧", description: "تصاویر و گالری مدرسه در این بخش مدیریت می‌شوند.", emptyText: "تصویری برای نمایش وجود ندارد." },
      { key: "home-slider", label: "اسلایدر خانه", href: "/dashboard/admin/home-slider", icon: "◫", description: "اسلایدهای صفحه اصلی سایت از این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "registrations", label: "ثبت‌نام‌ها", href: "/dashboard/admin/registrations", icon: "▤", description: "درخواست‌های ثبت‌نام در این بخش نمایش داده می‌شوند.", emptyText: "درخواست ثبت‌نامی برای نمایش وجود ندارد." },
      { key: "messages", label: "پیام‌ها", href: "/dashboard/admin/messages", icon: "✉", description: "پیام‌های ثبت‌شده در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "pages", label: "مدیریت صفحات", href: "/dashboard/admin/pages", icon: "📄", description: "صفحات ایستای سایت (درباره ما، ...) از این بخش ویرایش می‌شوند.", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/admin/profile", icon: "◇", description: "اطلاعات پروفایل کاربری در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "واحدها", value: null, detail: emptyDetail, icon: "▥" },
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
      { title: "محتوا", value: null, detail: emptyDetail, icon: "▦" },
      { title: "ثبت‌نام‌ها", value: null, detail: emptyDetail, icon: "▤" },
    ],
  },
  unitManager: {
    eyebrow: "پنل مدیریت واحد",
    title: "خوش آمدید",
    description: "اطلاعات مربوط به واحد آموزشی در این بخش نمایش داده می‌شود.",
    currentPath: "/dashboard/unit-manager",
    accent: "مدیریت واحد آموزشی",
    roleTitle: "مدیر واحد",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/unit-manager", icon: "⌂", description: "نمای کلی پنل واحد در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "classes", label: "کلاس‌ها", href: "/dashboard/unit-manager/classes", icon: "□", description: "کلاس‌های واحد آموزشی در این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "students", label: "دانش‌آموزان", href: "/dashboard/unit-manager/students", icon: "♙", description: "فهرست دانش‌آموزان واحد در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "staff", label: "کارکنان", href: "/dashboard/unit-manager/staff", icon: "♟", description: "کارکنان واحد آموزشی در این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "attendance", label: "حضور و غیاب", href: "/dashboard/unit-manager/attendance", icon: "▤", description: "گزارش حضور و غیاب در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "programs", label: "برنامه‌ها", href: "/dashboard/unit-manager/programs", icon: "▦", description: "برنامه‌های آموزشی واحد در این بخش نمایش داده می‌شوند.", emptyText: emptyDetail },
      { key: "content", label: "اخبار و اطلاعیه‌ها", href: "/dashboard/unit-manager/content", icon: "▦", description: "محتوای واحد در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/dashboard/unit-manager/messages", icon: "✉", description: "پیام‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "profile", label: "پروفایل", href: "/dashboard/unit-manager/profile", icon: "◇", description: "اطلاعات پروفایل کاربری در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "دانش‌آموزان", value: null, detail: emptyDetail, icon: "♙" },
      { title: "کارکنان", value: null, detail: emptyDetail, icon: "♟" },
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
      { title: "برنامه‌ها", value: null, detail: emptyDetail, icon: "▦" },
    ],
  },
  media: {
    eyebrow: "پنل رسانه",
    title: "خوش آمدید",
    description: "محتوای رسانه‌ای واحد آموزشی در این بخش مدیریت می‌شود.",
    currentPath: "/dashboard/media",
    accent: "مدیریت رسانه واحد",
    roleTitle: "همکار رسانه",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/media", icon: "⌂", description: "نمای کلی پنل رسانه در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "news", label: "اخبار", href: "/dashboard/media/news", icon: "▦", description: "خبرهای واحد در این بخش نمایش داده می‌شوند.", emptyText: "خبری برای نمایش وجود ندارد." },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/dashboard/media/announcements", icon: "▤", description: "اطلاعیه‌های واحد در این بخش نمایش داده می‌شوند.", emptyText: "اطلاعیه‌ای برای نمایش وجود ندارد." },
      { key: "gallery", label: "گالری", href: "/dashboard/media/gallery", icon: "▧", description: "تصاویر واحد در این بخش نمایش داده می‌شوند.", emptyText: "تصویری برای نمایش وجود ندارد." },
      { key: "albums", label: "آلبوم‌ها", href: "/dashboard/media/albums", icon: "▨", description: "آلبوم‌های واحد در این بخش مدیریت می‌شوند.", emptyText: emptyDetail },
      { key: "review", label: "بررسی محتوا", href: "/dashboard/media/review", icon: "◉", description: "موارد قابل بررسی در این بخش نمایش داده می‌شوند.", emptyText: emptyDetail },
      { key: "messages", label: "پیام‌ها", href: "/dashboard/media/messages", icon: "✉", description: "پیام‌ها در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "profile", label: "پروفایل", href: "/dashboard/media/profile", icon: "◇", description: "اطلاعات پروفایل کاربری در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "اخبار", value: null, detail: emptyDetail, icon: "▦" },
      { title: "گالری", value: null, detail: emptyDetail, icon: "▧" },
      { title: "پیش‌نویس‌ها", value: null, detail: emptyDetail, icon: "✎" },
      { title: "آماده انتشار", value: null, detail: emptyDetail, icon: "✓" },
    ],
  },
  parents: {
    eyebrow: "پنل والدین",
    title: "خوش آمدید",
    description: "اطلاعات مربوط به فرزند و پیام‌های مدرسه در این بخش نمایش داده می‌شود.",
    currentPath: "/dashboard/parents",
    accent: "پنل خانواده",
    roleTitle: "والدین",
    menu: [
      { key: "overview", label: "داشبورد", href: "/dashboard/parents", icon: "⌂", description: "نمای کلی پنل والدین در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "children", label: "فرزندان من", href: "/dashboard/parents/children", icon: "♙", description: "اطلاعات فرزندان در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
      { key: "programs", label: "برنامه‌ها", href: "/dashboard/parents/programs", icon: "▦", description: "برنامه‌های آموزشی فرزند در این بخش نمایش داده می‌شوند.", emptyText: emptyDetail },
      { key: "announcements", label: "اطلاعیه‌ها", href: "/dashboard/parents/announcements", icon: "▤", description: "اطلاعیه‌ها در این بخش نمایش داده می‌شوند.", emptyText: "اطلاعیه‌ای برای نمایش وجود ندارد." },
      { key: "gallery", label: "گالری", href: "/dashboard/parents/gallery", icon: "▨", description: "گالری واحد فرزند در این بخش نمایش داده می‌شود.", emptyText: "تصویری برای نمایش وجود ندارد." },
      { key: "messages", label: "پیام‌ها", href: "/dashboard/parents/messages", icon: "✉", description: "پیام‌ها در این بخش نمایش داده می‌شوند.", emptyText: "پیامی برای نمایش وجود ندارد." },
      { key: "registration", label: "ثبت‌نام", href: "/dashboard/parents/registration", icon: "▤", description: "درخواست‌های ثبت‌نام در این بخش نمایش داده می‌شوند.", emptyText: emptyDetail },
      { key: "profile", label: "پروفایل", href: "/dashboard/parents/profile", icon: "◇", description: "اطلاعات پروفایل کاربری در این بخش نمایش داده می‌شود.", emptyText: emptyDetail },
    ],
    cards: [
      { title: "فرزندان من", value: null, detail: emptyDetail, icon: "♙" },
      { title: "پیام‌ها", value: null, detail: emptyDetail, icon: "✉" },
      { title: "برنامه امروز", value: null, detail: emptyDetail, icon: "▦" },
      { title: "اطلاعیه‌ها", value: null, detail: emptyDetail, icon: "▤" },
    ],
  },
} satisfies Record<string, DashboardPageData>;
