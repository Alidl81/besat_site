export type MockId = string | number;

export type MockRecord = {
  id: MockId;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type MockAccount = MockRecord & {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "general_manager" | "unit_manager" | "unit_media" | "parent";
  role_display: string;
  unit_id: MockId | null;
  redirect_path: string;
  avatar: string | null;
  is_active: boolean;
};

export type MockDatabase = {
  _meta: {
    name: string;
    schema_version: number;
    seeded_at: string;
    notice: string;
    sources: Array<{
      title: string;
      url: string;
      retrieved_at: string;
    }>;
  };
  site_settings: Record<string, unknown>;
  settings: Record<string, unknown>;
  accounts: MockAccount[];
  units: MockRecord[];
  departments: MockRecord[];
  users: MockRecord[];
  content: MockRecord[];
  content_categories: MockRecord[];
  content_revisions: MockRecord[];
  gallery: MockRecord[];
  achievements: MockRecord[];
  home_slides: MockRecord[];
  registration_requests: MockRecord[];
  contact_messages: MockRecord[];
  students: MockRecord[];
  classes: MockRecord[];
  staff: MockRecord[];
  programs: MockRecord[];
  events: MockRecord[];
  services: MockRecord[];
  internal_messages: MockRecord[];
  static_pages: MockRecord[];
  parent_children: MockRecord[];
  parent_registrations: MockRecord[];
};
