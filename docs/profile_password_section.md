# Profile Password Section

بخش تغییر رمز عبور به صفحه پروفایل اضافه شده است.

## فایل‌ها

```txt
frontend/src/components/dashboard/panel-profile-content.tsx
frontend/src/lib/profile/profile-service.ts
داده‌های فرم تغییر رمز
currentPassword
newPassword
confirmPassword
نکته

تابع changePassword فعلاً ساختار فرانت را آماده می‌کند. بعد از آماده شدن بک‌اند، این تابع باید به endpoint واقعی تغییر رمز متصل شود.
