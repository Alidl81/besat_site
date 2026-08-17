"use client";

import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  cmsCreateTourHotspot,
  cmsDeleteTourHotspot,
  cmsGetTourHotspots,
} from "@/services/virtual-tour-cms-service";
import type { CMSTourScene, TourHotspot } from "@/types/virtual-tour";

type TourHotspotEditorProps = {
  scene: CMSTourScene;
  /** Sibling scenes in the same door -- the only valid hotspot targets. */
  doorScenes: CMSTourScene[];
  onClose: () => void;
};

export function TourHotspotEditor({ scene, doorScenes, onClose }: TourHotspotEditorProps) {
  const rawId = useId();
  const viewerId = `besat-hotspot-editor-${rawId.replaceAll(":", "")}`;
  const viewerRef = useRef<PannellumViewer | null>(null);
  const [hotspots, setHotspots] = useState<TourHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ yaw: number; pitch: number } | null>(null);
  const [targetSceneId, setTargetSceneId] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [placing, setPlacing] = useState(false);

  const targets = doorScenes.filter((s) => s.id !== scene.id);

  useEffect(() => {
    let mounted = true;
    cmsGetTourHotspots(scene.id)
      .then((res) => {
        if (mounted) setHotspots(res.results);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scene.id]);

  useEffect(() => {
    if (!scene.panorama) return;
    let disposed = false;

    (async () => {
      await import("pannellum");
      if (disposed || !window.pannellum) return;

      const viewer = window.pannellum.viewer(viewerId, {
        type: "equirectangular",
        panorama: scene.panorama,
        autoLoad: true,
        showControls: true,
        compass: true,
        yaw: scene.initial_yaw,
        pitch: scene.initial_pitch,
        hfov: scene.initial_hfov,
        hotSpots: hotspots.map((hotspot) => ({
          pitch: hotspot.pitch,
          yaw: hotspot.yaw,
          type: "info",
          text: hotspot.label || doorScenes.find((s) => s.id === hotspot.target_scene)?.title || "نقطه اتصال",
        })),
      });
      viewerRef.current = viewer;
    })();

    return () => {
      disposed = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, scene.panorama, hotspots.length]);

  function handleContainerClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!placing || !viewerRef.current) return;
    const [pitch, yaw] = viewerRef.current.mouseEventToCoords(event.nativeEvent);
    setPendingPoint({ yaw, pitch });
    setPlacing(false);
  }

  async function handleSaveHotspot() {
    if (!pendingPoint || targetSceneId === "") return;
    setSaving(true);
    setError(null);
    try {
      const created = await cmsCreateTourHotspot({
        scene: scene.id,
        target_scene: Number(targetSceneId),
        yaw: pendingPoint.yaw,
        pitch: pendingPoint.pitch,
        label,
      });
      setHotspots((current) => [...current, created]);
      setPendingPoint(null);
      setTargetSceneId("");
      setLabel("");
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHotspot(id: number) {
    if (!window.confirm("این نقطه اتصال حذف شود؟")) return;
    setError(null);
    try {
      await cmsDeleteTourHotspot(id);
      setHotspots((current) => current.filter((hotspot) => hotspot.id !== id));
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    }
  }

  if (!scene.panorama) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm font-bold text-slate-500">
          پیش از تعریف نقاط اتصال، ابتدا باید تصویر پانورامای این صحنه بارگذاری شود.
        </p>
        <GhostButton type="button" onClick={onClose} className="mt-4">بستن</GhostButton>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <div
          onClick={handleContainerClick}
          className={`relative h-[420px] w-full overflow-hidden rounded-2xl bg-[#06182d] ${placing ? "cursor-crosshair" : ""}`}
        >
          <div id={viewerId} className="absolute inset-0" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500">
            {placing
              ? "روی تصویر کلیک کنید تا نقطه اتصال جدید ثبت شود."
              : "برای افزودن نقطه اتصال جدید، دکمه زیر را بزنید و سپس نقطه موردنظر را روی تصویر کلیک کنید."}
          </p>
          <GhostButton type="button" disabled={targets.length === 0 || placing} onClick={() => setPlacing(true)}>
            <PanelIcon name="plus" className="ml-1 inline size-4" /> افزودن نقطه اتصال
          </GhostButton>
        </div>
        {targets.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
            برای افزودن نقطه اتصال، باید حداقل یک صحنه دیگر در همین «در» وجود داشته باشد.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {pendingPoint ? (
          <div className="rounded-2xl border border-[#e2ae5b]/40 bg-amber-50/60 p-4">
            <p className="mb-3 text-sm font-black text-[#062452]">نقطه اتصال جدید</p>
            <div className="space-y-3">
              <Field label="صحنه مقصد" required>
                <Select
                  value={targetSceneId}
                  onChange={(e) => setTargetSceneId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">انتخاب کنید</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </Select>
              </Field>
              <Field label="برچسب (اختیاری)">
                <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: ورود به سالن ورزشی" />
              </Field>
              <div className="flex gap-2">
                <PrimaryButton type="button" disabled={saving || targetSceneId === ""} onClick={handleSaveHotspot}>
                  {saving ? "در حال ذخیره…" : "ذخیره نقطه اتصال"}
                </PrimaryButton>
                <GhostButton
                  type="button"
                  onClick={() => {
                    setPendingPoint(null);
                    setTargetSceneId("");
                    setLabel("");
                  }}
                >
                  انصراف
                </GhostButton>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-black text-[#062452]">نقاط اتصال این صحنه</p>
          {loading ? (
            <p className="text-xs font-bold text-slate-400">در حال بارگذاری…</p>
          ) : hotspots.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">هنوز نقطه اتصالی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {hotspots.map((hotspot) => {
                const target = doorScenes.find((s) => s.id === hotspot.target_scene);
                return (
                  <li key={hotspot.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#062452]">{hotspot.label || target?.title || "بدون برچسب"}</p>
                      <p className="text-xs font-bold text-slate-400">به سمت: {target?.title ?? "—"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteHotspot(hotspot.id)}
                      className="panel-icon-button hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`حذف ${hotspot.label || "نقطه اتصال"}`}
                    >
                      <PanelIcon name="trash" className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? <p role="alert" className="text-sm font-black text-rose-600">{error}</p> : null}

        <GhostButton type="button" onClick={onClose} className="w-full">بستن</GhostButton>
      </div>
    </div>
  );
}
