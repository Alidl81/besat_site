# Footer Content Contract

## Feature

```txt
فوتر سایت عمومی مدرسه بعثت
Frontend
Component: frontend/src/components/layout/site-footer.tsx
Current Data Source
Status: frontend-static-config

در حال حاضر محتوای فوتر از آرایه‌های داخل خود فایل خوانده می‌شود:

quickLinks
relatedWebsites
contactItems
socialLinks
Future Backend Option

اگر بعداً قرار شد فوتر از بک‌اند مدیریت شود، endpoint پیشنهادی:

Method: GET
Path: site-settings/footer/
Auth required: no
Response
type FooterSettings = {
  intro: {
    title: string;
    subtitle: string;
    description: string;
  };
  stats: {
    label: string;
    value: string;
  }[];
  quick_links: {
    label: string;
    href: string;
  }[];
  related_websites: {
    label: string;
    href: string;
    description?: string | null;
  }[];
  contacts: {
    label: string;
    value: string;
    href?: string | null;
  }[];
  social_links: {
    label: string;
    href: string;
    description?: string | null;
  }[];
};
Notes
بخش همراهان حذف شده است.
اطلاعات تماس و شبکه‌های اجتماعی فعلاً از طریق کد قابل ویرایش است.
هیچ placeholder یا داده فیک در UI استفاده نشده است.


## Social Icon Assets

آیکون‌های شبکه‌های اجتماعی به صورت فایل SVG داخل مسیر زیر قرار دارند:

```txt id="y3w3oe"
frontend/public/icons/social/telegram.svg
frontend/public/icons/social/eitaa.svg

در تنظیمات فرانت، هر شبکه اجتماعی می‌تواند فیلد زیر را داشته باشد:

iconSrc?: string;

