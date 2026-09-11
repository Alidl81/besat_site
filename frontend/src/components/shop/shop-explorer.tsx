"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getShopCategories, getShopProducts } from "@/services/shop-service";
import type { ProductListItem, ShopCategory } from "@/types/shop";
import { ProductCard } from "./product-card";
import { Pagination } from "./pagination";
import { DEFAULT_SHOP_FILTERS, ShopFilters, type ShopFiltersState } from "./shop-filters";
import { ProductGridSkeleton } from "./skeletons";
import { ShopEmptyState, ShopErrorState } from "./shop-states";

const PAGE_SIZE = 12;

function filtersFromSearchParams(params: URLSearchParams): { filters: ShopFiltersState; page: number } {
  return {
    filters: {
      search: params.get("q") ?? DEFAULT_SHOP_FILTERS.search,
      type: params.get("type") ?? DEFAULT_SHOP_FILTERS.type,
      category: params.get("category") ?? DEFAULT_SHOP_FILTERS.category,
      priceMin: params.get("price_min") ?? DEFAULT_SHOP_FILTERS.priceMin,
      priceMax: params.get("price_max") ?? DEFAULT_SHOP_FILTERS.priceMax,
      ordering: params.get("ordering") ?? DEFAULT_SHOP_FILTERS.ordering,
    },
    page: Number(params.get("page") ?? "1") || 1,
  };
}

function searchParamsFromState(filters: ShopFiltersState, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.priceMin) params.set("price_min", filters.priceMin);
  if (filters.priceMax) params.set("price_max", filters.priceMax);
  if (filters.ordering && filters.ordering !== DEFAULT_SHOP_FILTERS.ordering) {
    params.set("ordering", filters.ordering);
  }
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export function ShopExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => filtersFromSearchParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<ShopFiltersState>(initial.filters);
  const [page, setPage] = useState(initial.page);
  // FE-CATALOG-FILTER-URL-REHYDRATION-001: `initial` above only seeds
  // state once, at mount -- Next re-renders this same component instance
  // with a changed `searchParams` on browser back/forward navigation, or
  // when a link elsewhere on the site points at this route with different
  // query params, and nothing previously reacted to that: `filters`/`page`
  // kept whatever they were initialized to, silently ignoring the new URL.
  // lastWrittenQueryRef distinguishes an external URL change (rehydrate
  // state from it, below) from the echo of this component's own
  // router.replace() call (skip, since state already matches what was
  // just written).
  const lastWrittenQueryRef = useRef<string | null>(null);
  const searchParamsKey = searchParams.toString();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Only the free-text search field is debounced -- typing updates
  // `filters.search` (and the input) immediately, but the URL write and
  // the actual fetch below both wait for `debouncedSearch` to settle, so
  // there's one request per pause in typing rather than one per
  // keystroke. Every other filter (type/category/price/ordering) applies
  // immediately, unchanged.
  //
  // Both effects below depend on the individual primitive fields of
  // `filters`, not on `filters` itself: an object built fresh each render
  // (e.g. `{...filters, search: debouncedSearch}`) gets a new identity on
  // *every* keystroke, since `filters` itself changes on every keystroke
  // even though `debouncedSearch` hasn't settled yet -- an effect
  // dependent on that object reference re-fires every keystroke, not
  // once after the debounce, defeating the debounce entirely (this
  // shipped once already, see FE-SHOP-FILTER-003). Primitive dependencies
  // (strings) are compared by value, so this can't happen.
  //
  // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001: `debouncedSearch` used to
  // come from the shared `useDebouncedValue()` hook, whose internal state
  // is opaque to this component -- the rehydration effect below could only
  // update `filters.search` immediately, leaving `debouncedSearch` to
  // catch up 400ms later via the hook's OWN separate effect. That meant an
  // external URL change updating both `search` and, say, `type` landed in
  // two separate commits: one where `type` had already changed but
  // `debouncedSearch` was still stale (firing an immediate fetch with a
  // mixed old-search/new-type tuple), and a second 400ms later once
  // `debouncedSearch` finally caught up (firing a second, correct fetch).
  // Managing `debouncedSearch` as local state here (instead of through the
  // opaque hook) lets the rehydration effect set it in the very same
  // batched update as `filters`/`page`, landing in a single commit with no
  // intermediate mixed-tuple fetch.
  const [debouncedSearch, setDebouncedSearch] = useState(initial.filters.search);
  const { type, category, priceMin, priceMax, ordering } = filters;

  useEffect(() => {
    // Nothing pending -- either settled already, or just rehydrated
    // atomically alongside `filters` by the rehydration effect below.
    if (filters.search === debouncedSearch) return;
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => window.clearTimeout(timer);
  }, [filters.search, debouncedSearch]);

  // Keep the URL in sync so filtered/paginated views stay shareable and
  // survive a refresh -- without re-navigating (no scroll jump).
  useEffect(() => {
    const query = searchParamsFromState(
      { search: debouncedSearch, type, category, priceMin, priceMax, ordering },
      page,
    );
    lastWrittenQueryRef.current = query;
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, type, category, priceMin, priceMax, ordering, page]);

  useEffect(() => {
    if (lastWrittenQueryRef.current === searchParamsKey) return;
    const next = filtersFromSearchParams(searchParams);
    setFilters(next.filters);
    // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001: set alongside `filters` in
    // this same effect call (batched into one commit) so the fetch effect
    // never observes a half-rehydrated state -- see the comment on
    // `debouncedSearch`'s declaration above.
    setDebouncedSearch(next.filters.search);
    setPage(next.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  useEffect(() => {
    getShopCategories()
      .then((items) => {
        setCategories(items);
        setCategoriesError(false);
      })
      .catch(() => {
        setCategories([]);
        setCategoriesError(true);
      })
      .finally(() => setCategoriesLoaded(true));
  }, []);

  useEffect(() => {
    let active = true;
    // FE-CATALOG-FILTER-URL-MIXED-REQUEST-001 (residual): `active` already
    // prevented a superseded request's result from ever reaching state --
    // but the request itself still ran to completion, wasting bandwidth
    // and backend load on a response nobody would use (most visibly on a
    // rapid A -> B -> C filter/URL change, where the "B" request was
    // never going to matter the moment "C" started). Aborting the
    // previous controller in this effect's cleanup actually cancels that
    // superseded request's transport, not just its eventual result.
    const controller = new AbortController();

    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setLoading(true);
        setError(null);
        return getShopProducts({
          page,
          page_size: PAGE_SIZE,
          search: debouncedSearch || undefined,
          type: type || undefined,
          category: category || undefined,
          price_min: priceMin ? Number(priceMin) * 10 : undefined,
          price_max: priceMax ? Number(priceMax) * 10 : undefined,
          ordering: ordering || undefined,
        }, controller.signal);
      })
      .then((response) => {
        if (!active || !response) return;
        setProducts(response.results);
        setCount(response.count);
      })
      .catch(() => {
        if (active) setError("محصولات فروشگاه در دسترس نیست.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedSearch, type, category, priceMin, priceMax, ordering, page, reloadToken]);

  const handleFiltersChange = useCallback((next: ShopFiltersState) => {
    setFilters(next);
    setPage(1);
  }, []);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  return (
    <div className="grid gap-6">
      {categoriesLoaded && categoriesError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-7 text-amber-800">
          دسته‌بندی‌های فروشگاه فعلاً در دسترس نیست؛ می‌توانید از جست‌وجو و فیلتر نوع محصول استفاده کنید.
        </div>
      ) : null}
      {categoriesLoaded && !categoriesError && categories.length === 0 ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-600">
          دسته‌بندی‌های فروشگاه هنوز برای نمایش عمومی ثبت نشده است.
        </p>
      ) : null}
      <ShopFilters value={filters} onChange={handleFiltersChange} categories={categories} />

      <div aria-live="polite" className="sr-only">
        {!loading && products ? `${new Intl.NumberFormat("fa-IR").format(count)} محصول یافت شد` : null}
      </div>

      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <ShopErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : !products || products.length === 0 ? (
        <ShopEmptyState />
      ) : (
        <>
          <h2 className="sr-only">همه محصولات</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </div>
  );
}
