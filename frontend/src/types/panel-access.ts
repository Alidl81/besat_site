export type DashboardRole =
  | "general_manager"
  | "unit_manager"
  | "unit_media"
  | "parent";

export type ContentScope = "school" | "unit";

export type SchoolUnitKind =
  | "kindergarten"
  | "elementary"
  | "middle_school_one"
  | "middle_school_two";

export type ContentKind =
  | "news"
  | "announcement"
  | "gallery"
  | "event"
  | "message"
  | "registration_request";

export type ContentReviewStatus =
  | "draft"
  | "waiting_review"
  | "approved"
  | "published"
  | "rejected";

export type DashboardAccessProfile = {
  role: DashboardRole;
  title: string;
  description: string;
  dashboardPath: string;
  canSeeAllUnits: boolean;
  canManageOwnUnit: boolean;
  canPublishOwnUnitContent: boolean;
  canReviewAllContent: boolean;
  canSeeOwnChildren: boolean;
};

export type UnitScopedContent = {
  id: string;
  kind: ContentKind;
  scope: ContentScope;
  unitId: string | null;
  title: string;
  status: ContentReviewStatus;
  ownerRole: DashboardRole;
  createdAt: string;
  updatedAt: string;
};
