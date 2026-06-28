# Home Slider Backend Contract

## Feature

```txt
اسلایدر صفحه اصلی
Frontend
Route: /
Component: frontend/src/components/home/home-slider-section.tsx
Static config: frontend/src/lib/home/home-slider-data.ts
Image folder: frontend/public/images/home-slider/
Current Data Source
Status: frontend-static-config

فعلاً اسلایدها از آرایه homeSlides خوانده می‌شوند. اگر آرایه خالی باشد، اسلایدر نمایش داده نمی‌شود.

Future Backend Endpoint
Status: frontend-ready-backend-pending
Method: GET
Path: home/slides/
Auth required: no
Future Admin Endpoint
Status: frontend-ready-backend-pending
Methods: GET, POST, PATCH, DELETE
Path: cms/home-slides/
Auth required: yes
Roles: general_manager
Unit scoped: no
Response
type HomeSlide = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  image: string;
  image_alt: string;
  link_url: string;
  is_active: boolean;
  sort_order: number;
  starts_at?: string | null;
  ends_at?: string | null;
};
Frontend Mapping
type HomeSlideViewModel = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
  title?: string;
  subtitle?: string;
};
Behavior
اسلایدها خودکار با انیمیشن نرم تغییر می‌کنند.
کاربر می‌تواند با نقطه‌های پایین اسلایدر اسلاید فعال را تغییر دهد.
هر اسلاید می‌تواند لینک اختصاصی داشته باشد.
اگر هیچ اسلایدی وجود نداشته باشد، اسلایدر در UI نمایش داده نمی‌شود.
Notes
مدیر کل باید بتواند عکس، متن، لینک، ترتیب و وضعیت فعال بودن هر اسلاید را مدیریت کند.
هیچ داده فیک یا placeholder در UI استفاده نشده است.

