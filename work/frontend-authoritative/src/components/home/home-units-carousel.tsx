"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicSchoolUnit } from "@/types/public-content";

import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";
type HomeUnitsCarouselProps = {
  units: PublicSchoolUnit[];
};

const autoPlayDelay = 3600;

const genderLabels: Record<string, string> = {
  boys: "پسرانه",
  girls: "دخترانه",
  mixed: "مختلط",
};

const kindLabels: Record<string, string> = {
  preschool: "پیش‌دبستانی",
  elementary: "دبستان",
  middle_school: "متوسطه اول",
  high_school: "دبیرستان",
};

export function HomeUnitsCarousel({ units }: HomeUnitsCarouselProps) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const total = units.length;

  function goTo(index: number) {
    if (total === 0) return;
    const next = ((index % total) + total) % total;
    setActive(next);
  }

  function next() {
    goTo(active + 1);
  }

  function prev() {
    goTo(active - 1);
  }

  // ناوبری با کیبورد
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total]);

  useEffect(() => {
    if (isPaused || total < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % total);
    }, autoPlayDelay);
    return () => window.clearInterval(timer);
  }, [isPaused, total]);

  function onDragStart(clientX: number) {
    dragStartX.current = clientX;
  }

  function onDragEnd(clientX: number) {
    if (dragStartX.current === null) return;
    const delta = clientX - dragStartX.current;
    const threshold = 50;
    if (delta > threshold) {
      // کشیدن به راست → قبلی (در RTL)
      prev();
    } else if (delta < -threshold) {
      next();
    }
    dragStartX.current = null;
  }

  if (total === 0) return null;

  // محاسبه موقعیت هر کارت نسبت به فعال
  function relativePosition(index: number): number {
    let diff = index - active;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  }

  return (
    <section dir="rtl" className="besat-carousel-enter overflow-hidden bg-white px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto w-full max-w-[1400px]">
        {/* عنوان */}
        <div className="mb-7 flex flex-col gap-3 text-right sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-3 text-sm font-black text-[#c98c3d]">
              <span className="h-px w-8 bg-[#c98c3d]" />
              مدارس مجموعه آموزشی فرهنگی بعثت
            </p>
            <h2 className="text-3xl font-black leading-[1.5] text-[#0a2848] sm:text-4xl">
            واحدهای آموزشی بعثت
            </h2>
          </div>
          <Link href="/units" className="inline-flex items-center gap-2 text-xs font-black text-[#0a2848] transition hover:text-[#c98c3d]">
            مشاهده همه واحدها
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        {/* کاروسل coverflow */}
        <div
          className="relative flex h-[27rem] items-center justify-center select-none sm:h-[31rem]"
          style={{ perspective: "1600px", transformStyle: "preserve-3d" }}
          onMouseDown={(e) => onDragStart(e.clientX)}
          onMouseUp={(e) => onDragEnd(e.clientX)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
          onTouchEnd={(e) => onDragEnd(e.changedTouches[0].clientX)}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={(e) => {
            setIsPaused(false);
            onDragEnd(e.clientX);
          }}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={() => setIsPaused(false)}
        >
          {units.map((unit, index) => {
            const pos = relativePosition(index);
            const isActive = pos === 0;
            const isVisible = Math.abs(pos) <= 2;

            // فاصله افقی، مقیاس، چرخش و شفافیت بر اساس فاصله از مرکز
            const translateX = pos * 58; // درصد
            const scale = isActive ? 1 : Math.max(0.72, 1 - Math.abs(pos) * 0.16);
            const rotateY = pos * -18;
            const opacity = isVisible ? (isActive ? 1 : Math.max(0.5, 0.76 - Math.abs(pos) * 0.12)) : 0;
            const zIndex = 20 - Math.abs(pos);
            const blur = isActive ? 0 : Math.min(Math.abs(pos) * 0.55, 1.1);

            return (
              <div
                key={unit.id}
                data-carousel-position={pos}
                className="absolute will-change-transform transition-[transform,opacity,filter] duration-[680ms] ease-[cubic-bezier(.22,1,.36,1)]"
                style={{
                  transform: `translateX(${translateX}%) scale(${scale}) rotateY(${rotateY}deg)`,
                  opacity,
                  zIndex,
                  filter: `blur(${blur}px)`,
                  pointerEvents: isVisible ? "auto" : "none",
                }}
              >
                <UnitCard
                  unit={unit}
                  isActive={isActive}
                  onClick={() => (isActive ? null : goTo(index))}
                />
              </div>
            );
          })}

          {/* دکمه‌های ناوبری */}
          <button
            type="button"
            onClick={prev}
            aria-label="واحد قبلی"
            className="group absolute right-1 top-1/2 z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#0a2848]/10 bg-[#0a2848] text-xl font-black text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-[#153b60] active:scale-90 sm:right-6"
          >
            <span className="transition-transform duration-300 group-hover:translate-x-1">‹</span>
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="واحد بعدی"
            className="group absolute left-1 top-1/2 z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#0a2848]/10 bg-[#0a2848] text-xl font-black text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-[#153b60] active:scale-90 sm:left-6"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-1">›</span>
          </button>
        </div>

        {/* نقاط ناوبری */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {units.map((unit, index) => (
            <button
              key={unit.id}
              type="button"
              aria-label={`نمایش ${getOfficialUnitShortTitle(unit)}`}
              onClick={() => goTo(index)}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                index === active ? "w-8 bg-[#c98c3d]" : "w-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
        <div className="mx-auto mt-4 h-0.5 w-24 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <span
            key={active}
            className="besat-carousel-progress block h-full origin-right rounded-full bg-[#c98c3d]"
            style={{ animationPlayState: isPaused ? "paused" : "running" }}
          />
        </div>
      </div>
    </section>
  );
}

function UnitCard({
  unit,
  isActive,
  onClick,
}: {
  unit: PublicSchoolUnit;
  isActive: boolean;
  onClick: () => void;
}) {
  const imageSrc = unit.cover_image;
  const cardInner = (
    <div
      className={`relative h-[24rem] w-[18rem] overflow-hidden rounded-[1.5rem] border shadow-2xl transition-[border-color,box-shadow] duration-500 sm:h-[28rem] sm:w-[21rem] ${
        isActive ? "border-[#d7a457]" : "border-slate-200"
      }`}
    >
      {/* تصویر یا گرادیان */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={getOfficialUnitShortTitle(unit)}
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[680ms] ease-[cubic-bezier(.22,1,.36,1)] ${isActive ? "scale-100" : "scale-[1.055]"}`}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[#163b5c]" aria-hidden="true" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(226,174,91,0.2),transparent_45%)]" />

      {/* محتوا */}
      <div className="absolute inset-x-0 bottom-0 p-6 text-right text-white">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-xl bg-white/15 px-3 py-1 text-xs font-black text-white backdrop-blur">
            {kindLabels[unit.kind] ?? unit.kind}
          </span>
          <span className="rounded-xl bg-[#d6a153]/35 px-3 py-1 text-xs font-black text-[#fff2d7] backdrop-blur">
            {genderLabels[unit.gender] ?? unit.gender}
          </span>
        </div>
        <h3 className="text-xl font-black leading-[1.6] text-white sm:text-2xl">{getOfficialUnitShortTitle(unit)}</h3>
        {unit.description && isActive ? (
          <p className="mt-2 text-sm font-bold leading-7 text-white/75 line-clamp-2">
            {unit.description}
          </p>
        ) : null}

        {isActive ? (
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#d6a153] px-5 py-2.5 text-sm font-black text-[#0b213c] shadow-lg transition hover:bg-[#e2b870]">
            <span>مشاهده واحد</span>
            <span>←</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  // فقط کارت فعال لینک است؛ بقیه کلیک = رفتن به آن واحد
  if (isActive) {
    return (
      <Link href={`/units?unit=${encodeURIComponent(unit.slug)}`} aria-label={getOfficialUnitShortTitle(unit)} draggable={false}>
        {cardInner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={`انتخاب ${getOfficialUnitShortTitle(unit)}`}>
      {cardInner}
    </button>
  );
}
