# Besat Site - Panel Roles, Unit Scope and Backend Coordination

## وضعیت فاز

پنل مدیر فنی فعلاً وارد فاز ساخت نمی‌شود.

پنل‌های داخل فاز ساخت:

1. مدیر کل
2. مدیر واحد
3. همکار رسانه
4. والدین

---

## نقش‌ها

### مدیر کل

بالاترین نقش اجرایی مجموعه بعد از نقش فنی.

دسترسی‌ها:

- مشاهده تمام واحدها
- مدیریت واحدها
- مدیریت کاربران
- مشاهده درخواست‌ها
- بررسی و انتشار محتوای کل مجموعه
- مشاهده پیام‌ها
- مدیریت اخبار، اطلاعیه‌ها، گالری و رویدادهای عمومی

---

### مدیر واحد

مدیر هر واحد آموزشی.

دسترسی‌ها:

- مشاهده اطلاعات واحد خودش
- مدیریت کلاس‌های واحد خودش
- مدیریت دانش‌آموزان واحد خودش
- مدیریت کارکنان واحد خودش
- ثبت و بررسی اطلاعیه‌های واحد خودش
- مشاهده پیام‌ها و درخواست‌های مربوط به واحد خودش
- مشاهده برنامه‌ها و رویدادهای واحد خودش

---

### همکار رسانه

مسئول رسانه هر واحد.

دسترسی‌ها:

- ایجاد خبر برای واحد خودش
- ایجاد اطلاعیه برای واحد خودش
- ساخت و مدیریت آلبوم‌های واحد خودش
- بارگذاری تصاویر مربوط به واحد خودش
- ثبت رویدادهای قابل پوشش
- ارسال محتوا برای بررسی یا انتشار طبق سیاست مجموعه

---

### والدین

کاربر خانواده.

دسترسی‌ها:

- مشاهده فرزندان خودش
- مشاهده اطلاعیه‌های عمومی و اطلاعیه‌های واحد فرزند
- مشاهده پیام‌های مربوط به خودش و فرزندش
- مشاهده برنامه‌ها و رویدادهای مرتبط
- ارسال درخواست
- پیگیری ثبت‌نام

---

## منطق واحدها

هر محتوای مدرسه باید یکی از دو حالت زیر را داشته باشد:

### محتوای عمومی مجموعه

برای کل مدرسه نمایش داده می‌شود.

نمونه‌ها:

- خبر عمومی مجموعه
- اطلاعیه عمومی
- گالری عمومی
- رویداد عمومی

### محتوای وابسته به واحد

به یک واحد آموزشی مشخص وصل است.

نمونه‌ها:

- خبر واحد دبستان
- اطلاعیه واحد متوسطه اول
- گالری واحد پیش‌دبستان
- برنامه یا رویداد واحد دبیرستان

---

## فیلدهای پیشنهادی برای محتوا

برای خبر، اطلاعیه، گالری، رویداد و پیام، این فیلدها لازم است:

```txt
id
title
slug
summary
body
scope: school | unit
unit_id: nullable
status: draft | waiting_review | approved | published | rejected
created_by
updated_by
published_by
created_at
updated_at
published_at
is_featured
is_active
پیشنهاد سطح دسترسی برای بک‌اند
general_manager
can_view_all_units = true
can_manage_units = true
can_manage_users = true
can_review_all_content = true
can_publish_school_content = true
can_publish_unit_content = true
unit_manager
can_view_all_units = false
can_manage_own_unit = true
can_manage_own_unit_students = true
can_manage_own_unit_staff = true
can_review_own_unit_content = true
can_publish_own_unit_content = true
unit_media
can_view_all_units = false
can_create_own_unit_content = true
can_edit_own_unit_content = true
can_upload_own_unit_media = true
can_publish_own_unit_content = depends_on_policy
parent
can_view_own_children = true
can_view_related_announcements = true
can_view_related_messages = true
can_create_requests = true
مسیرهای پیشنهادی پنل فرانت
/dashboard/admin
/dashboard/unit-manager
/dashboard/media
/dashboard/parents
مسیرهای پیشنهادی برای بک‌اند
GET    /api/me/
GET    /api/me/permissions/
GET    /api/me/units/

GET    /api/dashboard/general-manager/
GET    /api/dashboard/unit-manager/
GET    /api/dashboard/media/
GET    /api/dashboard/parents/

GET    /api/units/
GET    /api/units/{id}/

GET    /api/content/
POST   /api/content/
GET    /api/content/{id}/
PATCH  /api/content/{id}/
DELETE /api/content/{id}/

POST   /api/content/{id}/submit-review/
POST   /api/content/{id}/approve/
POST   /api/content/{id}/publish/
POST   /api/content/{id}/reject/

GET    /api/messages/
POST   /api/messages/

GET    /api/registration-requests/
POST   /api/registration-requests/
PATCH  /api/registration-requests/{id}/
نکته اتصال فرانت و بک‌اند

فرانت باید بعد از ورود کاربر از مسیر زیر نقش و دسترسی‌ها را بگیرد:

GET /api/me/
GET /api/me/permissions/
GET /api/me/units/

سپس بر اساس role و unit_id مسیر درست را نمایش دهد.

ترتیب ساخت در فرانت
ساخت layout مشترک پنل‌ها
ساخت پنل مدیر کل
ساخت پنل مدیر واحد
ساخت پنل همکار رسانه
ساخت پنل والدین
اتصال تدریجی داده‌ها به سرویس‌های بک‌اند
