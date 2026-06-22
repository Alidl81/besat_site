# Panel Profile Routes

بخش پروفایل با همان منطق منوی پنل‌ها اضافه شده است.

## مسیرها

```txt
/admin/profile
/unit-manager/profile
/media/profile
/parents/profile
نکته اجرایی

منوی کناری پنل‌ها از data.menu در فایل زیر ساخته می‌شود:

frontend/src/components/dashboard/panel-data.ts

بنابراین برای افزودن گزینه پروفایل، فقط آیتم profile به داده منو اضافه شده و ساختار panel-shell.tsx و panel-menu.tsx تغییر داده نشده است.
