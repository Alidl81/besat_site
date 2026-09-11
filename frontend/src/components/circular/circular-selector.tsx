"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const CENTER_SIZE = 112;
const DEFAULT_ORBIT_RADIUS = 138;

function AdaptiveNode({
  item,
  active,
  dense,
  onClick,
}: {
  item: CircularItem;
  active: boolean;
  dense: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={item.title}
      aria-pressed={active}
      className="relative outline-none focus-visible:z-40 focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/55"
    >
      <span
        className={`flex items-center justify-center text-center font-black transition-all duration-500 motion-reduce:transition-none ${
          dense
            ? `size-16 rounded-full px-1 text-xs leading-5 ${
                active
                  ? "bg-[#e2ae5b] text-[#0a2848] shadow-[0_16px_32px_rgba(201,140,61,0.3)]"
                  : "bg-white text-[#0a2848] shadow-[0_12px_26px_rgba(15,23,42,0.13)] hover:scale-110 hover:bg-[#fff8ed]"
              }`
            : `min-h-[4.25rem] min-w-[7.75rem] max-w-[10.5rem] md:max-xl:max-w-[9.5rem] rounded-[1.75rem] border px-4 py-3 text-sm leading-6 [text-wrap:balance] ${
                active
                  ? "scale-[1.04] border-[#c88d3c] bg-[#fff8ed] text-[#774a12] shadow-[0_16px_32px_rgba(201,140,61,0.2)]"
                  : "border-[#dbe3e9] bg-white text-[#0a2848] shadow-[0_10px_24px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 hover:border-[#d9aa62] hover:bg-[#fffaf2]"
              }`
        }`}
      >
        <span className="break-words">{item.title}</span>
      </span>
    </button>
  );
}

export function CircularSelector({
  items,
  activeId,
  onSelect,
}: CircularSelectorProps) {
  const total = items.length;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const [rotation, setRotation] = useState(-28);
  const [hasEntered, setHasEntered] = useState(false);
  const [orbitRadius, setOrbitRadius] = useState(DEFAULT_ORBIT_RADIUS);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);
  const wheelLockRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);

  const anglePer = useMemo(() => (total > 0 ? 360 / total : 0), [total]);
  const dense = total > 8;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setHasEntered(true), 20);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateRadius = () => {
      const width = element.clientWidth || 440;
      setOrbitRadius(Math.max(112, Math.min(152, Math.round(width * 0.4))));
    };

    updateRadius();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRadius);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (total === 0 || !hasEntered) return;

    const target = -activeIndex * anglePer;
    const frame = window.requestAnimationFrame(() => {
      setRotation((previousRotation) => {
        let delta = target - (previousRotation % 360);
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return previousRotation + delta;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, anglePer, hasEntered, total]);

  function getPointerAngle(clientX: number, clientY: number) {
    const element = containerRef.current;
    if (!element) return 0;

    const rect = element.getBoundingClientRect();
    return (
      Math.atan2(
        clientY - (rect.top + rect.height / 2),
        clientX - (rect.left + rect.width / 2),
      ) *
      180 /
      Math.PI
    );
  }

  function onDragStart(clientX: number, clientY: number) {
    dragRef.current = {
      startAngle: getPointerAngle(clientX, clientY),
      startRotation: rotation,
    };
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const currentAngle = getPointerAngle(clientX, clientY);
    setRotation(dragRef.current.startRotation + (currentAngle - dragRef.current.startAngle));
  }

  function onDragEnd() {
    if (!dragRef.current || total === 0) return;
    dragRef.current = null;

    const normalized = ((-rotation % 360) + 360) % 360;
    const nearest = Math.round(normalized / anglePer) % total;
    onSelect(items[((nearest % total) + total) % total].id);
  }

  function distanceFromActive(index: number) {
    const direct = Math.abs(index - activeIndex);
    return Math.min(direct, total - direct);
  }

  const selectByOffset = useCallback(
    (offset: number) => {
      if (total === 0) return;
      const nextIndex = (activeIndex + offset + total) % total;
      onSelect(items[nextIndex].id);
    },
    [activeIndex, items, onSelect, total],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || total < 2) return;

    const handleWheel = (event: WheelEvent) => {
      const rect = element.getBoundingClientRect();
      const pointerX = event.clientX - (rect.left + rect.width / 2);
      const pointerY = event.clientY - (rect.top + rect.height / 2);
      const isPointerOnCenter = Math.hypot(pointerX, pointerY) <= CENTER_SIZE * 0.75;

      if (!isPointerOnCenter || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (wheelLockRef.current) return;

      wheelLockRef.current = true;
      selectByOffset(event.deltaY > 0 ? 1 : -1);
      wheelTimerRef.current = window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 380);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
      wheelLockRef.current = false;
    };
  }, [selectByOffset, total]);

  if (total === 0) return null;

  return (
    <div
      className={`mx-auto w-full max-w-[33rem] py-4 transition-opacity duration-500 md:py-6 ${
        hasEntered ? "besat-orbit-enter" : "opacity-0"
      }`}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        aria-label="گردونه انتخاب حوزه"
        className="relative hidden aspect-square w-full cursor-grab select-none touch-none overflow-visible outline-none active:cursor-grabbing md:block"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectByOffset(1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            selectByOffset(-1);
          }
        }}
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          onDragStart(event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (dragRef.current) onDragMove(event.clientX, event.clientY);
        }}
        onMouseUp={onDragEnd}
        onMouseLeave={() => {
          if (dragRef.current) onDragEnd();
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
        <span
          className="besat-orbit-ring pointer-events-none absolute inset-[8%] rounded-full border border-dashed border-[#c98c3d]/40"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 will-change-transform transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {items.map((item, index) => {
            const angle = index * anglePer - 90;
            const radian = (angle * Math.PI) / 180;
            const isActive = item.id === activeId;
            const x = Math.cos(radian) * orbitRadius;
            const y = Math.sin(radian) * orbitRadius;

            return (
              <div
                key={item.id}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  zIndex: isActive ? 30 : 20 - distanceFromActive(index),
                }}
              >
                <div style={{ transform: `rotate(${-rotation}deg)` }}>
                  <AdaptiveNode item={item} active={isActive} dense={dense} onClick={() => onSelect(item.id)} />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="besat-orbit-core pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#12395b] text-center text-white shadow-[0_20px_45px_rgba(18,57,91,0.28)]"
          style={{ width: `${CENTER_SIZE}px`, height: `${CENTER_SIZE}px` }}
        >
          <span className="text-xs font-black text-[#f1ca83]">مجموعه بعثت</span>
          <span className="mt-1 text-[10px] font-bold leading-4 text-white/85">اسکرول یا انتخاب</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-label={item.title}
            aria-pressed={item.id === activeId}
            className={`min-h-14 rounded-2xl border px-4 py-3 text-center text-sm font-black leading-6 [text-wrap:balance] outline-none transition focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/55 ${
              item.id === activeId
                ? "border-[#c88d3c] bg-[#fff8ed] text-[#774a12] shadow-[0_12px_26px_rgba(201,140,61,0.16)]"
                : "border-[#dbe3e9] bg-white text-[#0a2848] shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            }`}
          >
            <span className="break-words">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
