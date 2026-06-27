import { apiRequest } from "@/lib/api/client";

export type AccountRole =
  | "general_manager"
  | "unit_manager"
  | "unit_media"
  | "parent";

export type AccountUser = {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  role: AccountRole;
  role_display: string;
  redirect_path: string;
  is_staff: boolean;
  is_superuser: boolean;
};

export type AccountProfile = AccountUser & {
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: AccountUser;
  redirect_path: string;
};

export type RefreshTokenRequest = {
  refresh: string;
};

export type RefreshTokenResponse = {
  access: string;
  refresh: string;
};

export type LogoutRequest = {
  refresh: string;
};

export type UpdateProfileRequest = {
  full_name: string;
  phone: string;
  email: string;
  description: string;
};

export type AccountPermissions = {
  role: AccountRole;
  role_display: string;
  redirect_path: string;
  is_staff: boolean;
  is_superuser: boolean;
  permissions: {
    can_access_general_manager_panel: boolean;
    can_access_unit_manager_panel: boolean;
    can_access_media_panel: boolean;
    can_access_parent_panel: boolean;
    can_manage_all_units: boolean;
    can_manage_unit_content: boolean;
    can_manage_media: boolean;
    can_manage_news: boolean;
    can_manage_announcements: boolean;
    can_manage_gallery: boolean;
    can_review_content: boolean;
    can_publish_content: boolean;
    can_view_dashboard: boolean;
  };
  django_permissions: string[];
};

export type AccountUnit = {
  id: number;
  title: string;
  slug: string;
  role?: string;
};

export function loginAccount(values: LoginRequest) {
  return apiRequest<LoginResponse>("auth/login/", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function refreshAccountToken(values: RefreshTokenRequest) {
  return apiRequest<RefreshTokenResponse>("auth/refresh/", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function logoutAccount(token: string, values: LogoutRequest) {
  return apiRequest<void>("auth/logout/", {
    method: "POST",
    token,
    body: JSON.stringify(values),
  });
}

export function getAccountMe(token: string) {
  return apiRequest<AccountUser>("me/", {
    token,
  });
}

export function getAccountProfile(token: string) {
  return apiRequest<AccountProfile>("me/profile/", {
    token,
  });
}

export function updateAccountProfile(token: string, values: UpdateProfileRequest) {
  return apiRequest<AccountProfile>("me/profile/", {
    method: "PATCH",
    token,
    body: JSON.stringify(values),
  });
}

export function uploadAccountAvatar(token: string, avatar: File) {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiRequest<AccountProfile>("me/profile/avatar/", {
    method: "POST",
    token,
    body: formData,
  });
}

export function getAccountPermissions(token: string) {
  return apiRequest<AccountPermissions>("me/permissions/", {
    token,
  });
}

export function getAccountUnits(token: string) {
  return apiRequest<AccountUnit[]>("me/units/", {
    token,
  });
}
