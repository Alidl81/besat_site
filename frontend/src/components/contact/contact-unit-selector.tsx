"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MapPin, Phone } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";
import type { PublicSchoolUnit } from "@/types/public-content";

const kindLabels: Record<PublicSchoolUnit["kind"], string> = {
  preschool: "پیش‌دبستانی",
  elementary: "دبستان",
  middle_school: "متوسطه اول",
  high_school: "دبیرستان",
};

const genderLabels: Record<PublicSchoolUnit["gender"], string> = {
  boys: "پسرانه",
  girls: "دخترانه",
  mixed: "مختلط",
};

function telHref(value: string) {
  const primaryNumber = value.split(/\(|\[|داخلی/i, 1)[0];
  const normalized = primaryNumber.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const phone = normalized.replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : undefined;
}

function unitDescriptor(unit: PublicSchoolUnit) {
  return unit.subtitle || unit.grade_range || `${kindLabels[unit.kind]} ${genderLabels[unit.gender]}`;
}

function contactValue(unit: PublicSchoolUnit) {
  return Boolean(unit.address || unit.phone || unit.phone_secondary || unit.email);
}

export type ContactUnitSelectorProps = {
  units: PublicSchoolUnit[] | null;
  error?: boolean;
};

type PublicUnitVisibility = PublicSchoolUnit & {
  is_internal?: boolean;
};

export function ContactUnitSelector({ units, error = false }: ContactUnitSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const visibleUnits = useMemo(
    () => (units ?? []).filter((unit) => !(unit as PublicUnitVisibility).is_internal),
    [units],
  );
  const selectedIndex = Math.max(
    0,
    visibleUnits.findIndex((unit) => String(unit.id) === selectedId),
  );
  const selectedUnit = visibleUnits[selectedIndex] ?? null;

  function selectIndex(index: number) {
    if (!visibleUnits.length) return;
    const next = (index + visibleUnits.length) % visibleUnits.length;
    setSelectedId(String(visibleUnits[next].id));
  }

  function moveBy(offset: number) {
    selectIndex(selectedIndex + offset);
  }

  function handleSelectorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectIndex(visibleUnits.length - 1);
    }
  }

  function handleSelectorWheel(event: React.WheelEvent<HTMLDivElement>) {
    const element = scrollerRef.current;
    if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (element.scrollWidth <= element.clientWidth) return;
    element.scrollLeft += event.deltaY;
  }

  return (
    <section
      aria-labelledby="unit-direct-contact-title"
      className="min-w-0 rounded-[1.5rem] border border-[#e0e4e6] bg-[#f8fafc] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-[0.12em] text-[#8a641f]">واحدهای آموزشی</p>
          <h2 id="unit-direct-contact-title" className="mt-2 text-xl font-black text-[#0f2f4a]">
            ارتباط مستقیم با واحدها
          </h2>
          <p className="mt-1 text-xs font-bold leading-6 text-slate-600">واحد موردنظر را انتخاب کنید.</p>
        </div>
        {visibleUnits.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1" dir="ltr">
            <button
              type="button"
              onClick={() => moveBy(-1)}
              aria-label="واحد قبلی"
              className="flex size-9 items-center justify-center rounded-xl border border-[#d8e0e6] bg-white text-[#0a2848] transition hover:border-[#d9aa62] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => moveBy(1)}
              aria-label="واحد بعدی"
              className="flex size-9 items-center justify-center rounded-xl border border-[#d8e0e6] bg-white text-[#0a2848] transition hover:border-[#d9aa62] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>

      {units === null ? (
        <div role="status" aria-label="در حال دریافت واحدها" className="mt-4 h-14 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
      ) : error ? (
        <p role="alert" className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-white px-4 py-4 text-xs font-bold leading-6 text-rose-700">
          دریافت اطلاعات تماس واحدها انجام نشد.
        </p>
      ) : visibleUnits.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-xs font-bold leading-6 text-slate-600">
          واحد عمومی برای نمایش ثبت نشده است.
        </p>
      ) : (
        <>
          <div
            ref={scrollerRef}
            role="tablist"
            aria-label="انتخاب واحد آموزشی برای تماس مستقیم"
            dir="rtl"
            tabIndex={0}
            onKeyDown={handleSelectorKeyDown}
            onWheel={handleSelectorWheel}
            className="mt-4 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain rounded-2xl border border-[#e0e4e6] bg-white p-2 outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 [&::-webkit-scrollbar]:hidden"
          >
            {visibleUnits.map((unit, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={unit.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="selected-unit-contact-details"
                  tabIndex={0}
                  onClick={() => setSelectedId(String(unit.id))}
                  className={`w-[7.75rem] shrink-0 snap-center rounded-xl border px-3 py-2 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 ${
                    active
                      ? "border-[#c88d3c] bg-[#fff8ed] text-[#774a12] shadow-sm"
                      : "border-transparent bg-[#f8fafc] text-[#0f2f4a] hover:border-[#d9aa62]"
                  }`}
                >
                  <span className="block break-words text-sm font-black leading-6">{getOfficialUnitShortTitle(unit)}</span>
                  <span className="mt-0.5 block text-[0.68rem] font-bold text-slate-500">{genderLabels[unit.gender]}</span>
                </button>
              );
            })}
          </div>

          {selectedUnit ? (
            <div
              id="selected-unit-contact-details"
              role="tabpanel"
              className="mt-4 rounded-2xl border border-[#e0e4e6] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-black leading-7 text-[#0f2f4a]">{getOfficialUnitShortTitle(selectedUnit)}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{unitDescriptor(selectedUnit)}</p>
                </div>
                <Link
                  href={`/units/${encodeURIComponent(selectedUnit.slug)}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#0a2848] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
                >
                  مشاهده واحد
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                </Link>
              </div>

              {contactValue(selectedUnit) ? (
                <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600">
                  {selectedUnit.address ? (
                    <div className="flex items-start gap-2">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#b97827]" />
                      <span className="break-words">{selectedUnit.address}</span>
                    </div>
                  ) : null}
                  {selectedUnit.phone ? (
                    <a
                      href={telHref(selectedUnit.phone)}
                      dir="ltr"
                      aria-label={`تماس با ${getOfficialUnitShortTitle(selectedUnit)}`}
                      className="inline-flex items-center gap-2 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
                    >
                      <Phone aria-hidden="true" className="size-4 shrink-0 text-[#b97827]" />
                      {selectedUnit.phone}
                    </a>
                  ) : null}
                  {selectedUnit.phone_secondary ? (
                    <a
                      href={telHref(selectedUnit.phone_secondary)}
                      dir="ltr"
                      aria-label={`تماس دوم با ${getOfficialUnitShortTitle(selectedUnit)}`}
                      className="inline-flex items-center gap-2 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
                    >
                      <Phone aria-hidden="true" className="size-4 shrink-0 text-[#b97827]" />
                      {selectedUnit.phone_secondary}
                    </a>
                  ) : null}
                  {selectedUnit.email ? (
                    <a
                      href={`mailto:${selectedUnit.email}`}
                      dir="ltr"
                      className="inline-flex items-center gap-2 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
                    >
                      <Mail aria-hidden="true" className="size-4 shrink-0 text-[#b97827]" />
                      {selectedUnit.email}
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-[#f8fafc] px-3 py-3 text-xs font-bold leading-6 text-slate-600">
                  اطلاعات تماس این واحد هنوز ثبت نشده است.
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
