"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { EditorIcon } from "@/components/editor/editor-icons";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type { MediaAsset } from "@/types/panel-api";

type MediaPickerDialogProps = {
  open: boolean;
  value: string;
  unitId?: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
};

type MediaTab = "upload" | "url" | "library";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/ogg",
]);


function getMediaSourceLabel(src: string) {
  if (!src) return "No media selected";
  if (src.length <= 80) return src;

  return `${src.slice(0, 44)}...${src.slice(-20)}`;
}
function isVideoSource(src: string) {
  const normalized = src.toLowerCase();
  return (
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".ogg") ||
    normalized.includes(".mp4?") ||
    normalized.includes(".webm?") ||
    normalized.includes(".ogg?")
  );
}

function isSafeMediaUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function MediaPreview({ src, title }: { src: string; title: string }) {
  if (!src) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
        هنوز مدیایی انتخاب نشده است.
      </div>
    );
  }

  if (isVideoSource(src)) {
    return (
      <video
        src={src}
        controls
        className="h-48 w-full rounded-3xl bg-slate-950 object-cover"
      />
    );
  }

  return (
    <img
      src={src}
      alt={title}
      className="h-48 w-full rounded-3xl bg-slate-100 object-cover"
    />
  );
}

export function MediaPickerDialog({
  open,
  value,
  unitId = null,
  onSelect,
  onClose,
}: MediaPickerDialogProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("upload");
  const [libraryItems, setLibraryItems] = useState<MediaAsset[] | null>(null);
  const [selectedUrl, setSelectedUrl] = useState(value);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      setSelectedUrl(value);
      setFileName("");
      setErrorText("");
      setIsDragging(false);
    });

    queueMicrotask(() => {
      if (!cancelled) setLibraryItems(null);
    });
    void panelService
      .mediaAssets(unitId ? { unit: unitId, page_size: 100 } : { page_size: 100 })
      .then((response) => {
        if (!cancelled) setLibraryItems(response.results);
      })
      .catch((reason) => {
        if (cancelled) return;
        setLibraryItems([]);
        setErrorText(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [open, unitId, value]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const canConfirm = useMemo(() => selectedUrl.trim().length > 0, [selectedUrl]);

  if (!open) return null;

  async function handleFile(file: File | null) {
    setErrorText("");

    if (!file) return;

    if (!SUPPORTED_MEDIA_TYPES.has(file.type)) {
      setErrorText("نوع فایل پشتیبانی نمی شود.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorText("حجم فایل نباید بیشتر از 25 مگابایت باشد.");
      return;
    }

    setIsUploading(true);
    try {
      const asset = await panelService.uploadMedia(file, {
        unitId,
        title: file.name,
        altText: file.name,
      });
      setSelectedUrl(asset.url);
      setFileName(asset.title);
    } catch (reason) {
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0] ?? null);
  }

  function confirmSelection() {
    if (!canConfirm) return;
    const url = selectedUrl.trim();
    if (!isSafeMediaUrl(url)) {
      setErrorText("نشانی رسانه معتبر نیست.");
      return;
    }
    onSelect(url);
    onClose();
  }

  const tabs: { key: MediaTab; label: string }[] = [
    { key: "upload", label: "آپلود" },
    { key: "url", label: "لینک" },
    { key: "library", label: "کتابخانه" },
  ];

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
          <div className="text-right">
            <p className="text-xs font-black text-blue-600">کتابخانه مدیا</p>
            <h2 className="mt-1 text-xl font-black text-[#062452]">
              افزودن یا انتخاب عکس و ویدیو
            </h2>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
              مدیا را از سیستم انتخاب کنید، لینک بدهید یا از موارد قبلی سایت بردارید.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <EditorIcon name="close" className="size-5" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_20rem]">
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`h-11 rounded-xl px-5 text-sm font-black transition ${
                    activeTab === tab.key
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-[#062452]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "upload" ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-[2rem] border-2 border-dashed p-8 text-center transition ${
                  isDragging
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                />

                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-2xl text-blue-700 shadow-sm">
                  <EditorIcon name="upload" className="size-6" />
                </div>

                <p className="text-base font-black text-[#062452]">
                  فایل را اینجا بکشید و رها کنید
                </p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  یا از دکمه زیر برای انتخاب عکس یا ویدیو استفاده کنید.
                </p>

                {fileName ? (
                  <p className="mt-4 text-xs font-black text-blue-700">
                    فایل انتخاب‌شده: {fileName}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-[#12395b] px-6 text-sm font-black text-white transition hover:bg-[#0d2f4d]"
                >
                  انتخاب از سیستم
                </button>
              </div>
            ) : null}

            {activeTab === "url" ? (
              <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                <label className="block text-right text-sm font-black text-[#062452]">
                  لینک عکس یا ویدیو
                </label>
                <input
                  value={selectedUrl}
                  onChange={(event) => setSelectedUrl(event.target.value)}
                  dir="ltr"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400"
                />
                <p className="text-right text-xs font-bold leading-6 text-slate-400">
                  لینک می‌تواند مسیر داخلی سایت یا URL کامل باشد.
                </p>
              </div>
            ) : null}

            {activeTab === "library" ? (
              <div>
                {libraryItems === null ? (
                  <div className="flex h-44 items-center justify-center">
                    <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
                  </div>
                ) : libraryItems.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">
                    مدیایی برای انتخاب وجود ندارد.
                  </div>
                ) : (
                  <div className="grid max-h-[28rem] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {libraryItems.map((item) => {
                      const selected = selectedUrl === item.url;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedUrl(item.url)}
                          className={`overflow-hidden rounded-3xl border bg-white text-right transition ${
                            selected
                              ? "border-blue-400 ring-4 ring-blue-100"
                              : "border-slate-200 hover:border-blue-200"
                          }`}
                        >
                          <MediaPreview src={item.url} title={item.title} />
                          <div className="p-4">
                            <p className="line-clamp-1 text-sm font-black text-[#062452]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              {item.media_type === "video" ? "ویدیو" : "تصویر"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {errorText ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                {errorText}
              </p>
            ) : null}
          </div>

          <aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-r lg:border-t-0 sm:p-7">
            <p className="mb-4 text-sm font-black text-[#062452]">پیش‌نمایش انتخاب</p>
            <MediaPreview src={selectedUrl} title="پیش‌نمایش مدیا" />

            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="break-all text-left text-xs font-bold leading-6 text-slate-500" dir="ltr">
                {getMediaSourceLabel(selectedUrl)}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={confirmSelection}
                disabled={!canConfirm}
                className="h-12 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                انتخاب مدیا
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-2xl bg-white px-5 text-sm font-black text-slate-500 transition hover:text-rose-600"
              >
                انصراف
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
