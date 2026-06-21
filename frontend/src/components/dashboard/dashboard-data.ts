export type DashboardPanelKey = "admin" | "unitManager" | "media" | "parents";

type DashboardNavItem = {
  label: string;
  href: string;
  icon: string;
};

type DashboardKpi = {
  title: string;
  value: string | null;
  detail: string;
  icon: string;
  tone: "green" | "blue" | "purple" | "orange";
};

type DashboardAction = {
  title: string;
  icon: string;
};

type DashboardRow = {
  title: string;
  meta: string;
  status?: string;
  tone?: "green" | "blue" | "purple" | "orange" | "red";
};

type DashboardPanel = {
  roleTitle: string;
  roleDescription: string;
  welcomeTitle: string;
  welcomeText: string;
  badge?: string;
  navItems: DashboardNavItem[];
  kpis: DashboardKpi[];
  actions: DashboardAction[];
  mainTitle: string;
  mainRows: DashboardRow[];
  sideTitle: string;
  sideRows: DashboardRow[];
  bottomTitle: string;
  bottomRows: DashboardRow[];
};

const emptyDetail = "داده‌ای برای نمایش وجود ندارد";

const sharedNav = {
  messages: { label: "پیام‌ها", href: "#", icon: "✉" },
  settings: { label: "تنظیمات", href: "#", icon: "⚙" },
};

export const dashboardPanels: Record<DashboardPanelKey, DashboardPanel> = {
  admin: {
    roleTitle: "مدیر کل",
    roleDescription: "پنل مدیریت مجموعه",
    welcomeTitle: "پنل مدیریت مجموعه",
    welcomeText: "در این بخش وضعیت واحدها، کاربران، درخواست‌ها، پیام‌ها و محتوای مجموعه نمایش داده می‌شود.",
    navItems: [
      { label: "داشبورد", href: "/dashboard/admin", icon: "⌂" },
      { label: "واحدها", href: "#", icon: "▥" },
      { label: "کاربران", href: "#", icon: "♙" },
      { label: "اخبار و اطلاعیه‌ها", href: "#", icon: "⌁" },
      { label: "گالری", href: "#", icon: "▧" },
      { label: "ثبت‌نام‌ها", href: "#", icon: "◴" },
      sharedNav.messages,
      sharedNav.settings,
    ],
    kpis: [
      { title: "واحدهای فعال", value: null, detail: emptyDetail, icon: "▥", tone: "green" },
      { title: "پیام‌های دریافتی", value: null, detail: emptyDetail, icon: "✉", tone: "blue" },
      { title: "محتوای در انتظار بررسی", value: null, detail: emptyDetail, icon: "◇", tone: "orange" },
      { title: "درخواست‌های جدید", value: null, detail: emptyDetail, icon: "♙", tone: "purple" },
    ],
    actions: [
      { title: "افزودن واحد جدید", icon: "▥" },
      { title: "ثبت کاربر جدید", icon: "♙" },
      { title: "ارسال اطلاعیه", icon: "⌁" },
      { title: "گزارش عملکرد", icon: "◌" },
      { title: "تنظیمات سیستم", icon: "⚙" },
      { title: "پشتیبانی و تیکت", icon: "☏" },
    ],
    mainTitle: "آخرین درخواست‌ها",
    mainRows: [],
    sideTitle: "فعالیت‌های سیستم",
    sideRows: [],
    bottomTitle: "اعلانات اخیر",
    bottomRows: [],
  },

  unitManager: {
    roleTitle: "مدیر واحد",
    roleDescription: "پنل مدیریت واحد آموزشی",
    welcomeTitle: "پنل مدیریت واحد",
    welcomeText: "در این بخش کلاس‌ها، دانش‌آموزان، کارکنان، برنامه‌ها، پیام‌ها و محتوای مربوط به واحد آموزشی نمایش داده می‌شود.",
    badge: "واحد آموزشی",
    navItems: [
      { label: "داشبورد", href: "/dashboard/unit-manager", icon: "⌂" },
      { label: "کلاس‌ها", href: "#", icon: "▤" },
      { label: "دانش‌آموزان", href: "#", icon: "♙" },
      { label: "کارکنان", href: "#", icon: "♧" },
      { label: "حضور و غیاب", href: "#", icon: "☑" },
      { label: "برنامه‌ها", href: "#", icon: "◴" },
      { label: "اخبار و اطلاعیه‌ها", href: "#", icon: "⌁" },
      sharedNav.messages,
      { label: "تنظیمات واحد", href: "#", icon: "⚙" },
    ],
    kpis: [
      { title: "دانش‌آموزان فعال", value: null, detail: emptyDetail, icon: "♙", tone: "green" },
      { title: "معلمان و کارکنان", value: null, detail: emptyDetail, icon: "♧", tone: "purple" },
      { title: "پیام‌های دریافتی", value: null, detail: emptyDetail, icon: "✉", tone: "blue" },
      { title: "برنامه‌های امروز", value: null, detail: emptyDetail, icon: "◴", tone: "orange" },
    ],
    actions: [
      { title: "حضور و غیاب", icon: "☑" },
      { title: "مدیریت کلاس‌ها", icon: "▤" },
      { title: "ثبت اطلاعیه واحد", icon: "⌁" },
      { title: "برنامه هفتگی", icon: "◴" },
      { title: "ثبت رویداد", icon: "♕" },
      { title: "درخواست پشتیبانی", icon: "☏" },
    ],
    mainTitle: "نمای کلی کلاس‌ها",
    mainRows: [],
    sideTitle: "برنامه‌ها و رویدادهای امروز",
    sideRows: [],
    bottomTitle: "درخواست‌های والدین",
    bottomRows: [],
  },

  media: {
    roleTitle: "همکار رسانه",
    roleDescription: "پنل رسانه و محتوای مدرسه",
    welcomeTitle: "پنل رسانه و محتوای مدرسه",
    welcomeText: "در این بخش اخبار، اطلاعیه‌ها، گالری، آلبوم‌ها و محتوای رسانه‌ای مربوط به واحد آموزشی مدیریت می‌شود.",
    navItems: [
      { label: "داشبورد", href: "/dashboard/media", icon: "⌂" },
      { label: "اخبار", href: "#", icon: "▥" },
      { label: "اطلاعیه‌ها", href: "#", icon: "⌁" },
      { label: "گالری", href: "#", icon: "▧" },
      { label: "آلبوم‌ها", href: "#", icon: "▣" },
      { label: "رسانه‌ها", href: "#", icon: "◎" },
      { label: "تقویم رویدادها", href: "#", icon: "◴" },
      sharedNav.messages,
      sharedNav.settings,
    ],
    kpis: [
      { title: "پیام‌های رسانه‌ای", value: null, detail: emptyDetail, icon: "✈", tone: "purple" },
      { title: "گالری‌های فعال", value: null, detail: emptyDetail, icon: "▧", tone: "blue" },
      { title: "پیش‌نویس‌ها", value: null, detail: emptyDetail, icon: "✎", tone: "orange" },
      { title: "محتوای آماده انتشار", value: null, detail: emptyDetail, icon: "✓", tone: "green" },
    ],
    actions: [
      { title: "ساخت آلبوم", icon: "▣" },
      { title: "بارگذاری تصویر", icon: "▧" },
      { title: "ایجاد خبر", icon: "▤" },
      { title: "مدیریت اطلاعیه", icon: "⌁" },
      { title: "زمان‌بندی انتشار", icon: "◴" },
      { title: "پوشش رویداد", icon: "◎" },
    ],
    mainTitle: "صف بررسی محتوا",
    mainRows: [],
    sideTitle: "آخرین پیش‌نویس‌های خبر",
    sideRows: [],
    bottomTitle: "فعالیت‌های انتشار",
    bottomRows: [],
  },

  parents: {
    roleTitle: "والدین",
    roleDescription: "پنل خانواده با مدرسه",
    welcomeTitle: "پنل خانواده",
    welcomeText: "در این بخش اطلاعات فرزندان، برنامه‌ها، اطلاعیه‌ها، پیام‌ها و درخواست‌های خانواده نمایش داده می‌شود.",
    navItems: [
      { label: "داشبورد", href: "/dashboard/parents", icon: "⌂" },
      { label: "فرزندان من", href: "#", icon: "♙" },
      { label: "برنامه‌ها", href: "#", icon: "◴" },
      { label: "اطلاعیه‌ها", href: "#", icon: "⌁" },
      { label: "گالری", href: "#", icon: "▧" },
      sharedNav.messages,
      { label: "ثبت‌نام", href: "#", icon: "▤" },
      { label: "پروفایل", href: "#", icon: "♧" },
      { label: "پشتیبانی", href: "#", icon: "☏" },
    ],
    kpis: [
      { title: "فرزندان من", value: null, detail: emptyDetail, icon: "♙", tone: "orange" },
      { title: "پیام‌های جدید", value: null, detail: emptyDetail, icon: "✉", tone: "purple" },
      { title: "برنامه امروز", value: null, detail: emptyDetail, icon: "◴", tone: "blue" },
      { title: "اطلاعیه‌های جدید", value: null, detail: emptyDetail, icon: "⌁", tone: "green" },
    ],
    actions: [
      { title: "پیگیری ثبت‌نام", icon: "☑" },
      { title: "ارسال پیام", icon: "✈" },
      { title: "مشاهده برنامه هفتگی", icon: "◴" },
      { title: "تماس با مدرسه", icon: "☏" },
      { title: "مشاهده گالری", icon: "▧" },
      { title: "دریافت اطلاعیه", icon: "⌁" },
    ],
    mainTitle: "فرزندان من",
    mainRows: [],
    sideTitle: "اطلاعیه‌های اخیر مدرسه",
    sideRows: [],
    bottomTitle: "فعالیت‌ها و درخواست‌های اخیر",
    bottomRows: [],
  },
};
