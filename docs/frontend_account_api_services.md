# Frontend Account API Services

سرویس‌های حساب کاربری فرانت مطابق سند `docs/API_for_account.md` آماده شد.

## فایل

```txt
frontend/src/lib/api/account-api.ts
Base URL
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api

در مسیرهای سرویس، /api دوباره نوشته نشده است.

Endpointهای استفاده‌شده
auth/login/
auth/refresh/
auth/logout/

me/
me/profile/
me/profile/avatar/

me/permissions/
me/units/
نکته پروفایل

آپلود تصویر پروفایل از مسیر جدا انجام می‌شود:

POST me/profile/avatar/

پس در اتصال واقعی صفحه پروفایل، اطلاعات متنی با PATCH me/profile/ و تصویر با POST me/profile/avatar/ ارسال می‌شود.

وضعیت

در این مرحله فقط سرویس‌ها اضافه شده‌اند. UI لاگین و پروفایل هنوز به این سرویس‌ها وصل نشده‌اند.
