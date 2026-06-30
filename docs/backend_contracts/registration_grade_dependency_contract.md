# Registration Grade Dependency Contract

## Feature

```txt
وابسته شدن پایه مورد نظر به واحد انتخاب‌شده در صفحه پیش‌ثبت‌نام
Frontend
Route: /registration
Form component: frontend/src/components/auth/preregistration-card.tsx
Unit selector: frontend/src/components/registration/registration-unit-selector.tsx
Grade selector: frontend/src/components/registration/registration-grade-selector.tsx
Grade rules: frontend/src/lib/registration/registration-grade-options.ts
Behavior
کاربر ابتدا واحد را انتخاب می‌کند.
لیست پایه‌ها بر اساس واحد انتخاب‌شده پر می‌شود.
در دسکتاپ انتخاب واحد داخل بخش سرمه‌ای با گردونه انجام می‌شود.
در موبایل انتخاب واحد به صورت dropdown انجام می‌شود.
فیلد requested_grade دیگر متن آزاد نیست و از گزینه‌های وابسته به واحد انتخاب می‌شود.
Data Source
قواعد فعلی پایه‌ها از اطلاعات رسمی سایت روابط عمومی مدارس بعثت برداشت شده‌اند.
در آینده بهتر است این قواعد از بک‌اند و مدل کلاس/پایه هر واحد خوانده شود.
Payload
type RegistrationRequestPayload = {
  full_name: string;
  parent_phone: string;
  requested_grade: string;
  unit_id: string;
  description?: string;
};
Backend Note
در بک‌اند باید اعتبارسنجی شود که requested_grade ارسال‌شده برای unit_id انتخاب‌شده معتبر باشد.

