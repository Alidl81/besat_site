"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  buildCalloutBlockHtml,
  buildEmbedBlockHtml,
  buildGalleryBlockHtml,
  buildMediaBlockHtml,
  buildQuoteBlockHtml,
  normalizeSafeEmbedUrl,
  safeStructuredMediaUrl,
  type StructuredMediaItem,
} from "@/lib/editor/structured-content";
import { panelService } from "@/services/panel-service";
import type { MediaAsset } from "@/types/panel-api";

type ContentBlockInserterProps = {
  value: string;
  onChange: (nextValue: string) => void;
  unitId?: string | null;
  variant?: "default" | "sidebar";
  onUploadState?: (uploading: boolean) => void;
};

type BlockType = "gallery" | "media" | "quote" | "highlight" | "embed";

type MediaDraft = StructuredMediaItem & {
  id: string;
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

function mediaDraftFromAsset(asset: MediaAsset): MediaDraft {
  return {
    id: `media-${asset.id}`,
    title: asset.title,
    src: asset.url,
    mediaType: asset.media_type,
    type: asset.media_type,
    alt: asset.alt_text,
    caption: asset.caption,
    origin: "library",
  };
}

function getUrlMediaType(url: string): MediaDraft["mediaType"] {
  return isVideoSource(url) ? "video" : "image";
}

function isSafeMediaUrl(url: string) {
  return Boolean(safeStructuredMediaUrl(url));
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
  const [directAlt, setDirectAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaCredit, setMediaCredit] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [highlightTitle, setHighlightTitle] = useState("");
  const [highlightBody, setHighlightBody] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedCaption, setEmbedCaption] = useState("");
  const [errorText, setErrorText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const resetDialogState = useCallback(() => {
    setSelectedIds([]);
    setDirectUrl("");
    setDirectTitle("");
    setDirectAlt("");
    setMediaCaption("");
    setMediaCredit("");
    setQuoteText("");
    setQuoteSource("");
    setHighlightTitle("");
    setHighlightBody("");
    setEmbedUrl("");
    setEmbedTitle("");
    setEmbedCaption("");
    setErrorText("");
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    resetDialogState();
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, [resetDialogState]);

  useEffect(() => {
    if (!open || (activeType !== "gallery" && activeType !== "media")) return;

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
  }, [activeType, open, unitId]);

  const allMediaItems = [...customItems, ...(libraryItems ?? [])];

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, open]);

  function openDialog(type: BlockType) {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setActiveType(type);
    resetDialogState();
    setOpen(true);
  }

  function appendBlock(blockHtml: string) {
    if (!blockHtml) return;
    const separator = value.trim() ? "\n\n" : "";
    onChange(`${value}${separator}${blockHtml}`);
    setOpen(false);
    resetDialogState();
    window.setTimeout(() => openerRef.current?.focus(), 0);
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
      type: getUrlMediaType(src),
      alt: directAlt.trim() || directTitle.trim(),
      caption: mediaCaption.trim(),
      credit: mediaCredit.trim(),
      origin: "url",
    };

    setCustomItems((current) => [item, ...current]);
    setSelectedIds((current) => activeType === "media" ? [id] : [id, ...current]);
    setDirectUrl("");
    setDirectTitle("");
    setDirectAlt("");
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
          altText: directAlt.trim() || directTitle.trim() || file.name,
          caption: mediaCaption.trim(),
        });

        const item: MediaDraft = {
          id,
          title: file.name,
          src: result.url,
          mediaType: result.media_type,
          type: result.media_type,
          alt: result.alt_text || directAlt.trim() || file.name,
          caption: result.caption || mediaCaption.trim(),
          credit: mediaCredit.trim(),
          origin: "upload",
        };

        setCustomItems((current) => [item, ...current]);
        setSelectedIds((current) => (activeType === "media" ? [id] : [id, ...current]));
      } catch (reason) {
        const apiMessage = getApiErrorMessage(reason);
        if (apiMessage) {
          setErrorText(apiMessage);
          continue;
        }
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
      appendBlock(buildGalleryBlockHtml(selectedItems));
      return;
    }

    if (activeType === "media") {
      const selectedItem = allMediaItems.find((item) => selectedIds.includes(item.id));
      if (!selectedItem) return;
      appendBlock(buildMediaBlockHtml({
        ...selectedItem,
        type: selectedItem.mediaType,
        alt: directAlt.trim() || selectedItem.alt || selectedItem.title,
        caption: mediaCaption.trim() || selectedItem.caption || selectedItem.title,
        credit: mediaCredit.trim() || selectedItem.credit,
      }));
      return;
    }

    if (activeType === "quote") {
      if (!quoteText.trim()) {
        setErrorText("متن نقل‌قول را وارد کنید.");
        return;
      }

      appendBlock(buildQuoteBlockHtml(quoteText.trim(), quoteSource.trim()));
      return;
    }

    if (activeType === "highlight") {
      if (!highlightBody.trim()) {
        setErrorText("متن برجسته را وارد کنید.");
        return;
      }

      appendBlock(buildCalloutBlockHtml(highlightTitle.trim(), highlightBody.trim()));
      return;
    }

    if (activeType === "embed") {
      if (!normalizeSafeEmbedUrl(embedUrl)) {
        setErrorText("نشانی ویدئو باید از YouTube یا Vimeo باشد.");
        return;
      }
      appendBlock(buildEmbedBlockHtml(embedUrl, embedTitle, embedCaption));
    }
  }

  const blockTypes: { key: BlockType; title: string; description: string; icon: EditorIconName }[] = [
    { key: "gallery", title: "گالری", description: "چند عکس یا ویدیو داخل متن", icon: "gallery" },
    { key: "media", title: "مدیای تکی", description: "یک عکس یا ویدیو با توضیح", icon: "image" },
    { key: "quote", title: "نقل‌قول", description: "متن شاخص یا نقل‌قول", icon: "quote" },
    { key: "highlight", title: "متن برجسته", description: "باکس تأکیدی داخل متن", icon: "heading" },
    { key: "embed", title: "ویدئوی امن", description: "ویدئوی YouTube یا Vimeo با نمایش امن", icon: "gallery" },
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

      {open
        ? createPortal(
            <div
              dir="rtl"
              className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeDialog();
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="content-block-dialog-title"
                tabIndex={-1}
                className="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
              >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div className="text-right">
                <p className="text-xs font-black text-blue-600">بلوک محتوا</p>
                <h2 id="content-block-dialog-title" className="mt-1 text-xl font-black text-[#062452]">
                  افزودن بلوک {blockTypes.find((item) => item.key === activeType)?.title}
                </h2>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                  بلوک انتخاب‌شده به انتهای متن فعلی اضافه می‌شود.
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                aria-label="بستن"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <EditorIcon name="close" className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
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

                      <label className="block text-right">
                        <span className="mb-2 block text-xs font-black text-[#062452]">
                          متن جایگزین تصویر
                        </span>
                        <input
                          value={directAlt}
                          onChange={(event) => setDirectAlt(event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400"
                        />
                      </label>

                      <label className="block text-right">
                        <span className="mb-2 block text-xs font-black text-[#062452]">
                          زیرنویس و اعتبار
                        </span>
                        <input
                          value={mediaCaption}
                          onChange={(event) => setMediaCaption(event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400"
                        />
                        <input
                          value={mediaCredit}
                          onChange={(event) => setMediaCredit(event.target.value)}
                          placeholder="نام صاحب اثر یا منبع"
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400"
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

              {activeType === "embed" ? (
                <div className="space-y-4">
                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      نشانی ویدئو (YouTube یا Vimeo)
                    </span>
                    <input
                      value={embedUrl}
                      onChange={(event) => setEmbedUrl(event.target.value)}
                      dir="ltr"
                      inputMode="url"
                      placeholder="https://youtu.be/..."
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-bold text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>
                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">عنوان و زیرنویس</span>
                    <input
                      value={embedTitle}
                      onChange={(event) => setEmbedTitle(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                    <input
                      value={embedCaption}
                      onChange={(event) => setEmbedCaption(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </label>
                  <p className="text-xs font-bold leading-6 text-slate-500">
                    فقط نشانی‌های قابل‌اعتماد YouTube و Vimeo به نمایش تعبیه‌شده تبدیل می‌شوند.
                  </p>
                </div>
              ) : null}

              {errorText ? (
                <p role="alert" className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                  {errorText}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
