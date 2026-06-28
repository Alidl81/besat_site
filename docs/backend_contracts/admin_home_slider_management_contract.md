# Admin Home Slider Management Contract

## Feature

```txt
مدیریت اسلایدر صفحه اصلی توسط مدیر کل
Frontend
Admin route: /admin/home-slider
Component: frontend/src/components/dashboard/panel-home-slider-content.tsx
Public component: frontend/src/components/home/home-slider-section.tsx
Static config: frontend/src/lib/home/home-slider-data.ts
Image folder: frontend/public/images/home-slider/
Admin Permission
Role: general_manager
Unit scoped: no
Public Endpoint
Status: frontend-ready-backend-pending
Method: GET
Path: home/slides/
Auth required: no
Admin Endpoints
Status: frontend-ready-backend-pending
GET    cms/home-slides/
POST   cms/home-slides/
PATCH  cms/home-slides/{id}/
DELETE cms/home-slides/{id}/
Request
type HomeSlideRequest = {
  title?: string | null;
  subtitle?: string | null;
  href: string;
  image_alt: string;
  image: File;
  is_active: boolean;
  sort_order?: number;
};
Response
type HomeSlideResponse = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  image: string;
  image_alt: string;
  href: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
Empty State
موردی برای نمایش وجود ندارد.
Notes
مدیر کل باید بتواند تصویر، عنوان، توضیح، لینک، متن جایگزین، ترتیب و وضعیت انتشار اسلاید را مدیریت کند.
در سایت عمومی اگر اسلایدی وجود نداشته باشد، اسلایدر نمایش داده نمی‌شود.

