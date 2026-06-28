"use client";

import { useEffect, useRef, useState } from "react";

export type CircularItem = {
  id: string;
  title: string;
  slug: string;
};

type CircularSelectorProps = {
  items: CircularItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * گردونه دایره‌ای: یک دایره مرکزی و آیتم‌ها حول آن.
 * آیتم انتخاب‌شده همیشه بالای محور (موقعیت ثابت) قرار می‌گیرد و بزرگ‌تر است.
 * با چرخاندن کل گردونه، آیتم انتخاب‌شده به بالا می‌آید.
 * قابل کنترل با کلیک روی آیتم یا کشیدن (درگ چرخشی).
 */
export function CircularSelector({ items, activeId, onSelect }: CircularSelectorProps) {
  const total = items.length;
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);

  // زاویه هر آیتم روی دایره
  const anglePer = total > 0 ? 360 / total : 0;

  // چرخش هدف: آیتم فعال باید به بالا (-90 درجه در مختصات استاندارد) بیاید
  useEffect(() => {
    const target = -activeIndex * anglePer;
    setRotation((prev) => {
      // نزدیک‌ترین مسیر چرخشی را انتخاب کن
      let delta = target - (prev % 360);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return prev + delta;
    });
  }, [activeIndex, anglePer]);

  function pointerAngle(clientX: number, clientY: number): number {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  }

  function onDragStart(clientX: number, clientY: number) {
    dragRef.current = {
      startAngle: pointerAngle(clientX, clientY),
      startRotation: rotation,
    };
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const current = pointerAngle(clientX, clientY);
    const delta = current - dragRef.current.startAngle;
    setRotation(dragRef.current.startRotation + delta);
  }

  function onDragEnd() {
    if (!dragRef.current) return;
    dragRef.current = null;
    // نزدیک‌ترین آیتم به بالا را snap کن
    const normalized = ((-rotation % 360) + 360) % 360;
    const nearest = Math.round(normalized / anglePer) % total;
    const idx = ((nearest % total) + total) % total;
    onSelect(items[idx].id);
  }

  if (total === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-md select-none touch-none"
      onMouseDown={(e) => onDragStart(e.clientX, e.clientY)}
      onMouseMove={(e) => dragRef.current && onDragMove(e.clientX, e.clientY)}
      onMouseUp={onDragEnd}
      onMouseLeave={() => dragRef.current && onDragEnd()}
      onTouchStart={(e) => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => dragRef.current && onDragMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={onDragEnd}
    >
      {/* حلقه‌های تزئینی */}
      <div className="absolute inset-0 rounded-full border border-slate-200" />
      <div className="absolute inset-[12%] rounded-full border border-dashed border-slate-200" />

      {/* گردونه چرخان */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {items.map((item, index) => {
          const angle = index * anglePer - 90; // -90 تا اولین آیتم بالا باشد
          const rad = (angle * Math.PI) / 180;
          // شعاع قرارگیری مراکز آیتم‌ها (درصد از نیمه)
          const radius = 42;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
              aria-label={item.title}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* محتوای آیتم — با چرخش معکوس تا صاف بماند */}
              <span
                className="block transition-transform duration-700 ease-out"
                style={{ transform: `rotate(${-rotation}deg)` }}
              >
                <span
                  className={`flex items-center justify-center rounded-full text-center font-black leading-tight shadow-lg transition-all duration-500 ${
                    isActive
                      ? "size-28 bg-emerald-500 text-white shadow-emerald-500/30 sm:size-32"
                      : "size-20 bg-white text-[#062452] hover:bg-emerald-50 hover:text-emerald-700 sm:size-24"
                  }`}
                >
                  <span className={`px-2 ${isActive ? "text-sm sm:text-base" : "text-[0.7rem] sm:text-xs"}`}>
                    {item.title}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* دایره مرکزی */}
      <div className="absolute left-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#143e61] to-[#062452] text-center text-white shadow-2xl sm:size-28">
        <span className="text-xs font-black text-emerald-300">مجموعه بعثت</span>
        <span className="mt-1 text-[0.65rem] font-bold text-white/70">انتخاب کنید</span>
      </div>
    </div>
  );
}
