# Besat Site Backend — Phase 6 Documentation

## Accounts, Auth, Profile, Roles

آخرین وضعیت مستندشده: فاز ۶ بک‌اند

این سند توضیح می‌دهد که فاز ۶ بک‌اند چه چیزهایی اضافه می‌کند و فرانت‌اند چطور باید از APIهای مربوط به login، profile، نقش‌ها، permissionها و واحدهای قابل دسترسی کاربر استفاده کند.

---

## 1. هدف فاز ۶

فاز ۶ برای این ساخته شده که فرانت بتواند:

- کاربر را login کند.
- access token و refresh token بگیرد.
- اطلاعات کاربر فعلی را دریافت کند.
- profile کاربر را بخواند و ویرایش کند.
- avatar آپلود کند.
- role کاربر را تشخیص دهد.
- واحدهای قابل دسترسی کاربر را دریافت کند.
- permissionهای لازم برای routing و نمایش پنل‌ها را بگیرد.

---

## 2. Base URL

در محیط توسعه:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

در فرانت نباید دوباره `/api` به URL اضافه شود.

درست:

```ts
fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login/`)
```

اشتباه:

```ts
fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login/`)
```

---

## 3. Dependency لازم

در `requirements.txt` باید این پکیج وجود داشته باشد:

```txt
djangorestframework-simplejwt>=5.3,<6.0
```

---

## 4. App اضافه‌شده

```txt
apps/accounts/
  __init__.py
  apps.py
  models.py
  serializers.py
  views.py
  urls.py
  admin.py
  permissions.py
  selectors.py
  signals.py
  validators.py
  migrations/
```

---

## 5. تنظیمات لازم در `config/settings/base.py`

### 5.1 import لازم

```python
from datetime import timedelta
```

### 5.2 اضافه شدن appهای لازم

داخل `THIRD_PARTY_APPS`:

```python
"rest_framework_simplejwt.token_blacklist",
```

داخل `LOCAL_APPS`:

```python
"apps.accounts",
```

### 5.3 تنظیمات DRF

```python
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}
```

### 5.4 تنظیمات JWT

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
```

---

## 6. URL اصلی پروژه

در `config/urls.py` باید این خط اضافه شود:

```python
path("api/", include("apps.accounts.urls")),
```

نمونه:

```python
urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.site_settings.urls")),
    path("api/", include("apps.units.urls")),
    path("api/", include("apps.departments.urls")),
    path("api/", include("apps.news.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
```

---

## 7. مدل‌های فاز ۶

## 7.1 UserProfile

این مدل اطلاعات تکمیلی کاربر و نقش اصلی او را نگه می‌دارد.

```txt
UserProfile
  user
  full_name
  phone
  description
  avatar
  role
  is_active
  created_at
  updated_at
```

### roleهای اصلی

```txt
general_manager
unit_manager
unit_media
parent
```

### توضیح roleها

| Role | توضیح |
|---|---|
| `general_manager` | مدیر کل؛ دسترسی کامل به همه واحدها و محتواها |
| `unit_manager` | مدیر واحد؛ دسترسی مدیریتی به واحدهای خودش |
| `unit_media` | مسئول رسانه واحد؛ دسترسی رسانه‌ای به واحدهای خودش |
| `parent` | والد؛ دسترسی محدود به پنل والدین |

---

## 7.2 UserUnitMembership

این مدل مشخص می‌کند هر کاربر به کدام واحد آموزشی دسترسی دارد.

```txt
UserUnitMembership
  user
  unit
  role
  is_active
  created_at
  updated_at
```

### role در واحد

```txt
unit_manager
unit_media
parent
```

### قانون مهم

کاربر با role اصلی `general_manager` نیازی به عضویت واحدی ندارد، چون به همه واحدهای فعال دسترسی دارد.

---

## 8. Endpointهای فاز ۶

```http
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/

GET  /api/me/
GET  /api/me/profile/
PATCH /api/me/profile/
POST /api/me/profile/avatar/

GET /api/me/permissions/
GET /api/me/units/
```

---

# 9. Auth API

## 9.1 Login

```http
POST /api/auth/login/
Content-Type: application/json
```

### Request

```json
{
  "username": "admin",
  "password": "your-password"
}
```

### Response

```json
{
  "refresh": "refresh-token",
  "access": "access-token",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "",
    "full_name": null,
    "phone": null,
    "avatar": null,
    "role": "general_manager",
    "role_display": "مدیر کل",
    "redirect_path": "/admin",
    "is_staff": true,
    "is_superuser": true
  },
  "redirect_path": "/admin"
}
```

### استفاده در فرانت

بعد از login، فرانت باید این مقادیر را ذخیره کند:

```txt
access
refresh
user.role
redirect_path
```

و سپس بر اساس `redirect_path` کاربر را به پنل مناسب هدایت کند.

---

## 9.2 Refresh Token

```http
POST /api/auth/refresh/
Content-Type: application/json
```

### Request

```json
{
  "refresh": "refresh-token"
}
```

### Response

```json
{
  "access": "new-access-token",
  "refresh": "new-refresh-token"
}
```

چون `ROTATE_REFRESH_TOKENS=True` است، هر بار refresh جدید برمی‌گردد. فرانت باید refresh قبلی را دور بیندازد و refresh جدید را ذخیره کند.

---

## 9.3 Logout

```http
POST /api/auth/logout/
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

### Request

```json
{
  "refresh": "refresh-token"
}
```

### Response

```txt
204 No Content
```

بعد از logout، فرانت باید access token و refresh token را از storage پاک کند.

---

# 10. Current User API

## 10.1 Get Me

```http
GET /api/me/
Authorization: Bearer ACCESS_TOKEN
```

### Response

```json
{
  "id": 1,
  "username": "admin",
  "email": "",
  "full_name": null,
  "phone": null,
  "avatar": null,
  "role": "general_manager",
  "role_display": "مدیر کل",
  "redirect_path": "/admin",
  "is_staff": true,
  "is_superuser": true
}
```

### کاربرد در فرانت

این endpoint برای این موارد استفاده می‌شود:

- گرفتن اطلاعات کاربر بعد از refresh صفحه.
- تشخیص role کاربر.
- تشخیص redirect path.
- نمایش نام، ایمیل، avatar و وضعیت کاربر در layout پنل.

---

# 11. Profile API

## 11.1 Get Profile

```http
GET /api/me/profile/
Authorization: Bearer ACCESS_TOKEN
```

### Response

```json
{
  "id": 1,
  "username": "admin",
  "email": "",
  "full_name": null,
  "phone": null,
  "description": null,
  "avatar": null,
  "role": "general_manager",
  "role_display": "مدیر کل",
  "is_active": true,
  "created_at": "2026-06-21T10:00:00+03:30",
  "updated_at": "2026-06-21T10:00:00+03:30"
}
```

---

## 11.2 Update Profile

```http
PATCH /api/me/profile/
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

### Request

```json
{
  "full_name": "علی رضایی",
  "phone": "09120000000",
  "email": "ali@example.com",
  "description": "توضیحات پروفایل"
}
```

### Response

همان profile آپدیت‌شده برمی‌گردد.

---

## 11.3 Upload Avatar

```http
POST /api/me/profile/avatar/
Authorization: Bearer ACCESS_TOKEN
Content-Type: multipart/form-data
```

### Form Data

```txt
avatar=<image-file>
```

### فرمت‌های مجاز

```txt
jpg
jpeg
png
webp
```

### حداکثر حجم

```txt
3MB
```

### Response

همان profile آپدیت‌شده با avatar جدید برمی‌گردد.

---

# 12. Permissions API

## 12.1 Get Permissions

```http
GET /api/me/permissions/
Authorization: Bearer ACCESS_TOKEN
```

### Response

```json
{
  "role": "general_manager",
  "role_display": "مدیر کل",
  "redirect_path": "/admin",
  "is_staff": true,
  "is_superuser": true,
  "permissions": {
    "can_access_general_manager_panel": true,
    "can_access_unit_manager_panel": true,
    "can_access_media_panel": true,
    "can_access_parent_panel": false,
    "can_manage_all_units": true,
    "can_manage_unit_content": true,
    "can_manage_media": true,
    "can_manage_news": true,
    "can_manage_announcements": true,
    "can_manage_gallery": true,
    "can_review_content": true,
    "can_publish_content": true,
    "can_view_dashboard": true
  },
  "django_permissions": [
    "news.add_news",
    "news.change_news"
  ]
}
```

### کاربرد در فرانت

فرانت باید از `permissions` برای کنترل نمایش منوها و دسترسی به صفحات استفاده کند.

مثال:

```ts
if (permissions.can_manage_news) {
  // show news management menu
}
```

---

# 13. Accessible Units API

## 13.1 Get My Units

```http
GET /api/me/units/
Authorization: Bearer ACCESS_TOKEN
```

### Response برای general_manager

```json
[
  {
    "id": 1,
    "title": "دبستان",
    "slug": "primary-school",
    "access_role": "general_manager",
    "access_role_display": "مدیر کل"
  }
]
```

### Response برای unit_manager یا unit_media

```json
[
  {
    "id": 1,
    "title": "دبستان",
    "slug": "primary-school",
    "access_role": "unit_manager",
    "access_role_display": "مدیر واحد"
  }
]
```

### کاربرد در فرانت

این endpoint برای این موارد استفاده می‌شود:

- ساخت unit switcher در پنل.
- محدود کردن فرم‌های CMS به واحدهای مجاز.
- گرفتن `unit_id` برای queryهای unit-scoped.

---

# 14. Header احراز هویت

تمام endpointهای protected باید header زیر را داشته باشند:

```http
Authorization: Bearer ACCESS_TOKEN
```

مثال:

```ts
const res = await fetch(`${API_BASE_URL}/me/`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

# 15. نمونه client برای فرانت

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json();
}

export async function refreshToken(refresh: string) {
  const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    throw new Error("Refresh token failed");
  }

  return res.json();
}

export async function logout(accessToken: string, refresh: string) {
  const res = await fetch(`${API_BASE_URL}/auth/logout/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok && res.status !== 204) {
    throw new Error("Logout failed");
  }
}

export async function getMe(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/me/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch current user");
  }

  return res.json();
}

export async function getProfile(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/me/profile/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch profile");
  }

  return res.json();
}

export async function updateProfile(
  accessToken: string,
  payload: {
    full_name?: string;
    phone?: string;
    email?: string;
    description?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/me/profile/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to update profile");
  }

  return res.json();
}

export async function uploadAvatar(accessToken: string, file: File) {
  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch(`${API_BASE_URL}/me/profile/avatar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload avatar");
  }

  return res.json();
}

export async function getMyPermissions(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/me/permissions/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch permissions");
  }

  return res.json();
}

export async function getMyUnits(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/me/units/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user units");
  }

  return res.json();
}
```

---

# 16. Error Handling

## Login error

اگر username/password اشتباه باشد، response معمولاً `401` است.

نمونه:

```json
{
  "detail": "No active account found with the given credentials"
}
```

## Profile inactive

اگر profile کاربر غیرفعال باشد:

```json
{
  "detail": "حساب کاربری شما غیرفعال است."
}
```

## Avatar validation error

```json
{
  "avatar": [
    "حجم تصویر پروفایل نباید بیشتر از ۳ مگابایت باشد."
  ]
}
```

---

# 17. Migration و اجرای اولیه

بعد از اضافه کردن فایل‌ها:

```bat
python manage.py makemigrations accounts
python manage.py migrate
```

اگر superuser نداری:

```bat
python manage.py createsuperuser
```

سپس در Django Admin، برای user مورد نظر، `UserProfile.role` را تنظیم کن.

---

# 18. وضعیت بعد از فاز ۶

بعد از این فاز، فرانت می‌تواند این بخش‌ها را راه‌اندازی کند:

```txt
Login page
Role-based redirect
Profile page
Avatar upload
Panel layout user info
Permission-based menu rendering
Unit switcher
```

هنوز در فازهای بعدی باید این بخش‌ها کامل شوند:

```txt
CMS Permission و Unit Scope Enforcement
Announcements
Content Aggregate API
Gallery با Scope و CMS
Dashboard APIs
Contact GET/POST
Registration GET/POST
About API
```

---

# 19. قدم بعدی پیشنهادی

قدم بعدی بک‌اند:

```txt
فاز 7 — CMS Permission و Unit Scope Enforcement
```

در فاز ۷ باید کاری کنیم که:

```txt
general_manager همه محتواها را ببیند و منتشر کند.
unit_manager فقط محتوای واحدهای خودش را مدیریت کند.
unit_media فقط رسانه‌های واحدهای خودش را مدیریت کند.
parent به CMS دسترسی نداشته باشد.
```
