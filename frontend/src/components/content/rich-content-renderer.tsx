"use client";

import { useMemo, useState } from "react";

type GalleryItem = {
  src: string;
  type: "image" | "video";
};

type GalleryPart = {
  type: "gallery";
  items: GalleryItem[];
  width: string;
  height: string;
};

type ContentPart =
  | { type: "html"; html: string }
  | GalleryPart;

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttr(html: string, attr: string) {
  const regex = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  const match = html.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function normalizeSize(value: string, fallback: string) {
  const trimmed = value.trim();

  if (!trimmed) return fallback;

  if (
    /^\d+px$/.test(trimmed) ||
    /^\d+rem$/.test(trimmed) ||
    /^\d+%$/.test(trimmed) ||
    /^calc\(.+\)$/.test(trimmed)
  ) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}px`;
  }

  return fallback;
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

function extractGalleryItems(blockHtml: string): GalleryItem[] {
  const items: GalleryItem[] = [];

  const dataItemRegex = /<[^>]+data-besat-gallery-item[^>]*>/gi;
  const dataItems = blockHtml.match(dataItemRegex) ?? [];

  for (const itemHtml of dataItems) {
    const src = getAttr(itemHtml, "data-src");
    const typeAttr = getAttr(itemHtml, "data-type");

    if (src) {
      items.push({
        src,
        type: typeAttr === "video" || isVideoSource(src) ? "video" : "image",
      });
    }
  }

  if (items.length > 0) return items;

  const mediaRegex = /<(img|video)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = mediaRegex.exec(blockHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const src = decodeHtml(match[2]);

    if (src) {
      items.push({
        src,
        type: tag === "video" || isVideoSource(src) ? "video" : "image",
      });
    }
  }

  return items;
}

function parseContent(html: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const galleryRegex = /<section\b[^>]*data-besat-block=["']gallery["'][\s\S]*?<\/section>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = galleryRegex.exec(html)) !== null) {
    const before = html.slice(lastIndex, match.index);

    if (before.trim()) {
      parts.push({ type: "html", html: before });
    }

    const blockHtml = match[0];
    const galleryItems = extractGalleryItems(blockHtml);

    if (galleryItems.length > 0) {
      parts.push({
        type: "gallery",
        items: galleryItems,
        width: normalizeSize(getAttr(blockHtml, "data-width"), "100%"),
        height: normalizeSize(getAttr(blockHtml, "data-height"), "14rem"),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const after = html.slice(lastIndex);

  if (after.trim()) {
    parts.push({ type: "html", html: after });
  }

  if (parts.length === 0 && html.trim()) {
    parts.push({ type: "html", html });
  }

  return parts;
}

function GalleryBlock({
  items,
  width,
  height,
}: {
  items: GalleryItem[];
  width: string;
  height: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");

  const isScrollable = items.length > 3;
  const safeActiveIndex = activeIndex ?? 0;
  const activeItem = activeIndex === null ? null : items[safeActiveIndex];

  function goNext() {
    if (activeIndex === null) return;
    setSlideDirection("next");
    setActiveIndex((activeIndex + 1) % items.length);
  }

  function goPrev() {
    if (activeIndex === null) return;
    setSlideDirection("prev");
    setActiveIndex((activeIndex - 1 + items.length) % items.length);
  }

  function goToIndex(index: number) {
    if (activeIndex !== null) {
      setSlideDirection(index >= activeIndex ? "next" : "prev");
    }
    setActiveIndex(index);
  }

  return (
    <>
      <div
        data-besat-rendered-block="gallery"
        className={
          isScrollable
            ? "my-8 flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-3"
            : "my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
        style={{
          width,
          maxWidth: "100%",
        }}
      >
        {items.map((item, index) => (
          <button
            key={`${item.src}-${index}`}
            type="button"
            onClick={() => goToIndex(index)}
            className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-2 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
            style={
              isScrollable
                ? {
                    width: "clamp(9rem, 31%, 18rem)",
                    flex: "0 0 clamp(9rem, 31%, 18rem)",
                  }
                : undefined
            }
            aria-label="مشاهده تصویر"
          >
            {item.type === "video" ? (
              <video
                src={item.src}
                muted
                className="w-full rounded-[1.25rem] bg-slate-950 object-cover transition duration-500 group-hover:scale-[1.02]"
                style={{ height }}
              />
            ) : (
              <img
                src={item.src}
                alt=""
                className="w-full rounded-[1.25rem] bg-slate-100 object-cover transition duration-500 group-hover:scale-[1.02]"
                style={{ height }}
              />
            )}
          </button>
        ))}
      </div>

      {activeItem ? (
        <div
          dir="rtl"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveIndex(null);
          }}
        >
          <style>
            {`
              @keyframes besatGalleryNext {
                from {
                  opacity: 0;
                  transform: translateX(72px) scale(0.985);
                  filter: blur(4px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                  filter: blur(0);
                }
              }

              @keyframes besatGalleryPrev {
                from {
                  opacity: 0;
                  transform: translateX(-72px) scale(0.985);
                  filter: blur(4px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                  filter: blur(0);
                }
              }
            `}
          </style>

          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            aria-label="بستن"
            className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white transition duration-300 hover:bg-white/20"
          >
            ✕
          </button>

          {items.length > 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white transition duration-300 hover:bg-white/20 sm:block"
            >
              بعدی
            </button>
          ) : null}

          <div className="mx-auto flex max-h-[82vh] w-full max-w-6xl items-center justify-center px-16">
            <div
              key={`${activeItem.src}-${safeActiveIndex}`}
              className="flex w-full items-center justify-center"
              style={{
                animation:
                  slideDirection === "next"
                    ? "besatGalleryNext 340ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "besatGalleryPrev 340ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {activeItem.type === "video" ? (
                <video
                  src={activeItem.src}
                  controls
                  autoPlay
                  className="max-h-[82vh] w-full rounded-[1.5rem] bg-black object-contain"
                />
              ) : (
                <img
                  src={activeItem.src}
                  alt=""
                  className="max-h-[82vh] w-full rounded-[1.5rem] object-contain"
                />
              )}
            </div>
          </div>

          {items.length > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white transition duration-300 hover:bg-white/20 sm:block"
            >
              قبلی
            </button>
          ) : null}

          {items.length > 1 ? (
            <div
              dir="ltr"
              className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-xs font-black text-white"
            >
              <span>{safeActiveIndex + 1}</span>
              <span>/</span>
              <span>{items.length}</span>
            </div>
          ) : null}

          {items.length > 1 ? (
            <div
              dir="ltr"
              className="absolute bottom-4 left-1/2 z-20 flex max-w-[86vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-2xl bg-white/10 p-2"
            >
              {items.map((item, index) => (
                <button
                  key={`${item.src}-thumb-${index}`}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={`size-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    index === safeActiveIndex
                      ? "border-white opacity-100"
                      : "border-white/20 opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`تصویر ${index + 1}`}
                >
                  {item.type === "video" ? (
                    <video
                      src={item.src}
                      muted
                      className="size-full bg-black object-cover"
                    />
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function RichContentRenderer({ html }: { html: string }) {
  const parts = useMemo(() => parseContent(html), [html]);

  return (
    <div className="besat-rich-content mt-8 max-w-none text-right text-base font-medium leading-9 text-slate-700">
      {parts.map((part, index) => {
        if (part.type === "gallery") {
          return (
            <GalleryBlock
              key={`gallery-${index}`}
              items={part.items}
              width={part.width}
              height={part.height}
            />
          );
        }

        return (
          <div
            key={`html-${index}`}
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </div>
  );
}