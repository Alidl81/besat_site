"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Keep the URL in sync so filtered/paginated views stay shareable and
  // survive a refresh -- without re-navigating (no scroll jump).
  useEffect(() => {
    const query = searchParamsFromState(filters, page);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  useEffect(() => {
    getShopCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setLoading(true);
        setError(null);
        return getShopProducts({
          page,
          page_size: PAGE_SIZE,
          search: filters.search || undefined,
          type: filters.type || undefined,
          category: filters.category || undefined,
          price_min: filters.priceMin ? Number(filters.priceMin) * 10 : undefined,
          price_max: filters.priceMax ? Number(filters.priceMax) * 10 : undefined,
          ordering: filters.ordering || undefined,
        });
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
    };
  }, [filters, page, reloadToken]);

  const handleFiltersChange = useCallback((next: ShopFiltersState) => {
    setFilters(next);
    setPage(1);
  }, []);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  return (
    <div className="grid gap-6">
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
