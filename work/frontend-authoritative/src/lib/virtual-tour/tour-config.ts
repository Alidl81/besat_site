export type TourSceneConfig = {
  panorama: string;
  initialYaw?: number;
  initialPitch?: number;
  initialHfov?: number;
};

/**
 * فایل‌های پانورامای واقعی را داخل public/images/virtual-tour قرار دهید و
 * کلید هر صحنه را به شکل unit:slug یا department:slug در این جدول ثبت کنید.
 * نمونه:
 * "unit:boys-high-school-7": { panorama: "/images/virtual-tour/unit-07/main.jpg" }
 */
export const tourScenes: Record<string, TourSceneConfig> = {};

export function getTourScene(type: "unit" | "department", slug: string) {
  return tourScenes[`${type}:${slug}`] ?? null;
}
