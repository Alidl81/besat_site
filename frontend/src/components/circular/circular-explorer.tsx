"use client";

import { useEffect, useRef, useState } from "react";
import { CircularSelector, type CircularItem } from "@/components/circular/circular-selector";
import { ScopedTabs, type ScopedTab } from "@/components/circular/scoped-tabs";
import { contentRepository, galleryRepository } from "@/lib/data/repositories";
import type { ContentRecord, GalleryItemRecord } from "@/lib/data/domain-types";

type CircularExplorerProps = {
  items: CircularItem[];
  /** توضیح کوتاه هر آیتم (برای overview) */
  descriptions: Record<string, string | null>;
  variant: "unit" | "department";
  initialSlug?: string | null;
};

const tabs: ScopedTab[] = [
  { key: "overview", label: "معرفی", icon: "◇" },
  { key: "news", label: "اخبار", icon: "▦" },
  { key: "announcements", label: "اطلاعیه‌ها", icon: "▤" },
  { key: "gallery", label: "گالری", icon: "▧" },
];

export function CircularExplorer({ items, descriptions, variant, initialSlug }: CircularExplorerProps) {
  const [activeId, setActiveId] = useState<string>(() => {
    const matchedInitialItem = initialSlug
      ? items.find((item) => item.slug === initialSlug)
      : null;

    return matchedInitialItem?.id ?? items[0]?.id ?? "";
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!initialSlug) {
      return;
    }

    const matchedInitialItemOnChange = items.find((item) => item.slug === initialSlug);

    if (matchedInitialItemOnChange) {
      setActiveId(matchedInitialItemOnChange.id);
    }
  }, [initialSlug, items]);

  const activeItem = items.find((i) => i.id === activeId) ?? items[0];

  if (items.length === 0) return null;

  function handleSelect(id: string) {
    setActiveId(id);
    setActiveTab("overview");
  }

  const tabContent = (
    <TabContent
      tab={activeTab}
      itemId={activeItem?.id ?? ""}
      description={descriptions[activeItem?.id ?? ""] ?? null}
      variant={variant}
    />
  );

  return (
    <section dir="rtl" className="bg-[#f8fafc] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          {/* گردونه — sticky */}
          <div className="lg:sticky lg:top-28">
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
              <CircularSelector items={items} activeId={activeId} onSelect={handleSelect} />
              <p className="mt-5 text-center text-xs font-bold leading-7 text-slate-400">
                برای انتخاب، روی {variant === "unit" ? "واحد" : "دپارتمان"} مورد نظر کلیک کنید یا گردونه را بچرخانید.
              </p>
            </div>
          </div>

          {/* محتوا */}
          <div>
            <div className="mb-5 text-right">
              <p className="mb-1 text-sm font-black text-emerald-600">
                {variant === "unit" ? "واحد" : "دپارتمان"} انتخاب‌شده
              </p>
              <h2 className="text-2xl font-black leading-[1.5] text-[#062452] sm:text-3xl">
                {activeItem?.title}
              </h2>
            </div>

            <ScopedTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab}>
              {tabContent}
            </ScopedTabs>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- TabContent ----------
function TabContent({
  tab,
  itemId,
  description,
  variant,
}: {
  tab: string;
  itemId: string;
  description: string | null;
  variant: "unit" | "department";
}) {
  if (tab === "overview") return <OverviewTab description={description} variant={variant} />;
  if (tab === "news") return <ContentTab itemId={itemId} kind="news" emptyText="خبری برای این بخش ثبت نشده است." />;
  if (tab === "announcements") return <ContentTab itemId={itemId} kind="announcement" emptyText="اطلاعیه‌ای برای این بخش ثبت نشده است." />;
  return <GalleryTab itemId={itemId} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-right shadow-sm sm:p-7">
      {children}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
        ◌
      </div>
      <p className="text-sm font-bold leading-8 text-slate-500">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-36 items-center justify-center">
      <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
    </div>
  );
}

function OverviewTab({ description, variant }: { description: string | null; variant: "unit" | "department" }) {
  return (
    <Card>
      <h3 className="text-lg font-black text-[#062452]">
        {variant === "unit" ? "معرفی واحد" : "معرفی دپارتمان"}
      </h3>
      <p className="mt-4 text-sm font-bold leading-8 text-slate-600">
        {description ?? "توضیحات این بخش پس از ثبت توسط مدیریت نمایش داده می‌شود."}
      </p>
      <p className="mt-5 text-xs font-bold text-slate-400">
        برای مشاهده اخبار، اطلاعیه‌ها و گالری این {variant === "unit" ? "واحد" : "دپارتمان"}، از تب‌های بالا استفاده کنید.
      </p>
    </Card>
  );
}

// ---------- ContentTab با modal detail ----------
function ContentTab({
  itemId,
  kind,
  emptyText,
}: {
  itemId: string;
  kind: "news" | "announcement";
  emptyText: string;
}) {
  const [items, setItems] = useState<ContentRecord[] | null>(null);
  const [detail, setDetail] = useState<ContentRecord | null>(null);

  useEffect(() => {
    setItems(null);
    contentRepository.list().then((all) => {
      setItems(
        all.filter(
          (c) => c.kind === kind && c.status === "published" && c.unit_id === itemId,
        ),
      );
    });
  }, [itemId, kind]);

  if (items === null) return <Spinner />;
  if (items.length === 0) return <EmptyBox text={emptyText} />;

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDetail(item)}
            className="group w-full rounded-[2rem] border border-slate-200 bg-white p-5 text-right shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-6"
          >
            <div className="flex items-start gap-4">
              {item.cover_image ? (
                <img
                  src={item.cover_image}
                  alt={item.title}
                  className="hidden size-16 rounded-2xl object-cover sm:block"
                />
              ) : (
                <div className="hidden size-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700 sm:flex">
                  {kind === "news" ? "▦" : "▤"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-[#062452] group-hover:text-emerald-700 line-clamp-2">
                  {item.title}
                </h3>
                {item.summary ? (
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500 line-clamp-2">
                    {item.summary}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between">
                  {item.published_at ? (
                    <span className="text-xs font-bold text-slate-400">
                      {new Intl.DateTimeFormat("fa-IR").format(new Date(item.published_at))}
                    </span>
                  ) : null}
                  <span className="text-xs font-black text-emerald-600">مشاهده کامل ‹</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* modal detail */}
      <ContentDetailModal item={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function ContentDetailModal({
  item,
  onClose,
}: {
  item: ContentRecord | null;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (item) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      ref={overlayRef}
      dir="rtl"
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <article className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        {/* هدر */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 sm:p-8">
          <div className="min-w-0 flex-1 text-right">
            {item.category ? (
              <span className="mb-3 inline-block rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                {item.category}
              </span>
            ) : null}
            <h2 className="text-xl font-black leading-[1.6] text-[#062452] sm:text-2xl">{item.title}</h2>
            {item.published_at ? (
              <p className="mt-2 text-xs font-bold text-slate-400">
                {new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(item.published_at))}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
          </button>
        </div>

        {/* تصویر */}
        {item.cover_image ? (
          <div className="aspect-[16/7] overflow-hidden">
            <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover" />
          </div>
        ) : null}

        {/* محتوا */}
        <div className="p-6 sm:p-8">
          {item.summary ? (
            <p className="mb-5 text-base font-bold leading-8 text-slate-700">{item.summary}</p>
          ) : null}
          {item.body_html ? (
            <div
              className="besat-rich-content text-right"
              dangerouslySetInnerHTML={{ __html: item.body_html }}
            />
          ) : (
            <p className="text-sm font-bold leading-8 text-slate-500">متن کاملی برای این مورد ثبت نشده است.</p>
          )}
        </div>
      </article>
    </div>
  );
}

// ---------- GalleryTab ----------
function GalleryTab({ itemId }: { itemId: string }) {
  const [items, setItems] = useState<GalleryItemRecord[] | null>(null);
  const [lightbox, setLightbox] = useState<GalleryItemRecord | null>(null);

  useEffect(() => {
    setItems(null);
    galleryRepository.list().then((all) => {
      setItems(all.filter((g) => g.status === "published" && g.unit_id === itemId));
    });
  }, [itemId]);

  useEffect(() => {
    if (lightbox) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  if (items === null) return <Spinner />;
  if (items.length === 0) return <EmptyBox text="تصویری برای این بخش ثبت نشده است." />;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightbox(item)}
            className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100">
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-4 text-right">
              <p className="text-sm font-black text-[#062452]">{item.title}</p>
            </div>
          </button>
        ))}
      </div>

      {/* lightbox */}
      {lightbox ? (
        <div
          dir="rtl"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.image} alt={lightbox.title} className="max-h-[80vh] w-auto rounded-2xl object-contain" />
            <p className="mt-3 text-center text-sm font-black text-white">{lightbox.title}</p>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -left-3 flex size-9 items-center justify-center rounded-full bg-white text-sm font-black text-slate-700 shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
