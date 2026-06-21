# Besat Site — Backend Structure & API Contract

این فایل برای هماهنگی بین فرانت‌اند و بک‌اند پروژه‌ی سایت مدرسه بعثت است.

## 1. معماری پیشنهادی

```txt
Repository: besat_site

besat_site/
  frontend/        # Next.js + TypeScript + Tailwind CSS
  backend/         # Django + Django REST Framework
  docs/            # مستندات مشترک، قرارداد API، قوانین محتوا
```

## 2. تکنولوژی بک‌اند

```txt
Language: Python 3.12+
Framework: Django
API: Django REST Framework
Database: PostgreSQL
Admin Panel: Django Admin
Auth: Django Admin authentication برای مدیران محتوا
API Docs: drf-spectacular / Swagger
Media Storage: Django media در فاز اول؛ در فاز دیپلوی می‌تواند object storage شود
```

## 3. قانون محتوایی مهم

هیچ اطلاعات فیک، حدسی یا نمونه نباید در نسخه نهایی سایت قرار بگیرد.

هرکدام از موارد زیر باید از سایت فعلی، مدرسه، فایل رسمی یا مدیر پروژه تأیید شود:

```txt
- نام رسمی مدرسه
- شعار اصلی
- لوگو
- عکس‌ها
- آمارها
- تعداد دانش‌آموزان
- تعداد کادر آموزشی
- افتخارات
- اخبار و اطلاعیه‌ها
- آدرس
- شماره تماس
- ایمیل
- شبکه‌های اجتماعی
```

در دیتابیس می‌توان برای تست داده موقت داشت، اما نباید روی production منتشر شود مگر تأیید شده باشد.

---

# 4. ساختار پیشنهادی پوشه بک‌اند

```txt
backend/
  manage.py
  requirements.txt
  .env.example
  README.md

  config/
    __init__.py
    settings/
      __init__.py
      base.py
      local.py
      production.py
    urls.py
    asgi.py
    wsgi.py

  apps/
    core/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      permissions.py
      pagination.py
      utils.py

    site_settings/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    units/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    departments/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    news/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    gallery/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    achievements/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    contact/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    registration/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

    staff/
      __init__.py
      models.py
      serializers.py
      views.py
      urls.py
      admin.py
      migrations/

  media/
  staticfiles/
```

---

# 5. مدل‌های پیشنهادی

## 5.1 SiteSettings

برای اطلاعات کلی سایت. بهتر است فقط یک رکورد فعال وجود داشته باشد.

```txt
SiteSettings
  id
  school_name
  short_name
  slogan
  intro_text
  logo
  favicon
  hero_title
  hero_subtitle
  hero_image
  address
  phone_primary
  phone_secondary
  email
  working_hours
  instagram_url
  telegram_url
  eitaa_url
  map_url
  founded_year
  students_count
  staff_count
  achievements_count
  units_count
  is_active
  created_at
  updated_at
```

نکته: آمارها اگر تأیید نشده باشند، null بمانند. فرانت در صورت null بودن، آن کارت را نمایش ندهد یا متن جایگزین تأییدشده بگذارد.

---

## 5.2 SchoolUnit

برای واحدهای آموزشی مدرسه.

```txt
SchoolUnit
  id
  title
  slug
  subtitle
  description
  cover_image
  icon
  age_range
  grade_range
  order
  is_active
  created_at
  updated_at
```

نمونه‌های احتمالی، فقط پس از تأیید مدرسه:

```txt
- پیش‌دبستان و دبستان
- متوسطه اول
- متوسطه دوم
```

---

## 5.3 Department

برای دپارتمان‌ها یا گروه‌های آموزشی.

```txt
Department
  id
  title
  slug
  short_description
  description
  icon
  cover_image
  order
  is_active
  created_at
  updated_at
```

---

## 5.4 NewsCategory

```txt
NewsCategory
  id
  title
  slug
  order
  is_active
```

---

## 5.5 News

```txt
News
  id
  title
  slug
  category
  summary
  content
  cover_image
  published_at
  is_published
  is_featured
  created_at
  updated_at
```

قانون مهم:

```txt
- slug باید یکتا باشد.
- فقط خبرهایی که is_published=true هستند در API عمومی نمایش داده شوند.
- published_at باید تاریخ واقعی انتشار باشد.
```

---

## 5.6 GalleryAlbum

```txt
GalleryAlbum
  id
  title
  slug
  description
  cover_image
  event_date
  order
  is_active
  created_at
  updated_at
```

---

## 5.7 GalleryImage

```txt
GalleryImage
  id
  album
  title
  image
  alt_text
  order
  is_active
  created_at
  updated_at
```

---

## 5.8 Achievement

```txt
Achievement
  id
  title
  slug
  description
  cover_image
  achievement_date
  related_unit
  is_featured
  is_active
  created_at
  updated_at
```

---

## 5.9 Staff / Teacher

```txt
Staff
  id
  full_name
  slug
  role
  bio
  photo
  department
  order
  is_active
  created_at
  updated_at
```

در نسخه اول اگر مدرسه اطلاعات کادر آموزشی را عمومی نمی‌خواهد، این بخش می‌تواند غیرفعال بماند.

---

## 5.10 ContactMessage

برای فرم تماس با ما.

```txt
ContactMessage
  id
  full_name
  phone
  email
  subject
  message
  status
  admin_note
  created_at
  updated_at
```

status پیشنهادی:

```txt
new
seen
answered
archived
```

---

## 5.11 RegistrationRequest

برای فرم پیش‌ثبت‌نام.

```txt
RegistrationRequest
  id
  student_full_name
  parent_full_name
  parent_phone
  parent_email
  requested_unit
  requested_grade
  description
  status
  admin_note
  created_at
  updated_at
```

status پیشنهادی:

```txt
new
reviewing
contacted
accepted
rejected
archived
```

---

# 6. API Endpoints مورد نیاز فرانت‌اند

Base URL در محیط توسعه:

```txt
http://localhost:8000/api/
```

در فرانت داخل `.env.local`:

```txt
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

---

## 6.1 Site Settings

```http
GET /api/site-settings/
```

Response:

```json
{
  "school_name": "مدرسه بعثت",
  "short_name": "بعثت",
  "slogan": "...",
  "intro_text": "...",
  "logo": "http://localhost:8000/media/logo.png",
  "hero_title": "...",
  "hero_subtitle": "...",
  "hero_image": "http://localhost:8000/media/hero.jpg",
  "address": "...",
  "phone_primary": "...",
  "phone_secondary": null,
  "email": "...",
  "working_hours": "...",
  "instagram_url": null,
  "telegram_url": null,
  "eitaa_url": null,
  "map_url": null,
  "founded_year": null,
  "students_count": null,
  "staff_count": null,
  "achievements_count": null,
  "units_count": null
}
```

---

## 6.2 Home Page

```http
GET /api/home/
```

Response:

```json
{
  "settings": {},
  "units": [],
  "departments": [],
  "latest_news": [],
  "featured_achievements": [],
  "featured_gallery": []
}
```

هدف این endpoint این است که صفحه اصلی با یک request قابل ساخت باشد.

---

## 6.3 Units

```http
GET /api/units/
GET /api/units/{slug}/
```

List item response:

```json
{
  "id": 1,
  "title": "...",
  "slug": "...",
  "subtitle": "...",
  "description": "...",
  "cover_image": "http://localhost:8000/media/units/unit.jpg",
  "icon": null,
  "age_range": null,
  "grade_range": null
}
```

---

## 6.4 Departments

```http
GET /api/departments/
GET /api/departments/{slug}/
```

---

## 6.5 News

```http
GET /api/news/
GET /api/news/{slug}/
```

Query params پیشنهادی:

```txt
?page=1
?category=announcements
?search=ثبت نام
```

List response:

```json
{
  "count": 25,
  "next": "http://localhost:8000/api/news/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "...",
      "slug": "...",
      "summary": "...",
      "cover_image": "http://localhost:8000/media/news/image.jpg",
      "published_at": "2026-06-20",
      "category": {
        "title": "اطلاعیه‌ها",
        "slug": "announcements"
      },
      "is_featured": true
    }
  ]
}
```

Detail response:

```json
{
  "id": 1,
  "title": "...",
  "slug": "...",
  "summary": "...",
  "content": "...",
  "cover_image": "http://localhost:8000/media/news/image.jpg",
  "published_at": "2026-06-20",
  "category": {
    "title": "اطلاعیه‌ها",
    "slug": "announcements"
  },
  "is_featured": true
}
```

---

## 6.6 Gallery

```http
GET /api/gallery/
GET /api/gallery/{slug}/
```

Album list item:

```json
{
  "id": 1,
  "title": "...",
  "slug": "...",
  "description": "...",
  "cover_image": "http://localhost:8000/media/gallery/cover.jpg",
  "event_date": "2026-06-20"
}
```

Album detail:

```json
{
  "id": 1,
  "title": "...",
  "slug": "...",
  "description": "...",
  "cover_image": "http://localhost:8000/media/gallery/cover.jpg",
  "event_date": "2026-06-20",
  "images": [
    {
      "id": 1,
      "title": "...",
      "image": "http://localhost:8000/media/gallery/image.jpg",
      "alt_text": "..."
    }
  ]
}
```

---

## 6.7 Achievements

```http
GET /api/achievements/
GET /api/achievements/{slug}/
```

---

## 6.8 Contact Form

```http
POST /api/contact/
```

Request:

```json
{
  "full_name": "...",
  "phone": "...",
  "email": "...",
  "subject": "...",
  "message": "..."
}
```

Success response:

```json
{
  "message": "پیام شما با موفقیت ثبت شد."
}
```

Validation error:

```json
{
  "phone": ["شماره تماس معتبر نیست."],
  "message": ["متن پیام الزامی است."]
}
```

---

## 6.9 Registration Form

```http
POST /api/registration/
```

Request:

```json
{
  "student_full_name": "...",
  "parent_full_name": "...",
  "parent_phone": "...",
  "parent_email": "...",
  "requested_unit": 1,
  "requested_grade": "...",
  "description": "..."
}
```

Success response:

```json
{
  "message": "درخواست پیش‌ثبت‌نام با موفقیت ثبت شد."
}
```

---

# 7. قراردادهای مهم برای فرانت

## 7.1 Slug

همه صفحات detail باید با slug کار کنند، نه id.

```txt
/news/student-day
/units/primary-school
/departments/math
/gallery/ceremony-1403
```

## 7.2 Image URL

بک‌اند بهتر است URL کامل تصویر را برگرداند:

```txt
http://localhost:8000/media/news/image.jpg
```

نه فقط:

```txt
/media/news/image.jpg
```

اگر URL کامل سخت بود، فرانت باید با `NEXT_PUBLIC_MEDIA_BASE_URL` آن را کامل کند؛ اما خروجی کامل برای هماهنگی بهتر است.

## 7.3 Null handling

اگر داده‌ای تأیید نشده یا وجود ندارد، بک‌اند باید `null` بدهد، نه متن ساختگی.

مثال:

```json
{
  "students_count": null
}
```

## 7.4 Ordering

مدل‌هایی مثل units، departments، gallery و staff باید فیلد `order` داشته باشند.

## 7.5 Published / Active

API عمومی فقط داده‌های منتشرشده و فعال را برگرداند.

```txt
is_active=true
is_published=true
```

---

# 8. مستندات API

بک‌اند بهتر است Swagger داشته باشد:

```txt
/api/schema/
/api/docs/
```

پیشنهاد پکیج:

```txt
drf-spectacular
```

---

# 9. CORS

برای توسعه محلی:

```txt
http://localhost:3000
```

بک‌اند باید CORS را برای فرانت باز کند.

پیشنهاد پکیج:

```txt
django-cors-headers
```

---

# 10. Environment Variables پیشنهادی بک‌اند

```txt
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://user:password@localhost:5432/besat_site
CORS_ALLOWED_ORIGINS=http://localhost:3000
MEDIA_URL=/media/
STATIC_URL=/static/
```

---

# 11. Definition of Done برای بک‌اند

هر بخش وقتی آماده محسوب می‌شود که:

```txt
- مدل Django ساخته شده باشد
- admin.py تنظیم شده باشد
- serializer ساخته شده باشد
- API list/detail یا create ساخته شده باشد
- URL ثبت شده باشد
- Swagger آن را نشان بدهد
- داده فیک وارد production نشده باشد
- فرانت بتواند بدون تغییر ساختار JSON از آن استفاده کند
```

---

# 12. اولویت پیاده‌سازی بک‌اند

پیشنهاد ترتیب کار:

```txt
1. راه‌اندازی پروژه Django و تنظیمات base/local/production
2. PostgreSQL و env
3. DRF + CORS + Swagger
4. SiteSettings
5. SchoolUnit
6. Department
7. News + NewsCategory
8. GalleryAlbum + GalleryImage
9. Achievement
10. ContactMessage
11. RegistrationRequest
12. Staff در صورت نیاز
13. تست نهایی API با فرانت
```
