"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
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
  const normalized = primaryNumber.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const phone = normalized.replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : undefined;
}

function unitDescriptor(unit: PublicSchoolUnit) {
  return unit.subtitle || unit.grade_range || `${kindLabels[unit.kind]} ${genderLabels[unit.gender]}`;
}

function hasContact(unit: PublicSchoolUnit) {
  return Boolean(unit.address || unit.phone || unit.phone_secondary || unit.email);
}

export type ContactUnitSelectorProps = {
  units: PublicSchoolUnit[] | null;
  error?: boolean;
};

type PublicUnitVisibility = PublicSchoolUnit & { is_internal?: boolean };

export function ContactUnitSelector({ units, error = false }: ContactUnitSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [step, setStep] = useState(148);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ id: number; startX: number; lastX: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const visibleUnits = useMemo(
    () => (units ?? []).filter((unit) => !(unit as PublicUnitVisibility).is_internal),
    [units],
  );
  const selectedIndex = Math.max(0, visibleUnits.findIndex((unit) => String(unit.id) === selectedId));

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setStep(Math.max(174, Math.min(236, element.clientWidth * 0.66)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleUnits.length]);

  function selectIndex(index: number) {
    if (!visibleUnits.length) return;
    const next = (index + visibleUnits.length) % visibleUnits.length;
    setSelectedId(String(visibleUnits[next].id));
    setDragOffset(0);
  }

  function moveBy(offset: number) {
    selectIndex(selectedIndex + offset);
  }

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

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerRef.current = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const offset = event.clientX - pointer.startX;
    if (Math.abs(offset) > 8) pointer.moved = true;
    if (!pointer.moved) return;
    event.preventDefault();
    pointer.lastX = event.clientX;
    setDragOffset(Math.max(-step * 0.62, Math.min(step * 0.62, offset)));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const offset = event.clientX - pointer.startX;
    if (pointer.moved) {
      suppressClickRef.current = true;
      if (Math.abs(offset) > step * 0.24) moveBy(offset < 0 ? 1 : -1);
      else setDragOffset(0);
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
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
        <>
          <div
            ref={viewportRef}
            role="tablist"
            aria-label="انتخاب واحد آموزشی برای تماس مستقیم"
            dir="ltr"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative mt-4 h-[14.2rem] min-w-0 overflow-hidden rounded-2xl border border-[#e0e4e6] bg-white outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
          >
            <div
              className="absolute inset-0"
              style={{ "--drag-offset": `${dragOffset}px` } as CSSProperties}
            >
              {visibleUnits.map((unit, index) => {
                let relative = index - selectedIndex;
                if (relative > visibleUnits.length / 2) relative -= visibleUnits.length;
                if (relative < -visibleUnits.length / 2) relative += visibleUnits.length;
                const active = relative === 0;
                const distance = Math.abs(relative);
                const title = getOfficialUnitShortTitle(unit);
                const width = Math.max(184, Math.min(250, step - 4));
                const positionStyle = {
                  width: `${width}px`,
                  transform: `translate(calc(-50% + ${relative * step}px + var(--drag-offset, 0px)), -50%) scale(${active ? 1 : distance === 1 ? 0.88 : 0.74})`,
                  opacity: active ? 1 : distance === 1 ? 0.7 : 0.22,
                  zIndex: active ? 3 : 2 - Math.min(distance, 2),
                };

                if (!active) {
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      role="tab"
                      aria-selected={false}
                      aria-controls="selected-unit-contact-details"
                      tabIndex={-1}
                      onClick={() => { if (!suppressClickRef.current) selectIndex(index); }}
                      dir="rtl"
                      className="absolute left-1/2 top-1/2 flex h-[5.9rem] flex-col justify-center rounded-2xl border border-[#e0e4e6] bg-[#f8fafc] px-3 text-right text-[#0f2f4a] transition-[opacity,transform,box-shadow,background-color] duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35 motion-reduce:transition-none"
                      style={positionStyle}
                    >
                      <span className="block break-words text-sm font-black leading-6">{title}</span>
                      <span className="mt-1 block break-words text-[0.68rem] font-bold text-slate-500">{unitDescriptor(unit)}</span>
                    </button>
                  );
                }

                return (
                  <article
                    key={unit.id}
                    className="absolute left-1/2 top-1/2 flex h-[13.2rem] flex-col rounded-2xl border border-[#c88d3c] bg-[#fff8ed] text-[#774a12] shadow-[0_12px_24px_rgba(201,140,61,0.18)] transition-[opacity,transform,box-shadow,background-color] duration-300 motion-reduce:transition-none"
                    style={positionStyle}
                    dir="rtl"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected
                      aria-controls="selected-unit-contact-details"
                      tabIndex={0}
                      onClick={() => { if (!suppressClickRef.current) selectIndex(index); }}
                      className="flex w-full shrink-0 flex-col items-start rounded-t-2xl px-3 pt-3 text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#e2ae5b]/35"
                    >
                      <span className="block w-full break-words text-sm font-black leading-6">{title}</span>
                      <span className="mt-0.5 block w-full break-words text-[0.68rem] font-bold text-slate-600">{unitDescriptor(unit)}</span>
                    </button>

                    <div id="selected-unit-contact-details" role="tabpanel" className="mt-2 flex min-h-0 flex-1 flex-col px-3 pb-3 text-[0.68rem] font-bold text-slate-600">
                      {hasContact(unit) ? (
                        <div className="grid min-h-0 gap-1.5 overflow-y-auto pr-0.5">
                          {unit.address ? <div className="flex items-start gap-1.5"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#b97827]" /><span className="break-words leading-5">{unit.address}</span></div> : null}
                          {unit.phone ? <a href={telHref(unit.phone)} dir="ltr" aria-label={`تماس با ${title}`} className="inline-flex items-center gap-1.5 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Phone aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.phone}</a> : null}
                          {unit.phone_secondary ? <a href={telHref(unit.phone_secondary)} dir="ltr" aria-label={`تماس دوم با ${title}`} className="inline-flex items-center gap-1.5 text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Phone aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.phone_secondary}</a> : null}
                          {unit.email ? <a href={`mailto:${unit.email}`} dir="ltr" className="inline-flex items-center gap-1.5 break-all text-left font-black text-[#0f2f4a] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"><Mail aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />{unit.email}</a> : null}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-2 py-2 text-[0.66rem] font-bold leading-5 text-slate-600">اطلاعات تماس این واحد هنوز ثبت نشده است.</p>}
                      <Link href={`/units?unit=${encodeURIComponent(unit.slug)}`} className="mt-auto inline-flex min-h-7 items-center gap-1 self-start pt-1 text-[0.68rem] font-black text-[#0a2848] underline decoration-[#d9aa62] underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35">
                        مشاهده واحد <ArrowLeft aria-hidden="true" className="size-3" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
