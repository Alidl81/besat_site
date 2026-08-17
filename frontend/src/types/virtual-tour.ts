export type TourSceneStatus =
  | "draft"
  | "waiting_review"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export type TourDoorType = "unit" | "department";

export type TourUnitBrief = { id: number; title: string; slug: string };
export type TourDepartmentBrief = { id: number; title: string; slug: string };

export type TourHotspot = {
  id: number;
  scene: number;
  target_scene: number;
  yaw: number;
  pitch: number;
  label: string;
  order: number;
};

export type TourHotspotWritePayload = {
  scene: number;
  target_scene: number;
  yaw: number;
  pitch: number;
  label?: string;
  order?: number;
};

export type TourScene = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  panorama: string | null;
  thumbnail: string | null;
  unit: TourUnitBrief | null;
  department: TourDepartmentBrief | null;
  door_key: string | null;
  initial_yaw: number;
  initial_pitch: number;
  initial_hfov: number;
  is_default: boolean;
  status: TourSceneStatus;
  is_published: boolean;
  is_active: boolean;
  order: number;
};

export type TourSceneDetail = TourScene & {
  hotspots: TourHotspot[];
};

export type CMSTourScene = TourScene & {
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CMSTourSceneDetail = CMSTourScene & {
  hotspots: TourHotspot[];
};

export type CMSTourSceneWritePayload = {
  title?: string;
  description?: string | null;
  unit?: number | null;
  department?: number | null;
  panorama?: File | string | null;
  thumbnail?: File | string | null;
  initial_yaw?: number;
  initial_pitch?: number;
  initial_hfov?: number;
  is_default?: boolean;
  status?: TourSceneStatus;
  is_active?: boolean;
  order?: number;
  published_at?: string | null;
};
