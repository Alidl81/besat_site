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

// REL-FE-TOUR-UPLOAD-TIMEOUT-001: this XHR previously had no `.timeout`,
// `ontimeout`, or `onabort` handling at all -- only `onload`/`onerror`,
// neither of which ever fires for a connection that simply stalls (goes
// silent mid-transfer rather than erroring outright). A stalled panorama/
// thumbnail upload left this promise permanently unresolved, which left
// VirtualTourManager's submitting/progress state stuck indefinitely with
// no way to recover short of a full page reload. Panoramas are large (up
// to 20MB) and this is a wall-clock timeout from `send()` to completion
// (it does not reset on progress events), so this needs real headroom for
// a genuinely slow-but-progressing connection -- 5 minutes, well beyond
// any realistic completion time for this payload size, while still
// guaranteeing the promise eventually settles instead of hanging forever.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

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
    xhr.timeout = UPLOAD_TIMEOUT_MS;

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

    xhr.ontimeout = () => {
      reject(new ApiError({ message: "بارگذاری فایل بیش از حد طول کشید. اتصال اینترنت خود را بررسی و دوباره تلاش کنید.", status: 0 }));
    };

    xhr.onabort = () => {
      reject(new ApiError({ message: "بارگذاری فایل لغو شد.", status: 0 }));
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
