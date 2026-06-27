# Frontend Login API Connection

صفحه ورود فرانت به API حساب کاربری متصل شد.

## فایل

```txt
frontend/src/components/auth/login-card.tsx
Endpoint
POST auth/login/
داده ارسالی
username
password
داده دریافتی
access
refresh
user.role
redirect_path
رفتار فرانت

بعد از ورود موفق، مقادیر زیر در localStorage ذخیره می‌شوند:

besat_access_token
besat_refresh_token
besat_user_role
besat_redirect_path

سپس کاربر به redirect_path هدایت می‌شود.
