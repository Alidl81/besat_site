# Frontend Public API Services

اتصال فرانت به APIهای عمومی آماده‌ی بک‌اند آماده شد.

## تنظیم محیط

```txt
frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
نکته مهم

چون مقدار base URL تا /api تنظیم شده، در سرویس‌ها نباید دوباره /api نوشته شود.

درست:

news/
units/
site-settings/

اشتباه:

/api/news/
/api/units/
فایل‌ها
frontend/src/lib/api/client.ts
frontend/src/lib/api/public-api.ts
endpointهای آماده برای اتصال UI
site-settings/
units/
units/{slug}/
departments/
departments/{slug}/
news/
news/{slug}/
news/categories/
وضعیت

در این مرحله فقط سرویس‌ها آماده شده‌اند و UI هنوز به داده‌های واقعی وصل نشده است.
