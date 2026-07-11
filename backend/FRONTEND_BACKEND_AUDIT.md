# گزارش تطبیق فرانت‌اند و بک‌اند بسات

تاریخ بررسی: ۲۰ تیر ۱۴۰۵ (2026-07-11)

## مبنای بررسی

- مخزن فرانت‌اند و مستندات: `Alidl81/besat_site`
- شاخه: `main`
- commit بررسی‌شده: `3c3484a04b1a3f20df0f109583d18bfe1deeb153`
- تاریخچه بررسی‌شده: ۱۳۰ commit موجود در مخزن
- ورودی بک‌اند: فایل `backend(1).zip`
- مبنای URL فرانت: `http://localhost:8000/api`

در این بررسی سورس فرانت، repositoryها و serviceهای API، typeهای دامنه، صفحات عمومی و داشبورد، مستندات پوشه `docs`، READMEها و تغییرات مهم تاریخچه Git بررسی شدند. تغییرات فقط در بک‌اند انجام شده‌اند.

## ناسازگاری‌های رفع‌شده

### مسیرها و repositoryهای CMS

مسیرهای زیر مطابق نام و قرارداد مورد استفاده فرانت فراهم یا تکمیل شدند:

| مسیر نسبی زیر `/api/` | نتیجه |
|---|---|
| `cms/units/` | CRUD، خواندن عمومی فقط برای واحدهای فعال، نوشتن فقط مدیر کل |
| `cms/departments/` | CRUD، خواندن عمومی فقط برای دپارتمان‌های فعال، نوشتن فقط مدیر کل |
| `cms/users/` | CRUD کاربران و نقش/واحد مطابق typeهای فرانت |
| `cms/content/` | CRUD یکپارچه خبر و اطلاعیه با شناسه‌های پایدار `news-*` و `announcement-*` |
| `cms/gallery/` | قرارداد تصویر/URL، آلبوم، scope، unit و status مطابق فرانت |
| `cms/achievements/` | aliasهای `scope`، `status`، `unit_id` و `achieved_at` |
| `cms/home-slides/` | پشتیبانی هم‌زمان از فایل و URL تصویر |
| `cms/registrations/` | alias مسیر و فیلدهای مورد انتظار فرانت؛ مسیر قدیمی هم حفظ شد |
| `cms/messages/` | `name` و `is_read` و PATCH وضعیت خوانده‌شدن |
| `cms/students/` | مدل، migration و CRUD واحدمحور |
| `cms/classes/` | مدل، migration و CRUD واحدمحور |
| `cms/staff/` | پذیرش `unit_id` و تشخیص امن واحد کاربر |
| `cms/programs/` | مدل، migration و CRUD واحدمحور |
| `cms/internal-messages/` | مدل و CRUD امن با sender سمت سرور |
| `cms/static-pages/` | سازگاری با صفحهٔ ثابت «درباره ما» |

### فرم‌های عمومی

- `POST /api/contact/` اکنون payload دقیق فرانت یعنی `name`, `phone`, `email`, `subject`, `message` را می‌پذیرد؛ endpoint قدیمی `messages/` نیز حفظ شده است.
- `POST /api/registration/` اکنون payload دقیق فرانت یعنی `full_name`, `parent_phone`, `requested_grade`, `unit_id`, `description` را می‌پذیرد؛ نام والد اختیاری شد و endpoint قدیمی `registration-requests/` نیز حفظ شده است.
- پاسخ موفق ثبت‌نام شامل `message` و `id` است.

### احراز هویت و داشبورد

- redirect نقش‌ها به مسیرهای واقعی فرانت تغییر کرد: `/dashboard/admin`، `/dashboard/unit-manager`، `/dashboard/media` و `/dashboard/parents`.
- پاسخ‌های login/profile/me شامل اطلاعات نقش، `redirect_path` و `unit_id` لازم هستند.
- تغییر رمز هم `confirm_password` فرانت و هم نام قدیمی `new_password_confirm` را قبول می‌کند.
- permissionهای flat قدیمی در کنار ساختار nested جدید حفظ شده‌اند.
- چون نسخه فعلی فرانت بعد از login مقدار `unitId` را صریحاً `null` می‌گذارد، بک‌اند برای کاربر دارای یک عضویت فعال، واحد را در عملیات واحدمحور به شکل امن تشخیص می‌دهد. این رفتار برای محتوا، گالری، دانش‌آموز، کلاس، برنامه و کادر اعمال شده است.

### محتوا و رسانه

- `GET /api/content/?type=gallery` که مستقیماً در `unit-service.ts` استفاده می‌شود اضافه شد؛ فیلترهای `scope=unit` و `unit_id` نیز اعمال می‌شوند.
- aggregate عمومی اکنون خبر، اطلاعیه، رویداد و گالری را با فیلدهای یکسان برمی‌گرداند.
- مدل‌ها و serializerهای واحد، دپارتمان، اسلاید، گالری، خبر و اطلاعیه از فایل آپلودی و URL جایگزین پشتیبانی می‌کنند.
- خطای serialization مربوط به `FieldFile` در واحدها رفع شد.
- parsing بلاک‌های EditorJS و alias اشتباه `qoute` اصلاح شد و URL تصویر بدون استفاده از متغیر مقداردهی‌نشده اعتبارسنجی می‌شود.
- مسیرهای CMS که در صفحات عمومی فرانت استفاده شده‌اند برای درخواست ناشناس فقط داده فعال/منتشرشده را نشان می‌دهند؛ عملیات نوشتن همچنان کنترل دسترسی دارد.

### تنظیمات اجرا

- originهای محلی فرانت برای CORS و CSRF (`localhost:3000` و `127.0.0.1:3000`) تنظیم شدند.
- migrationهای لازم برای فیلدهای URL رسانه، گالری، درخواست ثبت‌نام و مدل‌های عملیاتی داشبورد اضافه شدند.
- migration معیوب مسیر hero در تنظیمات سایت اصلاح شد.

## صحت‌سنجی نهایی

| بررسی | نتیجه |
|---|---|
| کل تست‌های Django | ۲۳۲ تست، همگی موفق |
| تست‌های قراردادی جدید با payload دقیق فرانت | موفق |
| `makemigrations --check --dry-run` | بدون تغییر ثبت‌نشده |
| اجرای migration روی دیتابیس خالی | موفق |
| Django system check | بدون issue |
| تولید OpenAPI | صفر error؛ warningهای نام‌گذاری schema باقی است |
| نصب تمیز وابستگی‌های فرانت | موفق، ۴۲۲ package |
| `next build` و TypeScript | موفق |
| تولید صفحات فرانت | ۱۰۰ از ۱۰۰ صفحه موفق |

## نکتهٔ باقی‌مانده در خود فرانت

در `frontend/src/lib/auth/login-service.ts`، شاخه API مقدار `unitId` را به صورت ثابت `null` ذخیره می‌کند و type `AccountUser` نیز هنوز `unit_id` را تعریف نکرده است. پاسخ بک‌اند اکنون `unit_id` را فراهم می‌کند و عملیات حساس سمت سرور بدون اتکا به این مقدار ایمن شده‌اند، اما برای نمایش و فیلتر کاملاً صحیح در کلاینت بهتر است در یک تغییر مستقل فرانت، `unitId: response.user.unit_id` استفاده شود. طبق خواسته، سورس فرانت تغییر داده نشده است.

## اجرای نسخه اصلاح‌شده

پس از جایگزینی کد، migrationها اجرا شوند:

```bash
python manage.py migrate
python manage.py check
python manage.py test --settings=config.settings.test
```

