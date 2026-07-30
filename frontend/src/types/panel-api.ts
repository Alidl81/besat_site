import type { ApiId, ApiListResponse, PublishStatus } from "@/types/api";

export type PanelListResponse<T, TSummary = never> = ApiListResponse<T> & {
  summary?: TSummary;
};

export type NamedOption = { id: ApiId; title: string };

export type PanelContext = {
  user: {
    id: ApiId;
    full_name: string;
    role_display: string;
    avatar_url: string | null;
  };
  academic_years: Array<NamedOption & { is_current: boolean }>;
  selected_academic_year_id: ApiId | null;
  units: NamedOption[];
  selected_unit_id: ApiId | null;
  children: Array<NamedOption & { subtitle: string | null; avatar_url: string | null }>;
  selected_child_id: ApiId | null;
  unread_notifications: number;
  unread_messages: number;
  current_date: string;
};

export type PanelMetric = {
  key: string;
  title: string;
  value: string | number | null;
  detail: string | null;
  trend: string | null;
  tone: "blue" | "amber" | "green" | "purple" | "red";
  icon: string;
};

export type PanelFeedItem = {
  id: ApiId;
  title: string;
  description: string | null;
  timestamp: string | null;
  status: string | null;
  href: string | null;
  avatar_url: string | null;
};

export type UnitPerformance = {
  id: ApiId;
  title: string;
  students_count: number;
  staff_count: number;
  new_registrations_count: number;
  published_content_count: number;
  is_active: boolean;
};

export type AdminDashboard = {
  current_date: string;
  metrics: PanelMetric[];
  messages: PanelFeedItem[];
  events: PanelFeedItem[];
  announcements: PanelFeedItem[];
  units: UnitPerformance[];
};

export type MediaDashboard = {
  current_date: string;
  metrics: PanelMetric[];
  latest_content: PanelFeedItem[];
  messages: PanelFeedItem[];
  calendar: Array<{ date: string; status: PublishStatus }>;
  storage: {
    used_bytes: number;
    total_bytes: number;
    used_percent: number;
  } | null;
};

export type ParentDashboard = {
  current_date: string;
  metrics: PanelMetric[];
  selected_child: ParentChildSummary | null;
  today_schedule: ScheduleItem[];
  next_exam: ExamItem | null;
  current_assignment: AssignmentItem | null;
  attendance: AttendanceSummary | null;
  events: PanelFeedItem[];
  teacher_messages: PanelFeedItem[];
  quick_links: Array<{ id: ApiId; title: string; href: string; icon: string }>;
};

export type DashboardPayload = AdminDashboard | MediaDashboard | ParentDashboard;

export type StudentSummary = {
  total: number;
  completed_profiles: number;
  new_this_year: number;
  incomplete_profiles: number;
};

export type StudentItem = {
  id: ApiId;
  full_name: string;
  avatar_url: string | null;
  student_code: string;
  national_code: string | null;
  unit: NamedOption | null;
  grade: NamedOption | null;
  class_room: NamedOption | null;
  major: string | null;
  profile_status: "complete" | "incomplete";
  education_status: "active" | "graduated" | "inactive";
  guardian: {
    id: ApiId | null;
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  enrolled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationStatus =
  | "new"
  | "reviewing"
  | "needs_documents"
  | "accepted"
  | "rejected";

export type RegistrationSummary = {
  total: number;
  reviewing: number;
  accepted: number;
  rejected: number;
  needs_documents: number;
};

export type RegistrationDocument = {
  id: ApiId;
  title: string;
  status: "pending" | "approved" | "rejected" | "missing";
  file_url: string | null;
};

export type RegistrationTimelineItem = {
  id: ApiId;
  title: string;
  created_at: string;
  actor_name: string | null;
};

export type RegistrationItem = {
  id: ApiId;
  request_code: string;
  student_full_name: string;
  student_avatar_url: string | null;
  student_national_code: string | null;
  requested_grade: NamedOption | null;
  requested_unit: NamedOption | null;
  parent: {
    full_name: string;
    phone: string | null;
    email: string | null;
  };
  description: string | null;
  status: RegistrationStatus;
  documents: RegistrationDocument[];
  timeline: RegistrationTimelineItem[];
  created_at: string;
  updated_at: string;
};

export type ContentKind = "news" | "announcement";

export type ContentItem = {
  id: ApiId;
  kind: ContentKind;
  title: string;
  slug: string;
  summary: string | null;
  body_html: string;
  body_json: Record<string, unknown> | null;
  cover_image_url: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[] | null;
  canonical_url?: string | null;
  audience?: "all" | "students" | "parents" | "staff";
  is_featured?: boolean;
  allow_comments?: boolean;
  wordpress_sync?: boolean;
  wordpress_sync_status?: "idle" | "pending" | "synced" | "failed" | null;
  scope: "school" | "unit";
  unit: NamedOption | null;
  category: NamedOption | null;
  status: PublishStatus;
  author: {
    id: ApiId;
    full_name: string;
    avatar_url: string | null;
  } | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentSummary = {
  drafts: number;
  waiting_review: number;
  scheduled: number;
  published: number;
};

export type ParentChildSummary = {
  id: ApiId;
  full_name: string;
  avatar_url: string | null;
  grade_title: string | null;
  class_title: string | null;
  major: string | null;
  unit_title: string | null;
  is_active: boolean;
};

export type TeacherItem = {
  id: ApiId;
  full_name: string;
  avatar_url: string | null;
  subject: string;
};

export type GradeItem = {
  id: ApiId;
  subject: string;
  score: string | number;
  status_label: string | null;
  recorded_at: string | null;
};

export type AttendanceSummary = {
  attendance_percent: number;
  present_days: number;
  excused_absence_days: number;
  unexcused_absence_days: number;
  late_days: number;
};

export type ExamItem = {
  id: ApiId;
  title: string;
  subject: string | null;
  starts_at: string;
};

export type AssignmentItem = {
  id: ApiId;
  title: string;
  subject: string | null;
  due_at: string | null;
  status: string | null;
};

export type ScheduleItem = {
  id: ApiId;
  order: number;
  title: string;
  starts_at: string;
  ends_at: string;
};

export type ParentChildDetail = ParentChildSummary & {
  average: string | number | null;
  class_rank: string | null;
  grade_rank: string | null;
  teachers: TeacherItem[];
  latest_grades: GradeItem[];
  attendance: AttendanceSummary | null;
  exams: ExamItem[];
  assignments: AssignmentItem[];
  schedule: ScheduleItem[];
  counselor_message: PanelFeedItem | null;
  quick_links: Array<{ id: ApiId; title: string; href: string }>;
};

export type ServiceItem = {
  id: ApiId;
  title: string;
  description: string | null;
  icon: string;
  url: string;
  is_external: boolean;
};

export type EventItem = {
  id: ApiId;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  unit: NamedOption | null;
};

export type ReportOverview = {
  metrics: PanelMetric[];
  units: UnitPerformance[];
};

export type PanelSettings = {
  school_name: string;
  current_academic_year_id: ApiId | null;
  default_unit_id: ApiId | null;
  notify_new_registration: boolean;
  show_published_on_home: boolean;
  autosave_forms: boolean;
  internal_messages_enabled: boolean;
  academic_years: NamedOption[];
  units: NamedOption[];
};

export type ParentRegistration = {
  id: ApiId;
  child: ParentChildSummary;
  academic_year: NamedOption;
  status: string;
  progress_percent: number;
  next_action_url: string | null;
  steps: Array<{
    id: ApiId;
    title: string;
    status: "complete" | "current" | "pending";
  }>;
};

export type InternalMessageItem = {
  id: ApiId;
  sender: { id: ApiId; full_name: string; role_display: string };
  recipient: { id: ApiId; full_name: string; role_display: string };
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type MessageRecipient = {
  id: ApiId;
  full_name: string;
  role_display: string;
};
