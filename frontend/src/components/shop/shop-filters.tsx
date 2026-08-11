"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { ShopCategory } from "@/types/shop";

export type ShopFiltersState = {
  search: string;
  type: string;
  category: string;
  priceMin: string;
  priceMax: string;
  ordering: string;
};

export const DEFAULT_SHOP_FILTERS: ShopFiltersState = {
  search: "",
  type: "",
  category: "",
  priceMin: "",
  priceMax: "",
  ordering: "-published_at",
};

const TYPE_OPTIONS = [
  { value: "", label: "همه انواع" },
  { value: "physical", label: "کتاب و کالا" },
  { value: "online_course", label: "دوره آنلاین" },
  { value: "in_person_course", label: "دوره حضوری" },
];

const ORDERING_OPTIONS = [
  { value: "-published_at", label: "جدیدترین" },
  { value: "price_amount", label: "ارزان‌ترین" },
  { value: "-price_amount", label: "گران‌ترین" },
  { value: "title", label: "الفبا (الف تا ی)" },
];

type ShopFiltersProps = {
  value: ShopFiltersState;
  onChange: (next: ShopFiltersState) => void;
  categories: ShopCategory[];
};

export function ShopFilters({ value, onChange, categories }: ShopFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(value.search);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchInputId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setSearchDraft(value.search));
  }, [value.search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchDraft !== value.search) {
        onChange({ ...value, search: searchDraft });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const activeCount = [value.type, value.category, value.priceMin, value.priceMax].filter(Boolean).length;

  const body = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor={searchInputId} className="mb-1.5 block text-xs font-black text-[#0a2848]/70">
          جست‌وجو
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#0a2848]/40" />
          <input
            id={searchInputId}
            type="search"
            inputMode="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="عنوان کتاب یا دوره…"
            className="w-full rounded-xl border border-[#e5e7eb] bg-white py-2.5 pr-9 pl-3 text-sm font-bold text-[#0a2848] placeholder:text-[#0a2848]/35 focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="shop-filter-type" className="mb-1.5 block text-xs font-black text-[#0a2848]/70">
          نوع محصول
        </label>
        <select
          id="shop-filter-type"
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="shop-filter-category" className="mb-1.5 block text-xs font-black text-[#0a2848]/70">
          دسته‌بندی
        </label>
        <select
          id="shop-filter-category"
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value })}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
        >
          <option value="">همه دسته‌ها</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="shop-filter-ordering" className="mb-1.5 block text-xs font-black text-[#0a2848]/70">
          مرتب‌سازی
        </label>
        <select
          id="shop-filter-ordering"
          value={value.ordering}
          onChange={(event) => onChange({ ...value, ordering: event.target.value })}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
        >
          {ORDERING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 lg:col-span-2">
        <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">بازه قیمت (تومان)</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.priceMin}
            onChange={(event) => onChange({ ...value, priceMin: event.target.value })}
            placeholder="از"
            className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#0a2848] placeholder:text-[#0a2848]/35 focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
          <span className="text-[#0a2848]/40">—</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.priceMax}
            onChange={(event) => onChange({ ...value, priceMax: event.target.value })}
            placeholder="تا"
            className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-bold text-[#0a2848] placeholder:text-[#0a2848]/35 focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </div>
      </div>

      {activeCount > 0 ? (
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SHOP_FILTERS, search: value.search, ordering: value.ordering })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-sm font-black text-[#0a2848] transition hover:bg-[#f4f1ea]"
          >
            <X aria-hidden="true" className="size-4" />
            پاک کردن فیلترها
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className="hidden lg:block">{body}</div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-black text-[#0a2848]"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          فیلتر و مرتب‌سازی
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-[#c98c3d] text-[11px] font-black text-white">
              {activeCount}
            </span>
          ) : null}
        </button>

        {mobileOpen ? (
          <MobileFilterSheet onClose={() => setMobileOpen(false)}>{body}</MobileFilterSheet>
        ) : null}
      </div>
    </div>
  );
}

function MobileFilterSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, true, onClose);

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" tabIndex={-1} aria-label="بستن فیلترها" onClick={onClose} className="absolute inset-0 bg-[#04101f]/60 backdrop-blur-sm" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="فیلتر و مرتب‌سازی محصولات"
        dir="rtl"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black text-[#0a2848]">فیلتر و مرتب‌سازی</h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="flex size-9 items-center justify-center rounded-full bg-[#f4f1ea] text-[#0a2848]">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="besat-navy-button mt-5 flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-black"
        >
          نمایش نتایج
        </button>
      </div>
    </div>
  );
}
