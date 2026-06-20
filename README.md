# Besat Site

وب‌سایت جدید مدرسه بعثت

این پروژه با هدف بازطراحی و پیاده‌سازی نسخه جدید وب‌سایت مدرسه بعثت ساخته می‌شود.

---

## اصل مهم پروژه

در نسخه نهایی سایت، هیچ محتوای فیک، حدسی یا نمونه نباید وجود داشته باشد.

تمام موارد زیر باید فقط از منابع معتبر و تأییدشده استفاده شوند:

- متن‌ها
- آمارها
- تصاویر
- اخبار
- افتخارات
- شماره تماس
- آدرس
- اطلاعات ثبت‌نام
- اطلاعات کادر مدرسه
- محتوای معرفی واحدها و دپارتمان‌ها

اگر داده‌ای هنوز تأیید نشده باشد، در فرانت‌اند فقط با عنوان `TODO` مشخص می‌شود و نباید وارد نسخه نهایی شود.

---

## Tech Stack

```txt
Frontend: Next.js + TypeScript + Tailwind CSS
Backend: Django + Django REST Framework
Database: PostgreSQL
Admin Panel: Django Admin
API Format: REST JSON
```

---

## Project Structure

```txt
besat_site/
  frontend/   # Next.js frontend
  backend/    # Django backend
  docs/       # Shared documents and API contracts
```

---

## Frontend Responsibility

فرانت‌اند مسئول پیاده‌سازی ظاهر و تجربه کاربری سایت است.

صفحات اصلی فرانت‌اند:

```txt
Home Page
About Page
Units Page
Departments Page
News List Page
News Detail Page
Gallery Page
Achievements Page
Contact Page
Registration Page
```

فرانت‌اند نباید داده واقعی را به‌صورت hard-code در نسخه نهایی نگه دارد.

داده‌ها باید از API بک‌اند دریافت شوند.

---

## Backend Responsibility

بک‌اند مسئول مدیریت داده‌ها، API، دیتابیس و پنل مدیریت است.

بک‌اند باید با Django و Django REST Framework پیاده‌سازی شود.

پنل مدیریت Django باید امکان مدیریت این موارد را داشته باشد:

```txt
Site Settings
School Units
Departments
News
Gallery
Achievements
Contact Messages
Registration Requests
Staff
```

---

## Initial Backend Apps

```txt
backend/
  config/
  apps/
    core/
    site_settings/
    units/
    departments/
    news/
    gallery/
    achievements/
    contact/
    registration/
    staff/
```

---

## Initial API Contract

APIهای اولیه مورد نیاز فرانت‌اند:

```txt
GET  /api/site-settings/
GET  /api/home/

GET  /api/units/
GET  /api/units/{slug}/

GET  /api/departments/
GET  /api/departments/{slug}/

GET  /api/news/
GET  /api/news/{slug}/

GET  /api/gallery/
GET  /api/gallery/{slug}/

GET  /api/achievements/
GET  /api/achievements/{slug}/

POST /api/contact/
POST /api/registration/
```

---

## Data Rules

### Allowed Data

```txt
Verified school data
Official school website data
Official photos and documents
School-approved text and statistics
```

### Temporary Data

در زمان طراحی UI می‌توان از placeholder استفاده کرد، اما باید واضح مشخص شود:

```txt
TODO: Replace with verified school data
```

### Forbidden Data

```txt
Fake statistics
Fake phone numbers
Fake addresses
Fake achievements
Fake news
Unrelated images
Unapproved school information
```

---

## Git Workflow

برای هر مرحله باید یک commit جداگانه ایجاد شود.

نمونه پیام commit:

```txt
chore: initialize project structure
docs: add project readme
feat: setup next frontend
feat: create main layout
feat: build home hero section
fix: resolve navbar responsive issue
```

---

## Branching

فعلاً شاخه اصلی پروژه:

```txt
main
```

در صورت نیاز برای توسعه بخش‌های بزرگ‌تر:

```txt
feature/frontend-setup
feature/home-page
feature/backend-api
feature/news-module
```

---

## Development Rule

توسعه پروژه مرحله‌به‌مرحله انجام می‌شود.

در هر مرحله:

```txt
1. تغییر مشخص انجام می‌شود
2. پروژه تست می‌شود
3. تغییرات commit می‌شود
4. سپس مرحله بعد شروع می‌شود
```

---

## Documentation

تمام قراردادهای مشترک فرانت‌اند و بک‌اند باید داخل پوشه `docs` نگهداری شوند.

```txt
docs/
  backend-structure-and-api-contract.md
  content-verification.md
```

---

## Current Status

```txt
Project structure is being prepared.
Frontend project has not been created yet.
Backend project has not been created yet.
```
