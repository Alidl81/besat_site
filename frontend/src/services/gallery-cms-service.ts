import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { GalleryItemRecord } from "@/lib/data/domain-types";

export type GalleryWorkflowAction =
  | "submit-review"
  | "approve"
  | "publish"
  | "reject"
  | "archive"
  | "restore";

export function runGalleryWorkflowAction(id: string, action: GalleryWorkflowAction) {
  return apiRequest<GalleryItemRecord>(`${apiEndpoints.cms.gallery}${id}/${action}/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
