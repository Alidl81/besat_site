import { ApiError, apiRequest, normalizeEndpoint } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";
import type {
  CMSTourScene,
  CMSTourSceneDetail,
  CMSTourSceneWritePayload,
  TourHotspot,
  TourHotspotWritePayload,
} from "@/types/virtual-tour";

type Scalar = string | number | boolean | null | undefined;

function withQuery(endpoint: string, query: Record<string, Scalar> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `${endpoint}?${encoded}` : endpoint;
}

function hasFileValue(payload: CMSTourSceneWritePayload) {
  return payload.panorama instanceof File || payload.thumbnail instanceof File;
}

function toFormData(payload: CMSTourSceneWritePayload) {
  const form = new FormData();
  for (const [key, rawValue] of Object.entries(payload)) {
    if (rawValue === undefined) continue;
    if (rawValue === null) {
      form.set(key, "");
      continue;
    }
    if (rawValue instanceof File) {
      form.set(key, rawValue);
      continue;
    }
    form.set(key, String(rawValue));
  }
  return form;
}

// --- Scenes -----------------------------------------------------------

export function cmsGetTourScenes(
  query: { status?: string; door_type?: "unit" | "department"; search?: string } = {},
) {
  return apiRequest<ApiListResponse<CMSTourScene>>(withQuery(apiEndpoints.cmsVirtualTour.scenes, query));
}

export function cmsGetTourScene(id: number) {
  return apiRequest<CMSTourSceneDetail>(`${apiEndpoints.cmsVirtualTour.scenes}${id}/`);
}

export function cmsCreateTourScene(payload: CMSTourSceneWritePayload) {
  if (hasFileValue(payload)) {
    return apiRequest<CMSTourSceneDetail>(apiEndpoints.cmsVirtualTour.scenes, {
      method: "POST",
      body: toFormData(payload),
    });
  }
  return apiRequest<CMSTourSceneDetail>(apiEndpoints.cmsVirtualTour.scenes, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cmsUpdateTourScene(id: number, payload: CMSTourSceneWritePayload) {
  if (hasFileValue(payload)) {
    return apiRequest<CMSTourSceneDetail>(`${apiEndpoints.cmsVirtualTour.scenes}${id}/`, {
      method: "PATCH",
      body: toFormData(payload),
    });
  }
  return apiRequest<CMSTourSceneDetail>(`${apiEndpoints.cmsVirtualTour.scenes}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cmsDeleteTourScene(id: number) {
  return apiRequest<void>(`${apiEndpoints.cmsVirtualTour.scenes}${id}/`, { method: "DELETE" });
}

export type TourSceneWorkflowAction =
  | "submit-review"
  | "approve"
  | "publish"
  | "reject"
  | "archive"
  | "restore";

export function cmsRunTourSceneWorkflowAction(
  id: number,
  action: TourSceneWorkflowAction,
  publishedAt?: string,
) {
  return apiRequest<CMSTourSceneDetail>(`${apiEndpoints.cmsVirtualTour.scenes}${id}/${action}/`, {
    method: "POST",
    body: JSON.stringify(publishedAt ? { published_at: publishedAt } : {}),
  });
}

/**
 * Uploads a scene's panorama via XHR (not fetch) specifically to expose
 * real upload-percentage progress -- pannellum panoramas are large
 * (up to 20MB) and the CMS UI needs to show progress, which the fetch-based
 * apiRequest() helper cannot report for request bodies.
 */
export function cmsCreateTourSceneWithProgress(
  payload: CMSTourSceneWritePayload,
  onProgress: (percent: number) => void,
): Promise<CMSTourSceneDetail> {
  return uploadFormDataWithProgress("POST", apiEndpoints.cmsVirtualTour.scenes, toFormData(payload), onProgress);
}

export function cmsUpdateTourSceneWithProgress(
  id: number,
  payload: CMSTourSceneWritePayload,
  onProgress: (percent: number) => void,
): Promise<CMSTourSceneDetail> {
  return uploadFormDataWithProgress(
    "PATCH",
    `${apiEndpoints.cmsVirtualTour.scenes}${id}/`,
    toFormData(payload),
    onProgress,
  );
}

function uploadFormDataWithProgress<T>(
  method: string,
  endpoint: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, normalizeEndpoint(endpoint));
    xhr.withCredentials = true;
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as T);
        return;
      }
      const payload = xhr.response as Record<string, unknown> | null;
      reject(
        new ApiError({
          message:
            (typeof payload?.detail === "string" ? payload.detail : null) ??
            "بارگذاری فایل با خطا مواجه شد.",
          status: xhr.status,
          fieldErrors:
            payload && typeof payload === "object"
              ? Object.fromEntries(
                  Object.entries(payload)
                    .filter(([key]) => !["detail", "message", "code", "request_id"].includes(key))
                    .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : [String(value)]]),
                )
              : {},
        }),
      );
    };

    xhr.onerror = () => {
      reject(new ApiError({ message: "ارتباط با بک‌اند برقرار نشد.", status: 0 }));
    };

    xhr.send(form);
  });
}

// --- Hotspots -----------------------------------------------------------

export function cmsGetTourHotspots(sceneId: number) {
  return apiRequest<ApiListResponse<TourHotspot>>(
    withQuery(apiEndpoints.cmsVirtualTour.hotspots, { scene: sceneId }),
  );
}

export function cmsCreateTourHotspot(payload: TourHotspotWritePayload) {
  return apiRequest<TourHotspot>(apiEndpoints.cmsVirtualTour.hotspots, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cmsUpdateTourHotspot(id: number, payload: Partial<TourHotspotWritePayload>) {
  return apiRequest<TourHotspot>(`${apiEndpoints.cmsVirtualTour.hotspots}${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cmsDeleteTourHotspot(id: number) {
  return apiRequest<void>(`${apiEndpoints.cmsVirtualTour.hotspots}${id}/`, { method: "DELETE" });
}
