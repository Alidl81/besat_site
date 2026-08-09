"use client";

import { useEffect, useRef, useState } from "react";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type { MediaAsset } from "@/types/panel-api";

type ContentBlockInserterProps = {
  value: string;
  onChange: (nextValue: string) => void;
  unitId?: string | null;
  variant?: "default" | "sidebar";
  onUploadState?: (uploading: boolean) => void;
};

type BlockType = "gallery" | "media" | "quote" | "highlight";

type MediaDraft = {
  id: string;
  title: string;
  src: string;
  mediaType: "image" | "video";
  origin: "library" | "upload" | "url";
};

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isVideoSource(src: string, mediaType?: MediaDraft["mediaType"]) {
  if (mediaType === "video") return true;
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

function getMediaLabel(src: string) {
  if (!src) return "مدیایی انتخاب نشده است.";
  if (src.startsWith("data:image/")) return "تصویر انتخاب‌شده از سیستم";
  if (src.startsWith("data:video/")) return "ویدیوی انتخاب‌شده از سیستم";
  if (src.length <= 70) return src;

  return `${src.slice(0, 42)}...${src.slice(-18)}`;
}

function buildMediaElement(media: MediaDraft, className = "h-56 w-full rounded-3xl") {
  const src = escapeHtml(media.src);
  const title = escapeHtml(media.title);

  if (isVideoSource(media.src, media.mediaType)) {
    return `<video src="${src}" controls class="${className} bg-slate-950 object-cover"></video>`;
  }

  return `<img src="${src}" alt="${title}" class="${className} bg-slate-100 object-cover" />`;
}

function buildGalleryBlock(items: MediaDraft[]) {
  const cards = items
    .map((item) => {
      const src = escapeHtml(item.src);
      const type = isVideoSource(item.src, item.mediaType) ? "video" : "image";

      return `<div data-besat-gallery-item data-type="${type}" data-src="${src}"></div>`;
    })
    .join("");

  return `
<section data-besat-block="gallery" class="my-8">
  ${cards}
</section>`;
}

function buildSingleMediaBlock(item: MediaDraft) {
  const title = escapeHtml(item.title);

  return `
<figure data-besat-block="media" class="my-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
  ${buildMediaElement(item, "max-h-[30rem] w-full rounded-[1.6rem]")}
  <figcaption class="mt-4 text-right text-sm font-black text-[#062452]">${title}</figcaption>
</figure>`;
}

function buildQuoteBlock(text: string, source: string) {
  const safeText = escapeHtml(text);
  const safeSource = escapeHtml(source);

  return `
<blockquote data-besat-block="quote" class="my-8 rounded-[2rem] border-r-4 border-blue-500 bg-blue-50 p-6 text-right">
  <p class="text-lg font-black leading-9 text-[#062452]">${safeText}</p>
  ${safeSource ? `<cite class="mt-4 block text-sm font-bold not-italic text-blue-700">${safeSource}</cite>` : ""}
</blockquote>`;
}

function buildHighlightBlock(title: string, body: string) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);

  return `
<section data-besat-block="highlight" class="my-8 rounded-[2rem] border border-slate-200 bg-[#062452] p-6 text-right text-white shadow-sm">
  ${safeTitle ? `<h3 class="text-xl font-black">${safeTitle}</h3>` : ""}
  <p class="mt-3 text-sm font-bold leading-8 text-white/80">${safeBody}</p>
</section>`;
}

function mediaDraftFromAsset(asset: MediaAsset): MediaDraft {
  return {
    id: `media-${asset.id}`,
    title: asset.title,
    src: asset.url,
    mediaType: asset.media_type,
    origin: "library",
  };
}

function getUrlMediaType(url: string): MediaDraft["mediaType"] {
  return isVideoSource(url) ? "video" : "image";
}

function isSafeMediaUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function fileValidationMessage(file: File): string | null {
  if (!SUPPORTED_MEDIA_TYPES.has(file.type)) {
    return "نوع فایل پشتیبانی نمی شود.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "حجم فایل نباید بیشتر از 25 مگابایت باشد.";
  }
  return null;
}
export function ContentBlockInserter({
  value,
  onChange,
  unitId = null,
  variant = "default",
  onUploadState,
}: ContentBlockInserterProps) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<BlockType>("gallery");
  const [libraryItems, setLibraryItems] = useState<MediaDraft[] | null>(null);
  const [customItems, setCustomItems] = useState<MediaDraft[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [directUrl, setDirectUrl] = useState("");
  const [directTitle, setDirectTitle] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [highlightTitle, setHighlightTitle] = useState("");
  const [highlightBody, setHighlightBody] = useState("");
  const [errorText, setErrorText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLibraryItems(null);
    });

    void panelService
      .mediaAssets(unitId ? { unit: unitId, page_size: 100 } : { page_size: 100 })
      .then((response) => {
        if (!cancelled) setLibraryItems(response.results.map(mediaDraftFromAsset));
      })
      .catch((reason) => {
        if (cancelled) return;
        setLibraryItems([]);
        setErrorText(getApiErrorMessage(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [open, unitId]);

  const allMediaItems = [...customItems, ...(libraryItems ?? [])];

  function resetDialogState() {
    setSelectedIds([]);
    setDirectUrl("");
    setDirectTitle("");
    setQuoteText("");
    setQuoteSource("");
    setHighlightTitle("");
    setHighlightBody("");
    setErrorText("");
  }

  function openDialog(type: BlockType) {
    setActiveType(type);
    resetDialogState();
    setOpen(true);
  }

  function appendBlock(blockHtml: string) {
    const separator = value.trim() ? "\n\n" : "";
    onChange(`${value}${separator}${blockHtml}`);
    setOpen(false);
    resetDialogState();
  }

  function toggleMedia(id: string) {
    setSelectedIds((current) => {
      if (activeType === "media") {
        return current.includes(id) ? [] : [id];
      }

      return current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id];
    });
  }

  function addDirectUrl() {
    const src = directUrl.trim();

    if (!src) {
      setErrorText("لینک مدیا را وارد کنید.");
      return;
    }

    if (!isSafeMediaUrl(src)) {
      setErrorText("نشانی رسانه معتبر نیست.");
      return;
    }

    const id = `url-${Date.now()}`;
    const item: MediaDraft = {
      id,
      title: directTitle.trim() || "مدیای لینک‌شده",
      src,
      mediaType: getUrlMediaType(src),
      origin: "url",
    };

    setCustomItems((current) => [item, ...current]);
    setSelectedIds((current) => activeType === "media" ? [id] : [id, ...current]);
    setDirectUrl("");
    setDirectTitle("");
    setErrorText("");
  }

  async function handleFiles(files: FileList | null) {
    setErrorText("");

    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploading(true);
    onUploadState?.(true);

    for (const file of fileArray) {
      const validationMessage = fileValidationMessage(file);
      if (validationMessage) {
        setErrorText(validationMessage);
        continue;
      }

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setErrorText("فقط فایل عکس یا ویدیو قابل انتخاب است.");
        continue;
      }

      const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      try {
        const result = await panelService.uploadMedia(file, {
          unitId,
          title: directTitle.trim() || file.name,
          altText: directTitle.trim() || file.name,
          caption: directTitle.trim(),
        });

        const item: MediaDraft = {
          id,
          title: file.name,
          src: result.url,
          mediaType: result.media_type,
          origin: "upload",
        };

        setCustomItems((current) => [item, ...current]);
        setSelectedIds((current) => (activeType === "media" ? [id] : [id, ...current]));
      } catch {
        setErrorText("خواندن فایل انجام نشد.");
      }
    }

    setUploading(false);
    onUploadState?.(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function insertSelectedBlock() {
    if (activeType === "gallery") {
      const selectedItems = allMediaItems.filter((item) => selectedIds.includes(item.id));
      if (selectedItems.length === 0) return;
      appendBlock(buildGalleryBlock(selectedItems));
      return;
    }

    if (activeType === "media") {
      const selectedItem = allMediaItems.find((item) => selectedIds.includes(item.id));
      if (!selectedItem) return;
      appendBlock(buildSingleMediaBlock(selectedItem));
      return;
    }

    if (activeType === "quote") {
      if (!quoteText.trim()) {
        setErrorText("متن نقل‌قول را وارد کنید.");
        return;
      }

      appendBlock(buildQuoteBlock(quoteText.trim(), quoteSource.trim()));
      return;
    }

    if (activeType === "highlight") {
      if (!highlightBody.trim()) {
        setErrorText("متن برجسته را وارد کنید.");
        return;
      }

      appendBlock(buildHighlightBlock(highlightTitle.trim(), highlightBody.trim()));
    }
  }

  const blockTypes: { key: BlockType; title: string; description: string; icon: EditorIconName }[] = [
    { key: "gallery", title: "گالری", description: "چند عکس یا ویدیو داخل متن", icon: "gallery" },
    { key: "media", title: "مدیای تکی", description: "یک عکس یا ویدیو با توضیح", icon: "image" },
    { key: "quote", title: "نقل‌قول", description: "متن شاخص یا نقل‌قول", icon: "quote" },
    { key: "highlight", title: "متن برجسته", description: "باکس تأکیدی داخل متن", icon: "heading" },
  ];

  const insertDisabled =
    (activeType === "gallery" || activeType === "media") && selectedIds.length === 0;

  return (
    <>
      <div className={variant === "sidebar" ? "besat-editor-media-blocks" : "rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-right"}>
        <div>
          <p className="text-sm font-black text-[#062452]">{variant === "sidebar" ? "بلوک‌های رسانه‌ای" : "بلوک‌های محتوا"}</p>
          <p className={variant === "sidebar" ? "mt-1 text-[11px] font-bold leading-5 text-slate-500" : "mt-1 text-xs font-bold leading-6 text-slate-500"}>
            می‌توانید به متن، بلوک‌های گالری، مدیا، نقل‌قول یا متن برجسته اضافه کنید.
          </p>
        </div>

        <div className={variant === "sidebar" ? "mt-3 grid gap-2" : "mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"}>
          {blockTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => openDialog(type.key)}
              className={variant === "sidebar" ? "besat-editor-media-block-button" : "rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-300 hover:bg-blue-50"}
            >
              <EditorIcon name={type.icon} className="size-4 shrink-0" />
              <span>
                <span className="block text-sm font-black text-[#062452]">{type.title}</span>
                <span className={variant === "sidebar" ? "mt-0.5 block text-[10px] font-bold leading-5 text-slate-500" : "mt-1 block text-xs font-bold leading-6 text-slate-500"}>
                  {type.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {open ? (
        <div
          dir="rtl"
          className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div className="text-right">
                <p className="text-xs font-black text-blue-600">بلوک محتوا</p>
                <h2 className="mt-1 text-xl font-black text-[#062452]">
                  افزودن بلوک {blockTypes.find((item) => item.key === activeType)?.title}
                </h2>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                  بلوک انتخاب‌شده به انتهای متن فعلی اضافه می‌شود.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <EditorIcon name="close" className="size-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {activeType === "gallery" || activeType === "media" ? (
                <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
                  <aside className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-[#062452]">
                      افزودن سریع مدیا
                    </p>
                    <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                      لازم نیست حتماً از کتابخانه قبلی انتخاب کنید.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(event) => handleFiles(event.target.files)}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-4 h-11 w-full rounded-2xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d]"
                    >
                      انتخاب فایل‌ها از سیستم
                    </button>

                    <div className="mt-5 space-y-3">
                      <label className="block text-right">
                        <span className="mb-2 block text-xs font-black text-[#062452]">
                          عنوان مدیا
                        </span>
                        <input
                          value={directTitle}
                          onChange={(event) => setDirectTitle(event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400"
                        />
                      </label>

                      <label className="block text-right">
                        <span className="mb-2 block text-xs font-black text-[#062452]">
                          لینک مدیا
                        </span>
                        <input
                          value={directUrl}
                          onChange={(event) => setDirectUrl(event.target.value)}
                          dir="ltr"
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-[#062452] outline-none focus:border-blue-400"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={addDirectUrl}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#062452] transition hover:bg-white"
                      >
                        افزودن لینک
                      </button>
                    </div>
                  </aside>

                  <div>
                    {libraryItems === null ? (
                      <div className="flex h-44 items-center justify-center">
                        <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
                      </div>
                    ) : allMediaItems.length === 0 ? (
                      <div className="rounded-[2rem] border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">
                        مدیایی برای انتخاب وجود ندارد.
                      </div>
                    ) : (
                      <div className="grid max-h-[32rem] gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                        {allMediaItems.map((item) => {
                          const selected = selectedIds.includes(item.id);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleMedia(item.id)}
                              className={`overflow-hidden rounded-3xl border bg-white p-3 text-right transition ${
                                selected
                                  ? "border-blue-400 ring-4 ring-blue-100"
                                  : "border-slate-200 hover:border-blue-200"
                              }`}
                            >
                              {isVideoSource(item.src, item.mediaType) ? (
                                <video
                                  src={item.src}
                                  muted
                                  className="h-44 w-full rounded-2xl bg-slate-950 object-cover"
                                />
                              ) : (
                                <img
                                  src={item.src}
                                  alt={item.title}
                                  className="h-44 w-full rounded-2xl bg-slate-100 object-cover"
                                />
                              )}

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="block line-clamp-1 text-sm font-black text-[#062452]">
                                    {item.title}
                                  </span>
                                  <span className="mt-1 block line-clamp-1 text-xs font-bold text-slate-400">
                                    {getMediaLabel(item.src)}
                                  </span>
                                </span>

                                <span
                                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                    selected
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  <EditorIcon name="check" className="size-4" />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeType === "quote" ? (
                <div className="space-y-4">
                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      متن نقل‌قول
                    </span>
                    <textarea
                      value={quoteText}
                      onChange={(event) => setQuoteText(event.target.value)}
                      rows={5}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold leading-7 text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>

                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      منبع یا نام شخص
                    </span>
                    <input
                      value={quoteSource}
                      onChange={(event) => setQuoteSource(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>
                </div>
              ) : null}

              {activeType === "highlight" ? (
                <div className="space-y-4">
                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      عنوان
                    </span>
                    <input
                      value={highlightTitle}
                      onChange={(event) => setHighlightTitle(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>

                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      متن برجسته
                    </span>
                    <textarea
                      value={highlightBody}
                      onChange={(event) => setHighlightBody(event.target.value)}
                      rows={5}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold leading-7 text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>
                </div>
              ) : null}

              {errorText ? (
                <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                  {errorText}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={insertSelectedBlock}
                  disabled={insertDisabled}
                  className="h-12 rounded-2xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  درج بلوک
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
