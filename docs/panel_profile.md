# Panel Profile

بخش پروفایل برای پنل‌ها اضافه شده است.

## مسیرها

```txt
/admin/profile
/unit-manager/profile
/media/profile
/parents/profile
منطق منو

ساختار منوی کناری تغییر نکرده است. گزینه پروفایل از طریق data.menu در فایل زیر نمایش داده می‌شود:

frontend/src/components/dashboard/panel-data.ts
محتوای پروفایل

محتوای پروفایل در فایل زیر قرار دارد:

frontend/src/components/dashboard/panel-profile-content.tsx

این بخش شامل مشاهده و ویرایش اطلاعات حساب و انتخاب تصویر پروفایل است.
