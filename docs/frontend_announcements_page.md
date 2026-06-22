# Frontend Announcements Page

صفحه عمومی اطلاعیه‌ها آماده اتصال به API شد.

## Route

```txt
/announcements
فایل‌ها
frontend/src/app/announcements/page.tsx
frontend/src/lib/api/public-api.ts
Endpoint مورد استفاده
announcements/
announcements/{slug}/
رفتار صفحه

اگر بک‌اند آماده نباشد یا داده‌ای برنگردد، صفحه فقط این پیام را نشان می‌دهد:

اطلاعیه‌ای برای نمایش وجود ندارد.

هیچ داده فیک یا placeholder در UI استفاده نشده است.
