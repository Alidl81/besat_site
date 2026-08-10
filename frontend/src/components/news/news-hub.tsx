"use client";

import Link from "next/link";
import { CalendarDays, FilterX, Newspaper, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
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

function readInitialFilters(): Filters {
  if (typeof window === "undefined") return initialFilters;
  const params = new URLSearchParams(window.location.search);
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
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [items, setItems] = useState<PublicNewsItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
      setFilters((current) => (current.page === 1 ? current : { ...current, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

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
    })
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
            onClick={() => setFilters(initialFilters)}
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
              onClick={() => setFilters(initialFilters)}
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  <NewsImage item={item} />
                </div>
                <div className="p-5 text-right">
                  <NewsMeta item={item} />
                  <h3 className="mt-3 text-base font-black leading-8 text-[#0f2f4a]">
                    <Link href={`/news/${encodeURIComponent(item.slug)}`} className="hover:text-blue-700">
                      {item.title}
                    </Link>
                  </h3>
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
