# Header Branches Dropdown Contract

## Feature

```txt
گروه‌بندی لینک‌های واحدها و دپارتمان‌ها زیر آیتم شعب در هدر سایت
Frontend
Component: frontend/src/components/layout/site-header.tsx
Routes:
/
 /units
/departments
/news
/announcements
/gallery
/about
/contact
/registration
/login
Backend Endpoint
Status: frontend-static-config
Method: none
Path: none
Auth required: no
Behavior
در دسکتاپ، آیتم شعب به صورت dropdown باز می‌شود.
در موبایل، آیتم شعب داخل منوی کشویی به صورت accordion باز می‌شود.
لینک‌های واحدها و دپارتمان‌ها حذف نشده‌اند؛ فقط از منوی اصلی به زیرمنوی شعب منتقل شده‌اند.
Current Links
شعب
  واحدها => /units
  دپارتمان‌ها => /departments
Future Backend Option

اگر بعداً قرار شد آیتم‌های هدر از بک‌اند مدیریت شوند، endpoint پیشنهادی:

GET site-settings/navigation/
Notes
این تغییر endpoint جدید نیاز ندارد.
هیچ داده فیک یا placeholder به UI اضافه نشده است.

