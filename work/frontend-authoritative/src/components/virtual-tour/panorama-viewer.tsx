"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TourSceneConfig } from "@/lib/virtual-tour/tour-config";

type PanoramaViewerProps = {
  scene: TourSceneConfig;
  title: string;
};

export function PanoramaViewer({ scene, title }: PanoramaViewerProps) {
  const rawId = useId();
  const viewerId = `besat-panorama-${rawId.replaceAll(":", "")}`;
  const viewerRef = useRef<PannellumViewer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      try {
        await import("pannellum");
        if (disposed || !window.pannellum) return;

        const viewer = window.pannellum.viewer(viewerId, {
          type: "equirectangular",
          panorama: scene.panorama,
          autoLoad: true,
          showControls: true,
          compass: true,
          friction: 0.18,
          yaw: scene.initialYaw ?? 0,
          pitch: scene.initialPitch ?? 0,
          hfov: scene.initialHfov ?? 105,
          title,
          author: "مجتمع آموزشی بعثت",
          strings: {
            loadButtonLabel: "برای شروع بازدید کلیک کنید",
            loadingLabel: "در حال بارگذاری نمای ۳۶۰...",
            bylineLabel: "توسط %s",
            noPanoramaError: "تصویر پانوراما بارگذاری نشد.",
            fileAccessError: "فایل پانوراما در دسترس نیست.",
            malformedURLError: "آدرس تصویر پانوراما معتبر نیست.",
            genericWebGLError: "مرورگر امکان نمایش WebGL را ندارد.",
            textureSizeError: "ابعاد تصویر برای این دستگاه بیش از حد بزرگ است.",
            unknownError: "نمای ۳۶۰ قابل بارگذاری نیست.",
          },
        });

        viewerRef.current = viewer;
        viewer.on("load", () => setStatus("ready"));
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
  }, [scene, title, viewerId]);

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
