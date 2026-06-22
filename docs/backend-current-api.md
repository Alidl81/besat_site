Besat Site Backend — Current API Documentation

آخرین وضعیت مستندشده: تا پایان اصلاحات فاز 5

این سند وضعیت فعلی بک‌اند سایت مدرسه بعثت را توضیح می‌دهد و مشخص می‌کند فرانت‌اند چگونه باید از APIهای موجود استفاده کند.

1. Base URL

در محیط توسعه:

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api

در فرانت نباید دوباره /api اضافه شود.

درست:

fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/news/`)

اشتباه:

fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/news/`)
2. تکنولوژی‌های بک‌اند
Language: Python
Framework: Django
API: Django REST Framework
Database: PostgreSQL در هدف نهایی، SQLite فقط برای توسعه ساده
API Docs: drf-spectacular / Swagger
CORS: django-cors-headers
Media: Django Media در فاز فعلی
3. endpointهای پایه
Health Check
GET /api/health/

Response:

{
  "status": "ok",
  "service": "besat-backend"
}
Swagger Schema
GET /api/schema/
Swagger UI
GET /api/docs/
4. Site Settings
هدف

نگهداری اطلاعات عمومی سایت مثل نام مدرسه، لوگو، شعار، hero، اطلاعات تماس، شبکه‌های اجتماعی و آمارهای قابل نمایش.

نکته مهم

اگر اطلاعاتی تأیید نشده باشد، نباید مقدار ساختگی داشته باشد. مقدار باید null باشد.

Endpoint
GET /api/site-settings/
Response
{
  "school_name": null,
  "short_name": null,
  "slogan": null,
  "intro_text": null,
  "logo": null,
  "favicon": null,
  "hero_title": null,
  "hero_subtitle": null,
  "hero_image": null,
  "address": null,
  "phone_primary": null,
  "phone_secondary": null,
  "email": null,
  "working_hours": null,
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
استفاده در فرانت
export async function getSiteSettings() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/site-settings/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch site settings");
  }

  return res.json();
}
نکته برای UI

اگر مقدارهای آماری null بودند، کارت آماری نباید نمایش داده شود.

مثال:

if (settings.students_count !== null) {
  // render students count card
}
5. Units
هدف

نمایش واحدهای آموزشی مدرسه.

نکته مهم

آیکون واحدها در دیتابیس واحد ذخیره نمی‌شود. چون آیکون همه واحدها همان لوگوی اصلی مدرسه است، مقدار icon از SiteSettings.logo خوانده می‌شود.

Endpoints
GET /api/units/
GET /api/units/{slug}/
GET /api/units/{id}/

هر دو حالت slug و id برای detail پشتیبانی می‌شوند.

Query Params
search
ordering

نمونه‌ها:

GET /api/units/?search=دبستان
GET /api/units/?ordering=order
GET /api/units/?ordering=-title
List Response
[
  {
    "id": 1,
    "title": "دبستان",
    "slug": "primary-school",
    "subtitle": null,
    "description": null,
    "cover_image": null,
    "icon": "http://127.0.0.1:8000/media/site/settings/logo/logo.png",
    "age_range": null,
    "grade_range": null
  }
]
استفاده در فرانت
export async function getUnits() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/units/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch units");
  }

  return res.json();
}

برای صفحه detail:

export async function getUnit(slugOrId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/units/${slugOrId}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch unit");
  }

  return res.json();
}
6. Departments
هدف

نمایش دپارتمان‌ها یا گروه‌های آموزشی.

Endpoints
GET /api/departments/
GET /api/departments/{slug}/
Query Params
search
ordering

نمونه‌ها:

GET /api/departments/?search=علوم
GET /api/departments/?ordering=order
GET /api/departments/?ordering=-title
Response
[
  {
    "id": 1,
    "title": "دپارتمان علوم",
    "slug": "science",
    "short_description": null,
    "description": null,
    "icon": null,
    "cover_image": null
  }
]
استفاده در فرانت
export async function getDepartments() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/departments/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch departments");
  }

  return res.json();
}

برای detail:

export async function getDepartment(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/departments/${slug}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch department");
  }

  return res.json();
}
7. News
هدف

مدیریت و نمایش اخبار مدرسه، همراه با CMS جداگانه برای نوشتن خبر و امکان قرار دادن عکس داخل متن خبر.

مدل مفهومی
NewsCategory
  id
  title
  slug
  order
  is_active

News
  id
  title
  slug
  category
  summary
  cover_image
  content_json
  content_text
  scope
  unit
  status
  published_at
  is_featured
  is_active
  created_by
  updated_by
  published_by
  created_at
  updated_at

NewsMedia
  id
  news
  image
  alt_text
  caption
  uploaded_by
  created_at
7.1 News Scope

خبر می‌تواند عمومی مدرسه یا مربوط به یک واحد خاص باشد.

scope = school
scope = unit

قانون:

scope=school => unit باید null باشد
scope=unit   => unit الزامی است
7.2 News Status

وضعیت‌های خبر:

draft
waiting_review
approved
published
rejected
archived

API عمومی فقط خبرهای published را نشان می‌دهد.

7.3 Public News API
List
GET /api/news/
Detail
GET /api/news/{slug}/
Categories
GET /api/news/categories/
7.4 Public Query Params
page
scope
unit_id
status
category
search
featured
ordering

نمونه‌ها:

GET /api/news/?scope=school&status=published
GET /api/news/?scope=unit&unit_id=1&status=published
GET /api/news/?search=ثبت نام
GET /api/news/?category=announcements
GET /api/news/?featured=true
GET /api/news/?ordering=-published_at

نکته: در Public API حتی اگر status ارسال نشود، فقط خبرهای منتشرشده نمایش داده می‌شوند.

7.5 Public News List Response

خروجی list صفحه‌بندی شده است:

{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "عنوان خبر",
      "slug": "news-title",
      "summary": "خلاصه خبر",
      "cover_image": "http://127.0.0.1:8000/media/news/covers/2026/06/example.webp",
      "published_at": "2026-06-21",
      "category": {
        "title": "اطلاعیه‌ها",
        "slug": "announcements"
      },
      "scope": "school",
      "unit": null,
      "status": "published",
      "is_featured": false,
      "is_published": true
    }
  ]
}
7.6 Public News Detail Response
{
  "id": 1,
  "title": "عنوان خبر",
  "slug": "news-title",
  "summary": "خلاصه خبر",
  "content_json": {
    "time": null,
    "blocks": [
      {
        "type": "paragraph",
        "data": {
          "text": "متن خبر"
        }
      },
      {
        "type": "image",
        "data": {
          "file": {
            "url": "http://127.0.0.1:8000/media/news/content/2026/06/image.webp"
          },
          "caption": "کپشن تصویر"
        }
      }
    ],
    "version": null
  },
  "cover_image": null,
  "published_at": "2026-06-21",
  "category": {
    "title": "اطلاعیه‌ها",
    "slug": "announcements"
  },
  "scope": "school",
  "unit": null,
  "status": "published",
  "is_featured": false,
  "is_published": true
}
7.7 استفاده از News در فرانت
گرفتن لیست اخبار عمومی مدرسه
export async function getSchoolNews() {
  const params = new URLSearchParams({
    scope: "school",
    status: "published",
  });

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/news/?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch school news");
  }

  return res.json();
}
گرفتن اخبار یک واحد
export async function getUnitNews(unitId: number) {
  const params = new URLSearchParams({
    scope: "unit",
    unit_id: String(unitId),
    status: "published",
  });

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/news/?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch unit news");
  }

  return res.json();
}
جستجو در اخبار
export async function searchNews(query: string) {
  const params = new URLSearchParams({
    search: query,
  });

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/news/?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to search news");
  }

  return res.json();
}
گرفتن detail خبر
export async function getNewsDetail(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/news/${slug}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch news detail");
  }

  return res.json();
}
8. News CMS API
هدف

این API برای صفحه جداگانه نوشتن خبر است، نه Django Admin.

نویسنده محتوا از این APIها برای ساخت draft، ویرایش، ارسال برای بررسی، انتشار و آپلود عکس داخل متن استفاده می‌کند.

نکته مهم

این endpointها عمومی نیستند و نیاز به authentication و permission دارند. در حال حاضر معماری permission بر اساس permissionهای Django طراحی شده، ولی app کامل accounts/auth هنوز باید ساخته شود.

8.1 CMS News Endpoints
GET    /api/cms/news/
POST   /api/cms/news/
GET    /api/cms/news/{id}/
PATCH  /api/cms/news/{id}/
PUT    /api/cms/news/{id}/
DELETE /api/cms/news/{id}/
POST   /api/cms/news/{id}/upload-image/
8.2 CMS News Category Endpoints
GET    /api/cms/news/categories/
POST   /api/cms/news/categories/
GET    /api/cms/news/categories/{id}/
PATCH  /api/cms/news/categories/{id}/
PUT    /api/cms/news/categories/{id}/
DELETE /api/cms/news/categories/{id}/
8.3 ساخت draft خبر
POST /api/cms/news/
Content-Type: application/json
Authorization: Bearer ACCESS_TOKEN

Request:

{
  "title": "عنوان خبر",
  "summary": "خلاصه خبر",
  "scope": "school",
  "unit": null,
  "status": "draft",
  "published_at": null,
  "is_featured": false,
  "is_active": true,
  "content_json": {
    "time": null,
    "blocks": [],
    "version": null
  }
}

Response:

{
  "id": 1,
  "title": "عنوان خبر",
  "slug": "عنوان-خبر",
  "category": null,
  "summary": "خلاصه خبر",
  "cover_image": null,
  "content_text": null,
  "scope": "school",
  "unit": null,
  "status": "draft",
  "published_at": null,
  "is_featured": false,
  "is_active": true,
  "created_by": "username",
  "updated_by": "username",
  "published_by": null,
  "created_at": "2026-06-21T10:00:00+03:30",
  "updated_at": "2026-06-21T10:00:00+03:30"
}
8.4 ساخت خبر مربوط به یک واحد
{
  "title": "خبر واحد دبستان",
  "summary": "خلاصه خبر",
  "scope": "unit",
  "unit": 1,
  "status": "draft",
  "content_json": {
    "time": null,
    "blocks": [],
    "version": null
  }
}

اگر scope=unit باشد و unit ارسال نشود، backend خطای validation می‌دهد.

8.5 انتشار خبر

برای اینکه خبر در سایت عمومی دیده شود:

status باید published باشد
published_at باید مقدار داشته باشد
summary باید مقدار داشته باشد
content_json باید متن قابل استخراج داشته باشد
is_active باید true باشد
اگر category دارد، category باید active باشد
اگر unit دارد، unit باید active باشد

PATCH:

PATCH /api/cms/news/1/
Content-Type: application/json
Authorization: Bearer ACCESS_TOKEN
{
  "status": "published",
  "published_at": "2026-06-21"
}
8.6 آپلود عکس داخل متن خبر

برای استفاده با Editor.js یا editor مشابه:

POST /api/cms/news/{id}/upload-image/
Content-Type: multipart/form-data
Authorization: Bearer ACCESS_TOKEN

Form Data:

image=<file>
alt_text=متن جایگزین تصویر
caption=کپشن تصویر

Response:

{
  "success": 1,
  "file": {
    "url": "http://127.0.0.1:8000/media/news/content/2026/06/image.webp",
    "id": 1,
    "alt_text": "متن جایگزین تصویر",
    "caption": "کپشن تصویر"
  }
}

فرانت باید مقدار file.url را داخل block تصویر در content_json ذخیره کند.

نمونه block:

{
  "type": "image",
  "data": {
    "file": {
      "url": "http://127.0.0.1:8000/media/news/content/2026/06/image.webp"
    },
    "caption": "کپشن تصویر"
  }
}
8.7 محدودیت فایل عکس

برای upload عکس خبر فقط این فرمت‌ها پذیرفته می‌شوند:

jpg
jpeg
png
webp

حداکثر حجم:

5MB

SVG، PDF، video، zip و فایل‌های غیرتصویری پذیرفته نمی‌شوند.

9. content_json format

فرمت محتوا بر اساس ساختار block editor است.

blockهای مجاز
paragraph
header
list
quote
delimiter
image
نمونه content_json
{
  "time": null,
  "blocks": [
    {
      "type": "header",
      "data": {
        "text": "عنوان داخل متن",
        "level": 2
      }
    },
    {
      "type": "paragraph",
      "data": {
        "text": "متن پاراگراف خبر"
      }
    },
    {
      "type": "list",
      "data": {
        "style": "unordered",
        "items": [
          "مورد اول",
          "مورد دوم"
        ]
      }
    },
    {
      "type": "image",
      "data": {
        "file": {
          "url": "http://127.0.0.1:8000/media/news/content/2026/06/image.webp"
        },
        "caption": "کپشن تصویر"
      }
    }
  ],
  "version": null
}
10. رفتار Search
News search
GET /api/news/?search=ثبت نام

جستجو روی این فیلدها انجام می‌شود:

title
summary
content_text
category.title
unit.title

نکته: content_text از روی content_json استخراج می‌شود و برای search استفاده می‌شود.

11. Error Handling برای فرانت
الگوی کلی

اگر validation خطا داشته باشد، backend معمولاً response با status 400 برمی‌گرداند.

نمونه:

{
  "unit": [
    "برای محتوای وابسته به واحد، انتخاب واحد آموزشی الزامی است."
  ]
}

یا:

{
  "published_at": [
    "برای انتشار خبر، تاریخ انتشار الزامی است."
  ],
  "content_json": [
    "برای انتشار خبر، متن خبر الزامی است."
  ]
}
استفاده در فرانت
async function parseApiError(res: Response) {
  const data = await res.json().catch(() => null);

  if (!data) {
    return "خطای نامشخص رخ داده است.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    return Object.entries(data)
      .map(([field, messages]) => {
        if (Array.isArray(messages)) {
          return `${field}: ${messages.join("، ")}`;
        }

        return `${field}: ${String(messages)}`;
      })
      .join("\n");
  }

  return "خطای نامشخص رخ داده است.";
}
12. بخش‌های هنوز پیاده‌سازی نشده

این‌ها هنوز باید در مراحل بعدی ساخته شوند:

accounts/auth
profile
role + unit scope
announcements
content aggregate endpoint
dashboard
gallery با scope/status
contact GET/POST
registration GET/POST
about endpoint
achievements
staff
endpointهای مورد انتظار فرانت که هنوز آماده نیستند
POST /api/auth/login/
POST /api/auth/refresh/

GET /api/me/
GET /api/me/permissions/
GET /api/me/units/
GET /api/me/profile/
PATCH /api/me/profile/

GET /api/dashboard/general-manager/
GET /api/dashboard/unit-manager/
GET /api/dashboard/media/
GET /api/dashboard/parents/

GET /api/announcements/
GET /api/announcements/{slug}/

GET /api/content/

GET /api/gallery/
GET /api/gallery/{slug}/

GET /api/contact/
POST /api/contact/

GET /api/registration/
POST /api/registration/

GET /api/about/
13. نکات مهم برای فرانت
13.1 URLها همیشه با slash آخر زده شوند

درست:

/api/news/

اشتباه:

/api/news

اگر slash آخر نباشد Django ممکن است 301 redirect بدهد.

13.2 Media URLها کامل هستند

خروجی تصویرها معمولاً کامل است:

http://127.0.0.1:8000/media/...

پس فرانت نباید دوباره base media URL اضافه کند.

13.3 مقدار null یعنی داده تأیید نشده یا وجود ندارد

فرانت نباید برای null متن فیک بسازد.

مثال:

if (settings.hero_title) {
  // render hero title
}
13.4 Public API فقط داده منتشرشده را نشان می‌دهد

برای News:

status=published
is_active=true
published_at <= today
13.5 CMS API فعلاً نیازمند auth است

فرانت CMS باید بعد از پیاده‌سازی accounts/auth، token را در header بفرستد:

headers: {
  Authorization: `Bearer ${accessToken}`,
}

تا قبل از پیاده‌سازی auth، این بخش ممکن است کامل قابل استفاده از فرانت نباشد.

14. نمونه ساخت client ساده برای فرانت
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${path}`);
  }

  return res.json();
}

استفاده:

const settings = await apiGet("/site-settings/");
const units = await apiGet("/units/");
const departments = await apiGet("/departments/");
const news = await apiGet("/news/?scope=school&status=published");
15. وضعیت فعلی آماده برای استفاده فرانت

قابل استفاده برای public frontend:

/api/site-settings/
/api/units/
/api/units/{slug}/
/api/units/{id}/
/api/departments/
/api/departments/{slug}/
/api/news/
/api/news/{slug}/
/api/news/categories/

آماده برای CMS frontend، بعد از تکمیل auth:

/api/cms/news/
/api/cms/news/{id}/
/api/cms/news/{id}/upload-image/
/api/cms/news/categories/