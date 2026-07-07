"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { galleryRepository } from "@/lib/data/repositories";
import type { GalleryItemRecord } from "@/lib/data/domain-types";

type MediaPickerDialogProps = {
  open: boolean;
  value: string;
  unitId?: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
};

type MediaTab = "upload" | "url" | "library";


function getMediaSourceLabel(src: string) {
  if (!src) return "No media selected";
  if (src.startsWith("data:image/")) return "تصویر انتخاب‌شده از سیستم";
  if (src.startsWith("data:video/")) return "ویدیوی انتخاب‌شده از سیستم";
  if (src.length <= 80) return src;

  return `${src.slice(0, 44)}...${src.slice(-20)}`;
}
function isVideoSource(src: string) {
  const normalized = src.toLowerCase();
  return (
    normalized.startsWith("data:video/") ||
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".ogg") ||
    normalized.includes(".mp4?") ||
    normalized.includes(".webm?") ||
    normalized.includes(".ogg?")
  );
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
  const [libraryItems, setLibraryItems] = useState<GalleryItemRecord[] | null>(null);
  const [selectedUrl, setSelectedUrl] = useState(value);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [errorText, setErrorText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setSelectedUrl(value);
    setFileName("");
    setErrorText("");
    setIsDragging(false);

    galleryRepository.list().then((items) => {
      const visibleItems = items.filter((item) => {
        if (!unitId) return true;
        return item.unit_id === unitId || item.scope === "school";
      });

      setLibraryItems(visibleItems);
    });
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

  function handleFile(file: File | null) {
    setErrorText("");

    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setErrorText("فقط فایل عکس یا ویدیو قابل انتخاب است.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result) {
        setErrorText("خواندن فایل انجام نشد.");
        return;
      }

      setSelectedUrl(result);
      setFileName(file.name);
    };

    reader.onerror = () => {
      setErrorText("خواندن فایل انجام نشد.");
    };

    reader.readAsDataURL(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0] ?? null);
  }

  function confirmSelection() {
    if (!canConfirm) return;
    onSelect(selectedUrl.trim());
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
            <p className="text-xs font-black text-emerald-600">کتابخانه مدیا</p>
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
            ✕
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
                      ? "bg-white text-emerald-700 shadow-sm"
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
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />

                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-2xl text-emerald-700 shadow-sm">
                  ⤴
                </div>

                <p className="text-base font-black text-[#062452]">
                  فایل را اینجا بکشید و رها کنید
                </p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  یا از دکمه زیر برای انتخاب عکس یا ویدیو استفاده کنید.
                </p>

                {fileName ? (
                  <p className="mt-4 text-xs font-black text-emerald-700">
                    فایل انتخاب‌شده: {fileName}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
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
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400"
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
                    <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                  </div>
                ) : libraryItems.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">
                    مدیایی برای انتخاب وجود ندارد.
                  </div>
                ) : (
                  <div className="grid max-h-[28rem] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {libraryItems.map((item) => {
                      const selected = selectedUrl === item.image;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedUrl(item.image)}
                          className={`overflow-hidden rounded-3xl border bg-white text-right transition ${
                            selected
                              ? "border-emerald-400 ring-4 ring-emerald-100"
                              : "border-slate-200 hover:border-emerald-200"
                          }`}
                        >
                          <MediaPreview src={item.image} title={item.title} />
                          <div className="p-4">
                            <p className="line-clamp-1 text-sm font-black text-[#062452]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              {item.album ?? "بدون آلبوم"}
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
                className="h-12 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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