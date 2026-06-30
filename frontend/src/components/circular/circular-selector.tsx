"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const ORBIT_RADIUS = 138;
const ACTIVE_SIZE = 96;
const ITEM_SIZE = 60;
const CENTER_SIZE = 96;

export function CircularSelector({
  items,
  activeId,
  onSelect,
}: CircularSelectorProps) {
  const total = items.length;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);

  const anglePer = useMemo(() => (total > 0 ? 360 / total : 0), [total]);

  useEffect(() => {
    if (total === 0) {
      return;
    }

    const target = -activeIndex * anglePer;

    setRotation((previousRotation) => {
      let delta = target - (previousRotation % 360);

      if (delta > 180) {
        delta -= 360;
      }

      if (delta < -180) {
        delta += 360;
      }

      return previousRotation + delta;
    });
  }, [activeIndex, anglePer, total]);

  function getPointerAngle(clientX: number, clientY: number) {
    const element = containerRef.current;

    if (!element) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
  }

  function onDragStart(clientX: number, clientY: number) {
    dragRef.current = {
      startAngle: getPointerAngle(clientX, clientY),
      startRotation: rotation,
    };
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!dragRef.current) {
      return;
    }

    const currentAngle = getPointerAngle(clientX, clientY);
    const delta = currentAngle - dragRef.current.startAngle;

    setRotation(dragRef.current.startRotation + delta);
  }

  function onDragEnd() {
    if (!dragRef.current || total === 0) {
      return;
    }

    dragRef.current = null;

    const normalized = ((-rotation % 360) + 360) % 360;
    const nearest = Math.round(normalized / anglePer) % total;
    const index = ((nearest % total) + total) % total;

    onSelect(items[index].id);
  }

  function distanceFromActive(index: number) {
    const direct = Math.abs(index - activeIndex);
    return Math.min(direct, total - direct);
  }

  if (total === 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[27rem] py-6">
      <div
        ref={containerRef}
        className="relative aspect-square w-full cursor-grab select-none touch-none overflow-visible active:cursor-grabbing"
        onMouseDown={(event) => onDragStart(event.clientX, event.clientY)}
        onMouseMove={(event) => {
          if (dragRef.current) {
            onDragMove(event.clientX, event.clientY);
          }
        }}
        onMouseUp={onDragEnd}
        onMouseLeave={() => {
          if (dragRef.current) {
            onDragEnd();
          }
        }}
        onTouchStart={(event) => onDragStart(event.touches[0].clientX, event.touches[0].clientY)}
        onTouchMove={(event) => {
          if (dragRef.current) {
            event.preventDefault();
            onDragMove(event.touches[0].clientX, event.touches[0].clientY);
          }
        }}
        onTouchEnd={onDragEnd}
      >
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {items.map((item, index) => {
            const angle = index * anglePer - 90;
            const radian = (angle * Math.PI) / 180;
            const isActive = item.id === activeId;
            const distance = distanceFromActive(index);

            const x = Math.cos(radian) * ORBIT_RADIUS;
            const y = Math.sin(radian) * ORBIT_RADIUS;

            return (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(item.id);
                }}
                aria-label={item.title}
                aria-pressed={isActive}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  zIndex: isActive ? 30 : 20 - distance,
                }}
              >
                <span
                  className={`flex items-center justify-center rounded-full text-center transition-all duration-500 ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-[0_20px_40px_rgba(16,185,129,0.32)]"
                      : "bg-white text-[#062452] shadow-[0_12px_26px_rgba(15,23,42,0.13)] hover:scale-110 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                  style={{
                    width: isActive ? `${ACTIVE_SIZE}px` : `${ITEM_SIZE}px`,
                    height: isActive ? `${ACTIVE_SIZE}px` : `${ITEM_SIZE}px`,
                    transform: `rotate(${-rotation}deg)`,
                  }}
                >
                  <span
                    className={`px-2 font-black leading-6 ${
                      isActive ? "text-base" : "text-xs"
                    }`}
                  >
                    {item.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#12395b] text-center text-white shadow-[0_20px_45px_rgba(18,57,91,0.28)]"
          style={{
            width: `${CENTER_SIZE}px`,
            height: `${CENTER_SIZE}px`,
          }}
        >
          <span className="text-xs font-black text-emerald-300">مجموعه بعثت</span>
          <span className="mt-1 text-xs font-bold text-white/85">انتخاب کنید</span>
        </div>
      </div>
    </div>
  );
}
