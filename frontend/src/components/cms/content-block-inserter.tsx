"use client";

import { useEffect, useRef, useState } from "react";
import { galleryRepository } from "@/lib/data/repositories";
import type { GalleryItemRecord } from "@/lib/data/domain-types";

type ContentBlockInserterProps = {
  value: string;
  onChange: (nextValue: string) => void;
  unitId?: string | null;
};

type BlockType = "gallery" | "media" | "quote" | "highlight";

type MediaDraft = {
  id: string;
  title: string;
  src: string;
  origin: "library" | "upload" | "url";
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  if (isVideoSource(media.src)) {
    return `<video src="${src}" controls class="${className} bg-slate-950 object-cover"></video>`;
  }

  return `<img src="${src}" alt="${title}" class="${className} bg-slate-100 object-cover" />`;
}

function buildGalleryBlock(items: MediaDraft[]) {
  const cards = items
    .map((item) => {
      const src = escapeHtml(item.src);
      const type = isVideoSource(item.src) ? "video" : "image";

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
<blockquote data-besat-block="quote" class="my-8 rounded-[2rem] border-r-4 border-emerald-500 bg-emerald-50 p-6 text-right">
  <p class="text-lg font-black leading-9 text-[#062452]">${safeText}</p>
  ${safeSource ? `<cite class="mt-4 block text-sm font-bold not-italic text-emerald-700">${safeSource}</cite>` : ""}
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result) {
        reject(new Error("empty-file-result"));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });
}

function optimizeImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return readFileAsDataUrl(file);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      const maxSide = 1280;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        readFileAsDataUrl(file).then(resolve);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then(resolve);
    };

    image.src = objectUrl;
  });
}
export function ContentBlockInserter({
  value,
  onChange,
  unitId = null,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    galleryRepository.list().then((allItems) => {
      const visibleItems = allItems
        .filter((item) => {
          if (item.status === "rejected") return false;
          if (!unitId) return true;
          return item.unit_id === unitId || item.scope === "school";
        })
        .map((item) => ({
          id: `library-${item.id}`,
          title: item.title,
          src: item.image,
          origin: "library" as const,
        }));

      setLibraryItems(visibleItems);
    });
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

    const id = `url-${Date.now()}`;
    const item: MediaDraft = {
      id,
      title: directTitle.trim() || "مدیای لینک‌شده",
      src,
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

    for (const file of fileArray) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setErrorText("فقط فایل عکس یا ویدیو قابل انتخاب است.");
        continue;
      }

      const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      try {
        const result = await optimizeImageFile(file);

        const item: MediaDraft = {
          id,
          title: file.name,
          src: result,
          origin: "upload",
        };

        setCustomItems((current) => [item, ...current]);
        setSelectedIds((current) => (activeType === "media" ? [id] : [id, ...current]));
      } catch {
        setErrorText("خواندن فایل انجام نشد.");
      }
    }
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

  const blockTypes: { key: BlockType; title: string; description: string }[] = [
    { key: "gallery", title: "گالری", description: "چند عکس یا ویدیو داخل متن" },
    { key: "media", title: "مدیای تکی", description: "یک عکس یا ویدیو با توضیح" },
    { key: "quote", title: "نقل‌قول", description: "متن شاخص یا نقل‌قول" },
    { key: "highlight", title: "متن برجسته", description: "باکس تأکیدی داخل متن" },
  ];

  const insertDisabled =
    (activeType === "gallery" || activeType === "media") && selectedIds.length === 0;

  return (
    <>
      <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-right">
        <div>
          <p className="text-sm font-black text-[#062452]">بلوک‌های محتوا</p>
          <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
            می‌توانید به متن، بلوک‌های گالری، مدیا، نقل‌قول یا متن برجسته اضافه کنید.
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {blockTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => openDialog(type.key)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span className="block text-sm font-black text-[#062452]">{type.title}</span>
              <span className="mt-1 block text-xs font-bold leading-6 text-slate-500">
                {type.description}
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
                <p className="text-xs font-black text-emerald-600">بلوک محتوا</p>
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
                ✕
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
                      className="hidden"
                      onChange={(event) => handleFiles(event.target.files)}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
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
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-emerald-400"
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
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-[#062452] outline-none focus:border-emerald-400"
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
                        <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
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
                                  ? "border-emerald-400 ring-4 ring-emerald-100"
                                  : "border-slate-200 hover:border-emerald-200"
                              }`}
                            >
                              {isVideoSource(item.src) ? (
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
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  ✓
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
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold leading-7 text-[#062452] outline-none focus:border-emerald-400 focus:bg-white"
                    />
                  </label>

                  <label className="block text-right">
                    <span className="mb-2 block text-sm font-black text-[#062452]">
                      منبع یا نام شخص
                    </span>
                    <input
                      value={quoteSource}
                      onChange={(event) => setQuoteSource(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-emerald-400 focus:bg-white"
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
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none focus:border-emerald-400 focus:bg-white"
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
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold leading-7 text-[#062452] outline-none focus:border-emerald-400 focus:bg-white"
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
                  className="h-12 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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