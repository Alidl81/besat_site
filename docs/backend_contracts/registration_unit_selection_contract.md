# Registration Unit Selection Contract

## Feature

```txt
انتخاب واحد در صفحه پیش‌ثبت‌نام
Frontend
Route: /registration
Main component: frontend/src/components/auth/preregistration-card.tsx
Selector component: frontend/src/components/registration/registration-unit-selector.tsx
Data source: unitsRepository
Behavior
در دسکتاپ، واحدها به صورت گردونه انتخاب می‌شوند.
در موبایل، واحدها به صورت dropdown انتخاب می‌شوند.
فیلد واحد از پایه جدا شده است.
فرم پیش‌ثبت‌نام هنگام ارسال، unit_id را هم ارسال می‌کند.
Public Data Needed
Active units list
Registration Payload
type RegistrationRequestPayload = {
  full_name: string;
  parent_phone: string;
  requested_grade: string;
  unit_id: string;
  description?: string;
};
Endpoint
POST registration/
Backend Notes
مدل ثبت‌نام باید unit_id را ذخیره کند.
اگر unit_id ارسال نشود، بک‌اند باید خطای validation برگرداند.
فهرست واحدها باید فقط واحدهای فعال را برای انتخاب نمایش بدهد.

