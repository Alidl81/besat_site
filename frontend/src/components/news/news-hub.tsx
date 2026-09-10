"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CalendarDays, FilterX, Newspaper, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import { ensureScrollTriggerRegistered, prefersReducedMotion } from "@/lib/motion/gsap-scroll-trigger";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import {
  getPublicNews,
  getPublicNewsCategories,
  getPublicUnits,
} from "@/services/public-content-service";
import type {
  PublicCategory,
  PublicNewsItem,
  PublicSchoolUnit,
} from "@/types/public-content";

const PAGE_SIZE = 12;

function formatDate(value: string | null | undefined) {
  if (!value) return "تاریخ انتشار ثبت نشده";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "تاریخ انتشار ثبت نشده";

  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function NewsMeta({ item }: { item: PublicNewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="size-4" />
        {formatDate(item.published_at)}
      </span>
      {item.category ? <span>{item.category.title}</span> : null}
      {item.unit ? <span>{item.unit.title}</span> : null}
    </div>
  );
}

function NewsImage({ item }: { item: PublicNewsItem }) {
  const image = safePublicMediaUrl(item.cover_image ?? item.image);

  return image ? (
    <img
      src={image}
      alt=""
      loading="lazy"
      className="size-full object-cover"
    />
  ) : (
    <div className="flex size-full items-center justify-center bg-slate-100 text-slate-400">
      <Newspaper aria-hidden="true" className="size-10" />
    </div>
  );
}

type Filters = {
  search: string;
  categorySlug: string;
  unitId: string;
  page: number;
};

const initialFilters: Filters = { search: "", categorySlug: "", unitId: "", page: 1 };

// Reads from Next.js's own useSearchParams() rather than
// window.location.search directly -- the latter returns initialFilters on
// the server (no window) but the real URL-derived values on the client's
// first hydration pass, so any route with a non-default query string (e.g.
// ?search=...) rendered different JSX (the "حذف فیلترها" clear-filters
// button only appears when a filter is active) between the server HTML and
// the client's initial render, a hydration mismatch (React error #418).
// useSearchParams() is populated consistently by Next.js on both the
// server and the client, so this produces the same initial value both
// times (see FE-NEWS-ERROR-REACT-418-001).
function filtersFromSearchParams(params: URLSearchParams): Filters {
  return {
    search: params.get("search") ?? "",
    categorySlug: params.get("category") ?? "",
    unitId: params.get("unit") ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

function syncUrl(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.unitId) params.set("unit", filters.unitId);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  window.history.replaceState(null, "", query ? `/news?${query}` : "/news");
}

export function NewsHub() {
  const searchParams = useSearchParams();
  const filtersFromUrl = useMemo(() => filtersFromSearchParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<Filters>(filtersFromUrl);
  // FE-CATALOG-FILTER-URL-REHYDRATION-001: `filtersFromUrl` above only
  // seeds state once, at mount -- Next re-renders this same component
  // instance with a changed `searchParams` on browser back/forward
  // navigation, or when a link elsewhere on the site points at /news with
  // different query params, and nothing previously reacted to that. Unlike
  // ShopExplorer, syncUrl() below writes via raw `history.replaceState`
  // rather than the router, so it never feeds back into `useSearchParams()`
  // -- no echo to guard against here, every `searchParams` change this
  // effect observes is a genuine external navigation.
  const searchParamsKey = searchParams.toString();
  const appliedSearchParamsKeyRef = useRef<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [items, setItems] = useState<PublicNewsItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // FE-NEWS-FILTER-CLEAR-MIXED-001: clearing filters used to only call
  // setFilters(initialFilters) -- that resets `filters.search` immediately,
  // but the fetch effect below actually queries with `debouncedSearch`, a
  // separate state variable only caught up by the debounce effect 350ms
  // later. With a category/unit also active, resetting them changed a
  // *direct* dependency of the fetch effect, so it re-ran immediately using
  // the still-stale `debouncedSearch` -- producing a wrong empty-result
  // fetch, and syncUrl() (called from that same effect run) wrote the stale
  // search term straight back into the URL. Clearing now resets
  // `debouncedSearch` in the same commit, exactly matching the URL-
  // rehydration effect's own established atomic-reset pattern above.
  function clearFilters() {
    setFilters(initialFilters);
    setDebouncedSearch("");
  }

  useEffect(() => {
    if (appliedSearchParamsKeyRef.current === searchParamsKey) return;
    appliedSearchParamsKeyRef.current = searchParamsKey;
    const next = filtersFromSearchParams(searchParams);
    setFilters(next);
    // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001: batched into the same
    // commit as `setFilters` above (rather than left for the debounce
    // effect below to catch up 400ms later) so the fetch effect never
    // observes a half-rehydrated state -- an external URL change updating
    // both `search` and, say, `unit` used to land in two separate
    // commits: one with `unit` already updated but `debouncedSearch`
    // still stale (an immediate fetch with a mixed old-search/new-unit
    // tuple), then a second, correct fetch once the debounce caught up.
    setDebouncedSearch(next.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  useEffect(() => {
    // Nothing pending -- either settled already, or just rehydrated
    // atomically alongside `filters` by the rehydration effect above. The
    // page-reset-to-1 below is specifically a *typing* behavior (a new
    // search term should restart pagination); skipping it here also
    // avoids clobbering a page number rehydration just set from the URL
    // (e.g. `?search=new&page=5`) back to 1.
    if (filters.search === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
      setFilters((current) => (current.page === 1 ? current : { ...current, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search, debouncedSearch]);

  useEffect(() => {
    Promise.all([getPublicNewsCategories(), getPublicUnits()])
      .then(([categoryList, unitList]) => {
        setCategories(categoryList);
        setUnits(unitList);
      })
      .catch(() => {
        setCategories([]);
        setUnits([]);
      });
  }, []);

  useEffect(() => {
    // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001 (residual): `controller` was
    // already created and its cleanup already called `controller.abort()`,
    // but its `signal` was never actually passed to `getPublicNews()` --
    // aborting it only ever set `controller.signal.aborted`, which the
    // handlers below already checked to suppress a superseded response's
    // *result*. The underlying request itself still ran to completion,
    // wasting bandwidth/backend load on a response nobody would use (most
    // visibly on a rapid A -> B -> C filter/URL change). Passing the
    // signal through actually cancels the transport, not just its result.
    const controller = new AbortController();
    getPublicNews({
      page: filters.page,
      page_size: PAGE_SIZE,
      ordering: "-published_at",
      featured: "false",
      important: "false",
      search: debouncedSearch || undefined,
      category: filters.categorySlug || undefined,
      unit_id: filters.unitId || undefined,
    }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setError("");
        setItems(response.results);
        setCount(response.count);
        syncUrl({
          page: filters.page,
          categorySlug: filters.categorySlug,
          unitId: filters.unitId,
          search: debouncedSearch,
        });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(reason));
      });
    return () => controller.abort();
  }, [filters.page, filters.categorySlug, filters.unitId, debouncedSearch, requestVersion]);

  // Editorial sequencing: cards settle in from the reading direction (right,
  // in RTL) rather than Gallery's upward reveal -- the same batched-stagger
  // technique, given a distinct feel per section instead of one motion
  // vocabulary copy-pasted everywhere.
  useGSAP(
    () => {
      if (!items || items.length === 0) return;
      if (prefersReducedMotion()) return;

      ensureScrollTriggerRegistered();

      const cards = gridRef.current?.querySelectorAll(".news-card");
      if (!cards || cards.length === 0) return;

      gsap.set(cards, { opacity: 0, x: 24 });
      const triggers = ScrollTrigger.batch(cards, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            x: 0,
            duration: 0.55,
            stagger: 0.07,
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

  const hasActiveFilters = Boolean(filters.search || filters.categorySlug || filters.unitId);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="block text-right">
          <span className="mb-1.5 block text-xs font-black text-slate-500">جست‌وجو در عنوان و خلاصه</span>
          <span className="relative flex items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute right-3 size-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="مثلاً: جشنواره، مسابقه، اردو"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </span>
        </label>

        <label className="block text-right">
          <span className="mb-1.5 block text-xs font-black text-slate-500">دسته‌بندی</span>
          <select
            value={filters.categorySlug}
            onChange={(event) =>
              setFilters((current) => ({ ...current, categorySlug: event.target.value, page: 1 }))
            }
            className="h-11 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-500"
          >
            <option value="">همه دسته‌ها</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-right">
          <span className="mb-1.5 block text-xs font-black text-slate-500">واحد آموزشی</span>
          <select
            value={filters.unitId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, unitId: event.target.value, page: 1 }))
            }
            className="h-11 min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#0f2f4a] outline-none focus:border-blue-500"
          >
            <option value="">همه واحدها</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.title}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            <FilterX aria-hidden="true" className="size-4" />
            حذف فیلترها
          </button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center">
          <h2 className="text-xl font-black text-[#0f2f4a]">دریافت اخبار انجام نشد</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              setItems(null);
              setError("");
              setRequestVersion((value) => value + 1);
            }}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </button>
        </div>
      ) : items === null ? (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label="در حال دریافت اخبار"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <Newspaper aria-hidden="true" className="mx-auto size-10 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">
            {hasActiveFilters ? "با این فیلترها خبری پیدا نشد" : "خبر منتشرشده‌ای وجود ندارد"}
          </h2>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-5 text-sm font-black text-[#0f2f4a]"
            >
              حذف فیلترها
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-slate-500">
            {new Intl.NumberFormat("fa-IR").format(count)} خبر
          </p>
          <div ref={gridRef} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="news-card overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  <NewsImage item={item} />
                </div>
                <div className="p-5 text-right">
                  <NewsMeta item={item} />
                  <h2 className="mt-3 text-base font-black leading-8 text-[#0f2f4a]">
                    <Link href={`/news/${encodeURIComponent(item.slug)}`} className="hover:text-blue-700">
                      {item.title}
                    </Link>
                  </h2>
                  {item.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">
                      {item.summary}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav aria-label="صفحه‌بندی اخبار" className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-[#0f2f4a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-sm font-bold text-slate-500">
                صفحه {new Intl.NumberFormat("fa-IR").format(filters.page)} از{" "}
                {new Intl.NumberFormat("fa-IR").format(totalPages)}
              </span>
              <button
                type="button"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-[#0f2f4a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                بعدی
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
