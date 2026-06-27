# Frontend First, Backend Ready Policy

تصمیم پروژه این است که ابتدا فرانت‌اند کامل شود و سپس بک‌اند دقیقاً بر اساس نیازهای نهایی فرانت‌اند پیاده‌سازی شود.

از این مرحله به بعد، هر تغییر در فرانت باید یک قرارداد بک‌اند همراه داشته باشد؛ حتی اگر endpoint هنوز در بک‌اند پیاده‌سازی نشده باشد.

## قانون اصلی

هیچ صفحه، فرم، پنل، کارت داده‌ای یا workflow جدیدی نباید فقط در UI ساخته شود بدون اینکه نیاز بک‌اند آن مشخص شده باشد.

برای هر قابلیت باید موارد زیر روشن باشد:

```txt
Frontend route/component
Required API endpoint
HTTP method
Request fields
Response fields
Authentication requirement
Role/permission requirement
Unit scope
Empty state
Error state
Loading behavior
Backend status
وضعیت endpoint

برای هر endpoint فقط یکی از وضعیت‌های زیر استفاده شود:

ready
frontend-ready-backend-pending
backend-needs-update
deprecated
قواعد UI

در UI نباید داده فیک، placeholder، mock، sample یا متن فنی مربوط به بک‌اند نمایش داده شود.

اگر داده وجود ندارد:

موردی برای نمایش وجود ندارد.
خبری برای نمایش وجود ندارد.
اطلاعیه‌ای برای نمایش وجود ندارد.
اولویت فعلی

فعلاً فرانت کامل می‌شود. بک‌اند بعداً بر اساس قراردادهای همین پوشه پیاده‌سازی یا اصلاح می‌شود.
