"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";

type HomeUnitsCarouselProps = {
  units: SchoolUnitRecord[];
};

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
    <section dir="rtl" className="overflow-hidden bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* عنوان */}
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm font-black text-emerald-600">مدارس مجموعه آموزشی فرهنگی بعثت</p>
          <h2 className="text-3xl font-black leading-[1.5] text-[#062452] sm:text-4xl">
            واحدهای آموزشی بعثت
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-8 text-slate-500">
            برای مشاهده هر واحد، روی آن کلیک کنید یا گردونه را بکشید.
          </p>
        </div>

        {/* کاروسل coverflow */}
        <div
          className="relative flex h-[26rem] items-center justify-center select-none sm:h-[30rem]"
          style={{ perspective: "1600px" }}
          onMouseDown={(e) => onDragStart(e.clientX)}
          onMouseUp={(e) => onDragEnd(e.clientX)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
          onTouchEnd={(e) => onDragEnd(e.changedTouches[0].clientX)}
        >
          {units.map((unit, index) => {
            const pos = relativePosition(index);
            const isActive = pos === 0;
            const isVisible = Math.abs(pos) <= 2;

            // فاصله افقی، مقیاس، چرخش و شفافیت بر اساس فاصله از مرکز
            const translateX = pos * 58; // درصد
            const scale = isActive ? 1 : Math.max(0.7, 1 - Math.abs(pos) * 0.18);
            const rotateY = pos * -22;
            const opacity = isVisible ? (isActive ? 1 : 0.55) : 0;
            const zIndex = 20 - Math.abs(pos);
            const blur = isActive ? 0 : Math.min(Math.abs(pos) * 1.5, 4);

            return (
              <div
                key={unit.id}
                className="absolute transition-all duration-700 ease-out"
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
            className="absolute right-2 top-1/2 z-30 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-black text-[#062452] shadow-lg transition hover:bg-emerald-50 hover:text-emerald-700 sm:right-6"
          >
            ›
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="واحد بعدی"
            className="absolute left-2 top-1/2 z-30 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-black text-[#062452] shadow-lg transition hover:bg-emerald-50 hover:text-emerald-700 sm:left-6"
          >
            ‹
          </button>
        </div>

        {/* نقاط ناوبری */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {units.map((unit, index) => (
            <button
              key={unit.id}
              type="button"
              aria-label={`نمایش ${unit.title}`}
              onClick={() => goTo(index)}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                index === active ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
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
  unit: SchoolUnitRecord;
  isActive: boolean;
  onClick: () => void;
}) {
  const cardInner = (
    <div
      className={`relative h-[24rem] w-[18rem] overflow-hidden rounded-[2rem] border shadow-2xl transition-all duration-500 sm:h-[28rem] sm:w-[22rem] ${
        isActive ? "border-emerald-300" : "border-slate-200"
      }`}
    >
      {/* تصویر یا گرادیان */}
      {unit.cover_image ? (
        <img
          src={unit.cover_image}
          alt={unit.title}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#143e61] via-[#0d3157] to-[#062452]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(52,211,153,0.18),transparent_45%)]" />

      {/* محتوا */}
      <div className="absolute inset-x-0 bottom-0 p-6 text-right text-white">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-xl bg-white/15 px-3 py-1 text-xs font-black text-white backdrop-blur">
            {kindLabels[unit.kind] ?? unit.kind}
          </span>
          <span className="rounded-xl bg-emerald-500/30 px-3 py-1 text-xs font-black text-emerald-100 backdrop-blur">
            {genderLabels[unit.gender] ?? unit.gender}
          </span>
        </div>
        <h3 className="text-xl font-black leading-[1.6] text-white sm:text-2xl">{unit.title}</h3>
        {unit.description && isActive ? (
          <p className="mt-2 text-sm font-bold leading-7 text-white/75 line-clamp-2">
            {unit.description}
          </p>
        ) : null}

        {isActive ? (
          <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-emerald-600">
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
      <Link href={`/units/${unit.slug}`} aria-label={unit.title} draggable={false}>
        {cardInner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={`انتخاب ${unit.title}`}>
      {cardInner}
    </button>
  );
}
