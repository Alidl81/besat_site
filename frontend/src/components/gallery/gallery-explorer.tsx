"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import {
  CalendarRange,
  FilterX,
  ImageIcon,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import { ensureScrollTriggerRegistered, prefersReducedMotion } from "@/lib/motion/gsap-scroll-trigger";
import { isExternalMediaUrl, safePublicMediaUrl } from "@/lib/media/safe-url";
import { GalleryLightbox, type LightboxItem } from "@/components/gallery/gallery-lightbox";
import {
  getPublicGallery,
  getPublicUnits,
} from "@/services/public-content-service";
import type {
  PublicGalleryItem,
  PublicSchoolUnit,
} from "@/types/public-content";

type GalleryFilters = {
  search: string;
  unitId: string;
  album: string;
  dateFrom: string;
  dateTo: string;
  page: number;
};

const initialFilters: GalleryFilters = {
  search: "",
  unitId: "",
  album: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
};

// PublicGalleryItem carries no intrinsic width/height, so every card uses
// one fixed aspect-ratio viewport (object-fit: cover) instead of sizing
// itself off the source image. Combined with a real CSS grid (not
// masonry columns), this keeps cards in the same row equal height instead
// of producing an uneven, randomly-sized-looking layout.
const CARD_ASPECT_CLASS = "aspect-[4/3]";

export function buildGalleryQuery(
  filters: GalleryFilters,
  debouncedSearch: string,
) {
  const query: Record<string, string | number> = {
    page: filters.page,
    page_size: 12,
    ordering: "-event_date",
  };
  if (debouncedSearch) query.search = debouncedSearch;
  if (filters.unitId) query.unit_id = filters.unitId;
  if (filters.album) query.album = filters.album;
  if (filters.dateFrom) query.date_from = filters.dateFrom;
  if (filters.dateTo) query.date_to = filters.dateTo;
  return query;
}

function readInitialFilters(): GalleryFilters {
  if (typeof window === "undefined") return initialFilters;
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search") ?? "",
    unitId: params.get("unit") ?? "",
    album: params.get("album") ?? "",
    dateFrom: params.get("date_from") ?? "",
    dateTo: params.get("date_to") ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

function syncUrl(filters: GalleryFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.unitId) params.set("unit", filters.unitId);
  if (filters.album) params.set("album", filters.album);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  window.history.replaceState(null, "", query ? `/gallery?${query}` : "/gallery");
}

function GalleryCard({
  item,
  onOpen,
}: {
  item: PublicGalleryItem;
  onOpen: () => void;
}) {
  const image = safePublicMediaUrl(item.image);
  const external = isExternalMediaUrl(item.image);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="gallery-card group flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-right shadow-sm transition hover:shadow-md"
    >
      <div className={`relative ${CARD_ASPECT_CLASS} shrink-0 overflow-hidden bg-slate-100`}>
        {image ? (
          <Image
            src={image}
            alt={item.alt_text || item.title}
            fill
            unoptimized={external}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-slate-400">
            <ImageIcon aria-hidden="true" className="size-10" />
          </div>
        )}
        {item.is_featured ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#e2ae5b] px-2.5 py-1 text-[10px] font-black text-[#062452] shadow">ویژه</span>
        ) : null}
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,24,45,0)_55%,rgba(6,24,45,.75))] opacity-0 transition duration-300 group-hover:opacity-100" />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          {item.unit ? <span>{item.unit.title}</span> : <span>مجتمع بعثت</span>}
          {item.album ? <span>• {item.album}</span> : null}
          {item.event_date ? (
            <time dateTime={item.event_date}>
              •{" "}
              {new Intl.DateTimeFormat("fa-IR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date(item.event_date))}
            </time>
          ) : null}
        </div>
        <h2 className="mt-3 line-clamp-2 text-base font-black leading-7 text-[#0f2f4a]">
          {item.title}
        </h2>
        {item.caption || item.summary ? (
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">
            {item.caption || item.summary}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function GalleryExplorer() {
  const [filters, setFilters] = useState<GalleryFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<PublicGalleryItem[] | null>(null);
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // FE-GALLERY-DEEPLINK-PAGE-001: the search-debounce effect below is keyed
  // on filters.search, so it also re-fires when the URL-hydration effect
  // sets the initial search value on mount -- indistinguishable, from its
  // own perspective, from the user actually typing. Its settle callback
  // unconditionally reset filters.page to 1, silently discarding a
  // deep-linked ?page=3 the moment hydration's own debounce timer settled.
  // This ref lets that callback tell "the debounce settling for the first
  // time after mount (hydration, or simply the timer that was already
  // running before the user could have typed anything)" apart from "an
  // actual subsequent user edit" -- only the latter should reset the page.
  const skipNextSearchResetRef = useRef(true);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      const values = readInitialFilters();
      setFilters(values);
      setDebouncedSearch(values.search);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
      if (skipNextSearchResetRef.current) {
        skipNextSearchResetRef.current = false;
        return;
      }
      setFilters((current) =>
        current.page === 1 ? current : { ...current, page: 1 },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    getPublicUnits().then(setUnits).catch(() => setUnits([]));
    getPublicGallery({ page_size: 100 })
      .then((response) => {
        setAlbums(
          Array.from(
            new Set(
              response.results
                .map((item) => item.album?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          ).sort((a, b) => a.localeCompare(b, "fa")),
        );
      })
      .catch(() => setAlbums([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestFilters: GalleryFilters = {
      search: debouncedSearch,
      unitId: filters.unitId,
      album: filters.album,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
    };
    const query = buildGalleryQuery(requestFilters, debouncedSearch);

    getPublicGallery(query)
      .then((response) => {
        if (cancelled) return;
        setError("");
        setItems(response.results);
        setCount(response.count);
        setNext(response.next);
        setPrevious(response.previous);
        syncUrl(requestFilters);
      })
      .catch((reason) => {
        if (!cancelled) setError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    filters.album,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
    filters.unitId,
    requestVersion,
  ]);

  // The one signature interaction: as cards enter the viewport, reveal them
  // in scroll-batched staggered groups (not a per-item fade-spam). Skipped
  // entirely under prefers-reduced-motion -- cards just render at their
  // final, fully visible state with no JS-driven motion.
  useGSAP(
    () => {
      if (!items || items.length === 0) return;
      if (prefersReducedMotion()) return;

      ensureScrollTriggerRegistered();

      const cards = gridRef.current?.querySelectorAll(".gallery-card");
      if (!cards || cards.length === 0) return;

      gsap.set(cards, { opacity: 0, y: 28 });
      const triggers = ScrollTrigger.batch(cards, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power2.out",
            overwrite: true,
          }),
      });

      return () => {
        triggers.forEach((trigger) => trigger.kill());
      };
    },
    { scope: gridRef, dependencies: [items], revertOnUpdate: true },
  );

  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.unitId ||
          filters.album ||
          filters.dateFrom ||
          filters.dateTo,
      ),
    [filters],
  );

  function updateFilter<Key extends keyof GalleryFilters>(
    key: Key,
    value: GalleryFilters[Key],
  ) {
    setItems(null);
    setError("");
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function clearFilters() {
    setItems(null);
    setError("");
    setFilters(initialFilters);
    setDebouncedSearch("");
  }

  const lightboxItems: LightboxItem[] = (items ?? []).map((item) => ({
    id: item.id,
    src: safePublicMediaUrl(item.image) ?? "",
    title: item.title,
    caption: item.caption ?? item.summary,
  }));

  return (
    <div className="space-y-7">
      <section aria-label="فیلترهای گالری" className="border-y border-slate-200 bg-white py-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block xl:col-span-2">
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">جست‌وجو</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3.5 right-4 size-5 text-slate-400"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="عنوان، توضیح یا نام واحد"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white pr-12 pl-4 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">واحد آموزشی</span>
            <select
              value={filters.unitId}
              onChange={(event) => updateFilter("unitId", event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">همه واحدها</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">آلبوم</span>
            <select
              value={filters.album}
              onChange={(event) => updateFilter("album", event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">همه آلبوم‌ها</option>
              {albums.map((album) => (
                <option key={album} value={album}>
                  {album}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-[#0f2f4a] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FilterX aria-hidden="true" className="size-5" />
              پاک‌کردن فیلترها
            </button>
          </div>
        </div>

        <fieldset className="mt-4 grid gap-4 border-0 p-0 md:grid-cols-2">
          <legend className="mb-2 flex items-center gap-2 text-sm font-black text-[#0f2f4a]">
            <CalendarRange aria-hidden="true" className="size-5" />
            بازه تاریخ رویداد
          </legend>
          <label>
            <span className="sr-only">از تاریخ</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              dir="ltr"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label>
            <span className="sr-only">تا تاریخ</span>
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              dir="ltr"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </fieldset>
      </section>

      <p role="status" aria-live="polite" className="text-sm font-black text-slate-600">
        {new Intl.NumberFormat("fa-IR").format(count)} نتیجه
      </p>

      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center">
          <h2 className="text-xl font-black text-[#0f2f4a]">دریافت گالری انجام نشد</h2>
          <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => setRequestVersion((value) => value + 1)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </button>
        </div>
      ) : items === null ? (
        <div role="status" aria-busy="true" aria-live="polite" aria-label="در حال دریافت گالری" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={`${CARD_ASPECT_CLASS} animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none`} />
          ))}
        </div>
      ) : items.length ? (
        <>
          <div ref={gridRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <GalleryCard key={item.id} item={item} onOpen={() => setLightboxIndex(index)} />
            ))}
          </div>
          <nav aria-label="صفحه‌بندی گالری" className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={!previous}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-[#0f2f4a] disabled:opacity-45"
            >
              صفحه قبل
            </button>
            <span className="text-sm font-black text-slate-600">
              صفحه {new Intl.NumberFormat("fa-IR").format(filters.page)}
            </span>
            <button
              type="button"
              disabled={!next}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-[#0f2f4a] disabled:opacity-45"
            >
              صفحه بعد
            </button>
          </nav>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <ImageIcon aria-hidden="true" className="mx-auto size-10 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">
            نتیجه‌ای با این فیلترها پیدا نشد
          </h2>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 min-h-11 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"
            >
              نمایش همه تصاویر
            </button>
          ) : null}
        </div>
      )}

      {lightboxIndex !== null ? (
        <GalleryLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}
