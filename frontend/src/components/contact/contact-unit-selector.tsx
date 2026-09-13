"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useHorizontalCarouselGesture } from "@/hooks/use-horizontal-carousel-gesture";
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

const CONTACT_DETAILS_ID = "selected-unit-contact-details";
const CENTER_CARD_HEIGHT = 238;

type CarouselLayout = {
  centerWidth: number;
  circleSize: number;
  sideOffset: number;
};

const defaultLayout: CarouselLayout = {
  centerWidth: 204,
  circleSize: 60,
  sideOffset: 128,
};

function telHref(value: string) {
  const primaryNumber = value.split(/\(|\[|داخلی/i, 1)[0];
  const normalized = primaryNumber.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const phone = normalized.replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : undefined;
}

function unitDescriptor(unit: PublicSchoolUnit) {
  return unit.subtitle || unit.grade_range || `${kindLabels[unit.kind]} ${genderLabels[unit.gender]}`;
}

function unitSideDescriptor(unit: PublicSchoolUnit) {
  return kindLabels[unit.kind];
}

function hasContact(unit: PublicSchoolUnit) {
  return Boolean(unit.address || unit.phone || unit.phone_secondary || unit.email);
}

function modulo(value: number, length: number) {
  return ((value % length) + length) % length;
}

export type ContactUnitSelectorProps = {
  units: PublicSchoolUnit[] | null;
  error?: boolean;
  /** `undefined` preserves standalone component behavior; `null` means still checking. */
  registrationOpen?: boolean | null;
  registrationMessage?: string | null;
};

type PublicUnitVisibility = PublicSchoolUnit & { is_internal?: boolean };

export function ContactUnitSelector({
  units,
  error = false,
  registrationOpen,
  registrationMessage,
}: ContactUnitSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<CarouselLayout>(defaultLayout);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const visibleUnits = useMemo(
    () => (units ?? []).filter((unit) => !(unit as PublicUnitVisibility).is_internal),
    [units],
  );
  const selectedIndex = Math.max(0, visibleUnits.findIndex((unit) => String(unit.id) === selectedId));
  const selectedUnit = visibleUnits[selectedIndex] ?? null;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth || 328;
      const centerWidth = Math.min(270, Math.max(196, Math.round(width * 0.62)));
      const circleSize = Math.min(78, Math.max(58, Math.round(width * 0.18)));
      const sideOffset = Math.min(
        185,
        Math.max(112, Math.round((width - centerWidth) / 2 + circleSize + 8)),
      );
      setLayout({ centerWidth, circleSize, sideOffset });
    };

    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleUnits.length]);

  function selectIndex(index: number) {
    if (!visibleUnits.length) return;
    setSelectedId(String(visibleUnits[modulo(index, visibleUnits.length)].id));
  }

  function moveBy(offset: number) {
    selectIndex(selectedIndex + offset);
  }

  const { dragOffset, handlers: gestureHandlers } = useHorizontalCarouselGesture({
    onPrevious: () => moveBy(-1),
    onNext: () => moveBy(1),
  });
  const boundedDragOffset = Math.max(-layout.sideOffset * 0.72, Math.min(layout.sideOffset * 0.72, dragOffset));

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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

  function handleViewportClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("a,button")) return;

    const card = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-contact-unit-card]"))
      .filter((element) => element.dataset.contactUnitVisible === "true")
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
    const index = card ? Number(card.dataset.contactUnitIndex) : Number.NaN;
    if (Number.isInteger(index)) selectIndex(index);
  }

  function registrationState(unit: PublicSchoolUnit) {
    if (!unit.accepts_registration) return "closed" as const;
    if (registrationOpen === null) return "checking" as const;
    if (registrationOpen === false) return "closed" as const;
    return "available" as const;
  }

  function registrationStatusLabel(unit: PublicSchoolUnit, state: ReturnType<typeof registrationState>) {
    if (state === "checking") return "در حال بررسی وضعیت پیش‌ثبت‌نام…";
    if (!unit.accepts_registration) return "پیش‌ثبت‌نام این واحد بسته است";
    return registrationMessage || "پیش‌ثبت‌نام این واحد در حال حاضر بسته است";
  }

  return (
    <section aria-labelledby="unit-direct-contact-title" className="min-w-0 rounded-[1.5rem] border border-[#e0e4e6] bg-[#f8fafc] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-[0.12em] text-[#8a641f]">واحدهای آموزشی</p>
          <h2 id="unit-direct-contact-title" className="mt-2 text-xl font-black text-[#0f2f4a]">ارتباط مستقیم با واحدها</h2>
          <p className="mt-1 text-xs font-bold leading-6 text-slate-600">واحد موردنظر را انتخاب کنید.</p>
        </div>
        {visibleUnits.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1" dir="ltr">
            <button type="button" onClick={() => moveBy(-1)} aria-label="واحد قبلی" className="flex size-9 items-center justify-center rounded-xl border border-[#d8e0e6] bg-white text-[#0a2848] transition hover:border-[#d9aa62] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 motion-reduce:transition-none"><ChevronLeft aria-hidden="true" className="size-4" /></button>
            <button type="button" onClick={() => moveBy(1)} aria-label="واحد بعدی" className="flex size-9 items-center justify-center rounded-xl border border-[#d8e0e6] bg-white text-[#0a2848] transition hover:border-[#d9aa62] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 motion-reduce:transition-none"><ChevronRight aria-hidden="true" className="size-4" /></button>
          </div>
        ) : null}
      </div>

      {units === null ? (
        <div role="status" aria-label="در حال دریافت واحدها" className="mt-4 h-14 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
      ) : error ? (
        <p role="alert" className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-white px-4 py-4 text-xs font-bold leading-6 text-rose-700">دریافت اطلاعات تماس واحدها انجام نشد.</p>
      ) : visibleUnits.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-xs font-bold leading-6 text-slate-600">واحد عمومی برای نمایش ثبت نشده است.</p>
      ) : (
        <div
          ref={viewportRef}
          role="tablist"
          aria-label="انتخاب واحد آموزشی برای تماس مستقیم"
          aria-orientation="horizontal"
          dir="rtl"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={handleViewportClick}
          {...gestureHandlers}
          className="relative mt-4 h-[16.5rem] min-w-0 overflow-hidden rounded-2xl border border-[#e0e4e6] bg-white outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
        >
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between text-[0.62rem] font-black text-slate-500" dir="ltr" aria-hidden="true">
            <span>واحد قبلی</span>
            <span>واحد بعدی</span>
          </div>
          <div
            className="absolute inset-0"
            style={{ "--drag-offset": `${boundedDragOffset}px` } as CSSProperties}
          >
            {visibleUnits.map((unit, index) => {
              let relative = index - selectedIndex;
              if (relative > visibleUnits.length / 2) relative -= visibleUnits.length;
              if (relative < -visibleUnits.length / 2) relative += visibleUnits.length;
              const distance = Math.abs(relative);
              if (distance > 1) return null;

              const active = relative === 0;
              const title = getOfficialUnitShortTitle(unit);
              const sideLabel = relative < 0 ? "واحد قبلی" : "واحد بعدی";
              const state = registrationState(unit);
              const positionStyle: CSSProperties = {
                width: `${active ? layout.centerWidth : layout.circleSize}px`,
                height: `${active ? CENTER_CARD_HEIGHT : layout.circleSize}px`,
                transform: `translate(calc(-50% + ${relative * layout.sideOffset}px + var(--drag-offset, 0px)), -50%)`,
                opacity: 1,
                zIndex: active ? 3 : 2,
                pointerEvents: "auto",
              };

              return (
                <div
                  key={unit.id}
                  data-contact-unit-card
                  data-contact-unit-index={index}
                  data-contact-unit-visible="true"
                  data-carousel-position={relative}
                  className="absolute left-1/2 top-1/2 transition-[height,opacity,transform,width] duration-[520ms] ease-[cubic-bezier(.22,1,.36,1)] will-change-transform motion-reduce:transition-none"
                  style={positionStyle}
                >
                  {active ? (
                    <article className="flex h-full w-full flex-col rounded-2xl border border-[#c88d3c] bg-[#fff8ed] p-3 text-[#774a12] shadow-[0_12px_24px_rgba(201,140,61,0.18)]" dir="rtl">
                      <button
                        type="button"
                        role="tab"
                        aria-selected
                        aria-current="true"
                        aria-controls={CONTACT_DETAILS_ID}
                        aria-posinset={index + 1}
                        aria-setsize={visibleUnits.length}
                        tabIndex={0}
                        onClick={() => selectIndex(index)}
                        className="flex w-full shrink-0 flex-col items-start rounded-xl text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#e2ae5b]/35"
                      >
                        <span className="block w-full break-words text-sm font-black leading-6">{title}</span>
                        <span className="mt-0.5 block w-full break-words text-[0.68rem] font-bold text-slate-600">{unitDescriptor(unit)}</span>
                      </button>

                      <div id={CONTACT_DETAILS_ID} role="tabpanel" aria-label={`اطلاعات تماس ${title}`} className="mt-2 flex min-h-0 flex-1 flex-col text-[0.68rem] font-bold text-slate-600">
                        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                          {hasContact(unit) ? (
                            <div className="grid gap-1.5">
                              {unit.address ? <div className="flex items-start gap-1.5"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#b97827]" /><span className="break-words leading-5">{unit.address}</span></div> : null}
                              {unit.phone ? <a href={telHref(unit.phone)} dir="ltr" aria-label={`تماس با ${title}`} className="inline-flex items-center gap-1.5 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Phone aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.phone}</a> : null}
                              {unit.phone_secondary ? <a href={telHref(unit.phone_secondary)} dir="ltr" aria-label={`تماس دوم با ${title}`} className="inline-flex items-center gap-1.5 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Phone aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.phone_secondary}</a> : null}
                              {unit.email ? <a href={`mailto:${unit.email}`} dir="ltr" className="inline-flex items-center gap-1.5 break-all text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Mail aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.email}</a> : null}
                            </div>
                          ) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-2 py-2 text-[0.66rem] font-bold leading-5 text-slate-600">اطلاعات تماس این واحد هنوز ثبت نشده است.</p>}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <Link href={`/units?unit=${encodeURIComponent(unit.slug)}`} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-[#d9aa62] bg-white px-2 text-center text-[0.62rem] font-black text-[#0a2848] underline decoration-[#d9aa62] underline-offset-4 transition hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 motion-reduce:transition-none">
                            مشاهده واحد <ArrowLeft aria-hidden="true" className="size-3" />
                          </Link>
                          {state === "available" ? (
                            <Link href={`/registration?unit=${encodeURIComponent(unit.slug)}`} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg bg-[#0f2f4a] px-2 text-center text-[0.62rem] font-black text-white transition hover:bg-[#173f62] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/50 motion-reduce:transition-none">
                              پیش‌ثبت‌نام برای این واحد <ArrowLeft aria-hidden="true" className="size-3" />
                            </Link>
                          ) : (
                            <span role="status" className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-center text-[0.58rem] font-black leading-4 text-amber-900">
                              {state === "closed" ? <LockKeyhole aria-hidden="true" className="size-3 shrink-0" /> : null}
                              {registrationStatusLabel(unit, state)}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ) : (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={false}
                      aria-label={`${sideLabel}: ${title}`}
                      aria-controls={CONTACT_DETAILS_ID}
                      aria-posinset={index + 1}
                      aria-setsize={visibleUnits.length}
                      tabIndex={0}
                      onClick={() => selectIndex(index)}
                      dir="rtl"
                      className="flex h-full w-full flex-col items-center justify-center rounded-full border border-[#d6e0e7] bg-[#f8fafc] px-2 text-center text-[#0f2f4a] shadow-[0_10px_24px_rgba(15,35,57,0.11)] transition-[border-color,background-color,box-shadow,transform] duration-300 hover:scale-105 hover:border-[#d9aa62] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/50 motion-reduce:transition-none"
                    >
                      <span className="block max-w-full break-words text-[0.7rem] font-black leading-4">{title}</span>
                      <span className="mt-1 block max-w-full break-words text-[0.58rem] font-bold leading-4 text-slate-500">{unitSideDescriptor(unit)}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p aria-live="polite" className="sr-only">واحد فعال: {selectedUnit ? getOfficialUnitShortTitle(selectedUnit) : ""}</p>
        </div>
      )}
    </section>
  );
}
