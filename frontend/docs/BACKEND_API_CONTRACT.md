# قرارداد API پنل‌های مجتمع بعثت

این فایل قرارداد اجرایی فرانت با بک‌اند است. تمام درخواست‌های مرورگر نسبت
به `NEXT_PUBLIC_API_BASE_URL=/api/backend` هستند و Route Handler فرانت آن‌ها
را به `BESAT_BACKEND_API_URL` می‌فرستد. مقدار پیش‌فرض `mock://local` همین
قرارداد را روی دیتابیس موقت اجرا می‌کند. تغییر endpoint موقت به اصلی فقط با
قرار دادن URL بک‌اند در همین متغیر انجام می‌شود. همه مسیرها اسلش پایانی
دارند و برای Django REST Framework و routerهای آن تعریف شده‌اند.

## قواعد مشترک

- احراز هویت: `Authorization: Bearer <access-token>`
- بدنه درخواست و پاسخ: `application/json`، به‌جز upload/import
- صفحه‌بندی فهرست‌ها:

```json
{
  "count": 0,
  "next": null,
  "previous": null,
  "results": []
}
```

- خطای اعتبارسنجی: هر فیلد آرایه‌ای از پیام‌ها دارد.
- خطای عمومی:

```json
{
  "detail": "پیام قابل نمایش",
  "code": "machine_readable_code",
  "request_id": "correlation-id"
}
```

- نقش‌ها: `general_manager`، `unit_manager`، `unit_media` و `parent`.
- بک‌اند باید دسترسی واحد و فرزند را از توکن اعمال کند؛ فرانت برای دورزدن
  permission به شناسه‌های ارسالی اعتماد نمی‌کند.
- فیلتر استاندارد فهرست‌ها: `search`، `ordering`، `page` و فیلترهای همان منبع.

## احراز هویت و context

| Method | Endpoint | کاربرد |
|---|---|---|
| POST | `auth/login/` | ورود و دریافت access/refresh |
| POST | `auth/refresh/` | تمدید access |
| POST | `auth/logout/` | باطل‌کردن refresh |
| GET | `me/` | کاربر جاری |
| GET/PATCH | `me/profile/` | پروفایل |
| POST | `me/profile/avatar/` | بارگذاری آواتار |
| GET | `me/permissions/` | permissionهای مؤثر |
| GET | `me/units/` | واحدهای مجاز |
| GET | `dashboard/context/` | کاربر، نقش، سال‌ها، واحدها، فرزندان و تعداد پیام/اعلان خوانده‌نشده |

`dashboard/context/` پارامترهای اختیاری `academic_year`، `unit` و `child` را
می‌پذیرد. پاسخ:

```json
{
  "user": {
    "id": "uuid",
    "full_name": "",
    "role_display": "",
    "avatar_url": null
  },
  "academic_years": [{"id": "uuid", "title": "", "is_current": true}],
  "selected_academic_year_id": "uuid",
  "units": [{"id": "uuid", "title": ""}],
  "selected_unit_id": "uuid",
  "children": [{"id": "uuid", "title": "", "subtitle": null, "avatar_url": null}],
  "selected_child_id": null,
  "unread_notifications": 0,
  "unread_messages": 0,
  "current_date": "2026-07-27T12:00:00Z"
}
```

## داشبوردها

| Method | Endpoint | نقش |
|---|---|---|
| GET | `dashboard/general-manager/` | مدیر مجموعه |
| GET | `dashboard/unit-manager/` | مدیر واحد |
| GET | `dashboard/media/` | مسئول رسانه |
| GET | `dashboard/parents/` | والد |

هر endpoint پارامترهای context را می‌پذیرد. داده‌های آماری باید از دیتابیس
محاسبه شوند و در `metrics` برگردند؛ فرانت مقدار جایگزین تولید نمی‌کند.

## دانش‌آموزان

| Method | Endpoint | کاربرد |
|---|---|---|
| GET/POST | `cms/students/` | فهرست و ایجاد |
| GET/PATCH/DELETE | `cms/students/{id}/` | جزئیات، ویرایش و حذف |
| GET | `cms/students/summary/` | آمار کارت‌ها |
| POST | `cms/students/bulk-import/` | ورود فایل Excel/CSV با فیلد multipart به نام `file` |
| GET | `cms/students/export/?format=xlsx` | خروجی فیلترشده |

فیلترها: `search` (نام، کد ملی، کد دانش‌آموزی)، `grade`،
`profile_status`، `education_status`، `unit` و `page`.

فیلدهای اصلی serializer:

```text
id, full_name, avatar_url, student_code, national_code,
unit{id,title}, grade{id,title}, class_room{id,title}, major,
profile_status, education_status,
guardian{id,full_name,phone,email}, enrolled_at, created_at, updated_at
```

`bulk-import/` پاسخ `{created, updated, errors:[{row,message}]}` می‌دهد.

## درخواست‌های ثبت‌نام

| Method | Endpoint | کاربرد |
|---|---|---|
| GET | `cms/registration-requests/` | فهرست |
| GET/PATCH | `cms/registration-requests/{id}/` | جزئیات و ویرایش |
| GET | `cms/registration-requests/summary/` | آمار وضعیت‌ها |
| POST | `cms/registration-requests/{id}/approve/` | تأیید |
| POST | `cms/registration-requests/{id}/reject/` | رد؛ بدنه `{note}` |
| POST | `cms/registration-requests/{id}/request-documents/` | درخواست مدرک؛ بدنه `{note}` |
| POST | `cms/registration-requests/{id}/contact/` | ثبت/ارسال ارتباط با والد |

فیلترها: `search`، `status`، `grade`، `unit` و `page`.
جزئیات شامل `documents[]` و `timeline[]` است. تغییر وضعیت باید transaction،
ثبت actor و timeline، و ارسال notification را در بک‌اند انجام دهد.

## محتوا و ادیتورها

| Method | Endpoint | کاربرد |
|---|---|---|
| GET/POST | `cms/content/` | فهرست و ایجاد |
| GET/PATCH/DELETE | `cms/content/{id}/` | جزئیات، ویرایش و حذف |
| GET | `cms/content/summary/` | آمار گردش محتوا |
| GET | `cms/content/categories/` | گزینه‌های دسته‌بندی |
| POST | `cms/content/{id}/autosave/` | ذخیره خودکار |
| POST | `cms/content/{id}/submit-review/` | ارسال برای بررسی |
| POST | `cms/content/{id}/approve/` | تأیید بازبین |
| POST | `cms/content/{id}/reject/` | رد با توضیح |
| POST | `cms/content/{id}/publish/` | انتشار فوری |
| POST | `cms/content/{id}/schedule/` | زمان‌بندی با `{scheduled_at}` |
| GET | `cms/content/{id}/revisions/` | نسخه‌ها |
| POST | `cms/content/{id}/restore-revision/` | بازیابی با `{revision_id}` |
| POST | `cms/media/` | upload فایل با فیلد multipart به نام `file` |

فیلدهای محتوا:

```text
id, kind, title, slug, summary, body_html, body_json,
cover_image_url, scope, unit{id,title}, category{id,title}, status,
author{id,full_name,avatar_url}, scheduled_at, published_at,
created_at, updated_at
```

`body_json` خروجی Tiptap و منبع قابل‌ویرایش است؛ `body_html` نسخه‌ی render
برای سایت عمومی است. بک‌اند باید هر دو را نگه دارد، HTML را sanitize کند و
در هر ذخیره یک revision بسازد. `autosave/` می‌تواند revision را با نوع
`autosave` ثبت کند و فقط آخرین تعداد محدود را نگه دارد.

گردش وضعیت:

```text
draft → waiting_review → approved → scheduled → published
                         ↘ rejected
```

مسئول رسانه اجازه publish مستقیم ندارد. permission و transition باید در
بک‌اند enforce شود.

## والدین

| Method | Endpoint | کاربرد |
|---|---|---|
| GET | `parents/children/` | فقط فرزندان متصل به کاربر جاری |
| GET | `parents/children/{id}/` | پرونده تجمیعی فرزند |
| GET | `parents/programs/` | برنامه‌های مجاز والد |
| GET | `parents/registrations/` | فرایندهای ثبت‌نام فرزندان |

جزئیات فرزند شامل `teachers`، `latest_grades`، `attendance`، `exams`,
`assignments`، `schedule`، `counselor_message` و `quick_links` است. endpoint
باید `academic_year` را بپذیرد و برای فرزندی خارج از حساب جاری `404` بدهد.

## سایر قابلیت‌های پنل

| Method | Endpoint | کاربرد |
|---|---|---|
| GET/POST | `cms/events/` | رویدادها |
| GET | `cms/reports/overview/` | گزارش مدیریتی |
| GET | `cms/reports/export/?format=xlsx` | خروجی گزارش |
| GET/PATCH | `cms/settings/` | تنظیمات مجموعه |
| GET | `cms/services/?audience=staff\|parent` | سرویس‌های قابل‌دسترسی |
| CRUD | `cms/units/` | واحدها |
| CRUD | `cms/staff/` | کادر |
| CRUD | `cms/gallery/` | رسانه و گالری |
| CRUD | `cms/users/` | کاربران و دسترسی |
| CRUD | `cms/static-pages/` | صفحات ثابت |
| CRUD | `cms/internal-messages/` | پیام‌های داخلی |

برای پیام‌های داخلی، فهرست پارامتر `folder=inbox|sent` را می‌پذیرد؛
`cms/internal-messages/recipients/` گیرندگان مجاز را می‌دهد و
`POST cms/internal-messages/{id}/mark-read/` پیام ورودی را خوانده‌شده می‌کند.
در ایجاد پیام فقط `recipient_id`، `subject` و `body` ارسال می‌شود؛ sender
همیشه باید در بک‌اند از کاربر احرازشده تعیین شود.

## پیشنهاد پیاده‌سازی DRF

- منابع CRUD با `ModelViewSet` و `DefaultRouter`.
- عملیات‌هایی مثل `approve`، `autosave` و `bulk-import` با `@action`.
- جستجو و ترتیب با `SearchFilter` و `OrderingFilter` و فیلترهای دامنه با
  `django-filter`.
- `IsAuthenticated` به‌عنوان پیش‌فرض و permission جدا برای هر نقش/transition.
- صفحه‌بندی استاندارد روی تمام list endpointها.
- `transaction.atomic()` برای تغییر وضعیت ثبت‌نام و انتشار.
- اعتبارسنجی scope/unit در serializer و queryset محدودشده بر اساس کاربر.

PHP برای این اتصال لازم نیست. فرانت Next.js با REST API کار می‌کند؛ اگر
سایت WordPress/PHP در معماری باقی بماند باید فقط به‌عنوان مصرف‌کننده یا
ناشر محتوا از همین API استفاده کند، نه به‌عنوان منبع دوم و ناسازگار داده.
