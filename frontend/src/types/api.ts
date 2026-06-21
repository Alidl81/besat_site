export type ApiId = string | number;

export type ApiListResponse<TItem> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: TItem[];
};

export type PublishStatus =
  | "draft"
  | "waiting_review"
  | "approved"
  | "published"
  | "rejected";

export type ContentScope = "school" | "unit";

export type UserRole =
  | "general_manager"
  | "unit_manager"
  | "unit_media"
  | "parent";

export type SchoolUnit = {
  id: ApiId;
  title: string;
  slug: string;
  is_active: boolean;
};

export type CurrentUser = {
  id: ApiId;
  full_name: string;
  role: UserRole;
  unit_id: ApiId | null;
};

export type UserPermissions = {
  can_see_all_units: boolean;
  can_manage_own_unit: boolean;
  can_create_own_unit_content: boolean;
  can_review_own_unit_content: boolean;
  can_review_all_content: boolean;
  can_publish_school_content: boolean;
  can_publish_unit_content: boolean;
  can_see_own_children: boolean;
};

export type UnitScopedContent = {
  id: ApiId;
  title: string;
  slug: string;
  summary: string;
  scope: ContentScope;
  unit_id: ApiId | null;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type DashboardMetric = {
  title: string;
  value: number | null;
  description: string;
};

export type DashboardListItem = {
  id: ApiId;
  title: string;
  description: string;
  status?: string;
  href?: string;
};

export type DashboardResponse = {
  metrics: DashboardMetric[];
  requests: DashboardListItem[];
  activities: DashboardListItem[];
  announcements: DashboardListItem[];
};
