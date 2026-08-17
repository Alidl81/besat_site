import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiListResponse } from "@/types/api";
import type { TourDoorType, TourScene, TourSceneDetail } from "@/types/virtual-tour";

export async function getPublicTourDoorScenes(
  doorType: TourDoorType,
  slug: string,
): Promise<TourSceneDetail[]> {
  const list = await apiRequest<ApiListResponse<TourScene>>(
    `${apiEndpoints.virtualTourScenes}?door=${doorType}:${encodeURIComponent(slug)}`,
  );
  if (list.results.length === 0) return [];

  return Promise.all(
    list.results.map((scene) =>
      apiRequest<TourSceneDetail>(`${apiEndpoints.virtualTourScenes}${scene.slug}/`),
    ),
  );
}
