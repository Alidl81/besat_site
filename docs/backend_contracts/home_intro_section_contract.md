# Home Intro Section Contract

## Feature

```txt
بخش معرفی کوتاه زیر اسلایدر صفحه اصلی
Frontend
Route: /
Component: frontend/src/components/home/home-intro-section.tsx
Static config: frontend/src/lib/home/home-intro-data.ts
Image folder: frontend/public/images/home/intro/
Current Data Source
Status: frontend-static-config
Future Backend Endpoint
Status: frontend-ready-backend-pending
Method: GET
Path: site-settings/home-intro/
Auth required: no
Future Admin Endpoint
Status: frontend-ready-backend-pending
Method: PATCH
Path: cms/site-settings/home-intro/
Auth required: yes
Roles: general_manager
Unit scoped: no
Response
type HomeIntroResponse = {
  eyebrow?: string | null;
  title: string;
  body: string;
  image: string;
  image_alt: string;
  primary_link_label: string;
  primary_link_url: string;
  secondary_link_label: string;
  secondary_link_url: string;
};
Empty Behavior
اگر title، body یا imageSrc موجود نباشد، بخش معرفی در صفحه اصلی نمایش داده نمی‌شود.
Notes
این بخش برای معرفی کوتاه مجموعه در زیر اسلایدر است.
مدیر کل باید بتواند متن، تصویر و لینک‌های این بخش را مدیریت کند.
هیچ داده فیک یا placeholder در UI نمایش داده نمی‌شود.

