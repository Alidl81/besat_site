# Frontend Logged In Header State

بعد از ورود موفق، وضعیت حساب کاربری در فرانت ذخیره می‌شود و هدر عمومی بر اساس آن تغییر می‌کند.

## فایل‌ها

```txt
frontend/src/lib/auth/auth-session.ts
frontend/src/components/auth/site-auth-actions.tsx
frontend/src/components/auth/login-card.tsx
frontend/src/components/layout/site-header.tsx
رفتار
در حالت خارج از حساب، دکمه «ورود» نمایش داده می‌شود.
بعد از ورود موفق، نام کاربر نمایش داده می‌شود.
بعد از ورود موفق، دکمه‌های «پنل من» و «خروج» نمایش داده می‌شوند.
دکمه «پنل من» به redirect_path دریافتی از بک‌اند می‌رود.
با خروج، tokenها از localStorage حذف می‌شوند.
کلیدهای localStorage
besat_access_token
besat_refresh_token
besat_user_role
besat_redirect_path
besat_user
نکته

نمایش نام کاربر از داده واقعی login response انجام می‌شود و داده فیک در UI استفاده نشده است.
