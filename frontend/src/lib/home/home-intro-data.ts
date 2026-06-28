export type HomeIntroContent = {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  primaryLink: {
    label: string;
    href: string;
  };
  secondaryLink: {
    label: string;
    href: string;
  };
};

export const homeIntroContent: HomeIntroContent = {
  eyebrow: "معرفی مجموعه",
  title: "مجتمع تربیتی آموزشی بعثت",
  body: "مجتمع تربیتی آموزشی بعثت با بیش از ۳۲ سال سابقه، دارای واحدهای پسرانه و دخترانه در مقاطع مختلف تحصیلی است و با رویکرد تربیت انقلابی و مذهبی، بالاترین سطح توانمندی‌های آموزشی و اجتماعی را برای دانش‌آموزان فراهم می‌کند.",
  imageSrc: "/images/home/intro/intro.jpg",
  imageAlt: "نمایی از مدرسه بعثت",
  primaryLink: {
    label: "درباره ما",
    href: "/about",
  },
  secondaryLink: {
    label: "پیش‌ثبت‌نام",
    href: "/registration",
  },
};
