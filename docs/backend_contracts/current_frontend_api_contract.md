
Current Frontend API Contract

این سند قرارداد فعلی فرانت با بک‌اند است. بک‌اند نهایی باید بر اساس این نیازها تکمیل شود.

Environment
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api

چون base URL تا /api تنظیم شده، مسیرهای فرانت نباید دوباره /api داشته باشند.

Public Site
Site Settings
Status: frontend-ready-backend-pending
Method: GET
Path: site-settings/
Auth required: no
Response
type SiteSettings = {
  school_name?: string | null;
  slogan?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};
Units List
Status: frontend-ready-backend-pending
Method: GET
Path: units/
Auth required: no
Response
type SchoolUnit = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
};
Empty State
موردی برای نمایش وجود ندارد.
Departments List
Status: frontend-ready-backend-pending
Method: GET
Path: departments/
Auth required: no
Response
type Department = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
};
Empty State
موردی برای نمایش وجود ندارد.
News List
Status: frontend-ready-backend-pending
Method: GET
Path: news/
Auth required: no
Response
type NewsItem = {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  image?: string | null;
  category?: NewsCategory | null;
  published_at?: string | null;
};
Empty State
خبری برای نمایش وجود ندارد.
Announcements List
Status: frontend-ready-backend-pending
Method: GET
Path: announcements/
Auth required: no
Response
type AnnouncementItem = {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  published_at?: string | null;
};
Empty State
اطلاعیه‌ای برای نمایش وجود ندارد.
Account
Login
Status: frontend-ready-backend-pending
Method: POST
Path: auth/login/
Auth required: no
Request
type LoginRequest = {
  username: string;
  password: string;
};
Response
type LoginResponse = {
  access: string;
  refresh: string;
  user: AccountUser;
  redirect_path: string;
};
Frontend Behavior

بعد از ورود موفق:

access ذخیره شود.
refresh ذخیره شود.
user.role ذخیره شود.
redirect_path ذخیره شود.
کاربر به redirect_path هدایت شود.
Current User
Status: frontend-ready-backend-pending
Method: GET
Path: me/
Auth required: yes
Response
type AccountUser = {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  role: "general_manager" | "unit_manager" | "unit_media" | "parent";
  role_display: string;
  redirect_path: string;
  is_staff: boolean;
  is_superuser: boolean;
};
Profile
Status: frontend-ready-backend-pending
Method: GET
Path: me/profile/
Auth required: yes
Status: frontend-ready-backend-pending
Method: PATCH
Path: me/profile/
Auth required: yes
Request
type UpdateProfileRequest = {
  full_name: string;
  phone: string;
  email: string;
  description: string;
};
Avatar Upload
Status: frontend-ready-backend-pending
Method: POST
Path: me/profile/avatar/
Auth required: yes
Content-Type: multipart/form-data
Request
type AvatarRequest = {
  avatar: File;
};
Permissions
Status: frontend-ready-backend-pending
Method: GET
Path: me/permissions/
Auth required: yes
User Units
Status: frontend-ready-backend-pending
Method: GET
Path: me/units/
Auth required: yes
Pending Backend Decisions
Change Password

فرانت UI تغییر رمز دارد، اما endpoint رسمی آن هنوز باید توسط بک‌اند تأیید شود.

پیشنهاد:

Method: POST
Path: me/change-password/
Auth required: yes
Request
type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

