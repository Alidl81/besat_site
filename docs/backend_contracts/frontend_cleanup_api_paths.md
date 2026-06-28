# Frontend Cleanup And API Path Normalization

این مرحله برای تمیز نگه داشتن پروژه و آماده‌سازی فرانت برای اتصال نهایی به بک‌اند انجام شد.

## کارهای انجام‌شده

```txt
فایل‌های backup از components/dashboard حذف شدند.
frontend/.env.local در .gitignore تضمین شد.
مسیرهای قدیمی /api/... در فایل‌های api/service فرانت اصلاح شدند.
دلیل اصلاح مسیرهای API

مقدار base URL فرانت این است:

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api

پس مسیرهای سرویس نباید دوباره /api داشته باشند.

درست:

news/
auth/login/
me/profile/

اشتباه:

/api/news/
/api/auth/login/
/api/me/profile/
فایل‌هایی که نباید commit شوند
frontend/.env.local
*.bak
*.bak-*
*.backup
*.backup-*
وضعیت

این مرحله تغییر UI ایجاد نمی‌کند؛ فقط پروژه را برای ادامه توسعه فرانت و اتصال آینده بک‌اند تمیز و یکدست می‌کند.
