"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TourSceneDetail } from "@/types/virtual-tour";

type PanoramaViewerProps = {
  /** One or more scenes belonging to the same door (unit/department tour).
   * A single scene uses pannellum's plain single-panorama mode (today's
   * behavior, unchanged); 2+ scenes switch to pannellum's real multi-scene
   * `scenes`/`hotSpots` API so in-panorama hotspots can jump between them. */
  scenes: TourSceneDetail[];
  title: string;
  /** Slug of the scene to open on. Defaults to the door's default scene, or
   * the first scene if none is marked default. */
  initialSceneSlug?: string;
};

const STRINGS = {
  loadButtonLabel: "برای شروع بازدید کلیک کنید",
  loadingLabel: "در حال بارگذاری نمای ۳۶۰...",
  bylineLabel: "توسط %s",
  noPanoramaError: "تصویر پانوراما بارگذاری نشد.",
  fileAccessError: "فایل پانوراما در دسترس نیست.",
  malformedURLError: "آدرس تصویر پانوراما معتبر نیست.",
  genericWebGLError: "مرورگر امکان نمایش WebGL را ندارد.",
  textureSizeError: "ابعاد تصویر برای این دستگاه بیش از حد بزرگ است.",
  unknownError: "نمای ۳۶۰ قابل بارگذاری نیست.",
};

export function PanoramaViewer({ scenes, title, initialSceneSlug }: PanoramaViewerProps) {
  const rawId = useId();
  const viewerId = `besat-panorama-${rawId.replaceAll(":", "")}`;
  const viewerRef = useRef<PannellumViewer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      if (scenes.length === 0) {
        setStatus("error");
        return;
      }

      try {
        await import("pannellum");
        if (disposed || !window.pannellum) return;

        const viewer =
          scenes.length === 1
            ? window.pannellum.viewer(viewerId, {
                type: "equirectangular",
                panorama: scenes[0].panorama ?? "",
                autoLoad: true,
                showControls: true,
                compass: true,
                friction: 0.18,
                yaw: scenes[0].initial_yaw ?? 0,
                pitch: scenes[0].initial_pitch ?? 0,
                hfov: scenes[0].initial_hfov ?? 105,
                title,
                author: "مجتمع آموزشی بعثت",
                strings: STRINGS,
              })
            : window.pannellum.viewer(viewerId, {
                default: {
                  firstScene:
                    initialSceneSlug ?? scenes.find((s) => s.is_default)?.slug ?? scenes[0].slug,
                  sceneFadeDuration: 900,
                  autoLoad: true,
                  showControls: true,
                  compass: true,
                  friction: 0.18,
                  author: "مجتمع آموزشی بعثت",
                  strings: STRINGS,
                },
                scenes: Object.fromEntries(
                  scenes.map((scene) => [
                    scene.slug,
                    {
                      type: "equirectangular" as const,
                      panorama: scene.panorama ?? "",
                      title: scene.title,
                      yaw: scene.initial_yaw ?? 0,
                      pitch: scene.initial_pitch ?? 0,
                      hfov: scene.initial_hfov ?? 105,
                      hotSpots: scene.hotspots.map((hotspot) => ({
                        pitch: hotspot.pitch,
                        yaw: hotspot.yaw,
                        type: "scene" as const,
                        text: hotspot.label || undefined,
                        sceneId: scenes.find((target) => target.id === hotspot.target_scene)?.slug ?? "",
                      })),
                    },
                  ]),
                ),
              });

        viewerRef.current = viewer;
        viewer.on("load", () => setStatus("ready"));
        viewer.on("scenechange", () => setStatus("ready"));
        viewer.on("error", () => setStatus("error"));
      } catch {
        if (!disposed) setStatus("error");
      }
    };

    initialize();
    return () => {
      disposed = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [scenes, title, viewerId, initialSceneSlug]);

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden bg-[#06182d]">
      <div id={viewerId} className="absolute inset-0" />
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#06182d] text-center text-white transition-opacity">
          <span>
            <span className="mx-auto block size-11 animate-spin rounded-full border-2 border-white/20 border-t-[#e2ae5b]" />
            <span className="mt-4 block text-sm font-black">در حال آماده‌سازی نمای ۳۶۰...</span>
          </span>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#06182d] px-5 text-center text-white">
          <div className="max-w-md rounded-2xl border border-white/12 bg-white/[.07] p-7 backdrop-blur-xl">
            <strong className="block text-xl font-black">تصویر پانوراما بارگذاری نشد</strong>
            <span className="mt-3 block text-sm font-bold leading-8 text-white/68">مسیر فایل این صحنه را در تنظیمات تور بررسی کنید.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
