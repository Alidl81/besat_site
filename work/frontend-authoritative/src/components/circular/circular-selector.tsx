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
  const [rotation, setRotation] = useState(-28);
  const [hasEntered, setHasEntered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);
  const wheelLockRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);

  const anglePer = useMemo(() => (total > 0 ? 360 / total : 0), [total]);

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
    if (total === 0 || !hasEntered) {
      return;
    }

    const target = -activeIndex * anglePer;

    const frame = window.requestAnimationFrame(() => {
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
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, anglePer, hasEntered, total]);

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

  const selectByOffset = useCallback((offset: number) => {
    const nextIndex = (activeIndex + offset + total) % total;
    onSelect(items[nextIndex].id);
  }, [activeIndex, items, onSelect, total]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || total < 2) return;

    const handleWheel = (event: WheelEvent) => {
      const rect = element.getBoundingClientRect();
      const pointerX = event.clientX - (rect.left + rect.width / 2);
      const pointerY = event.clientY - (rect.top + rect.height / 2);
      const isPointerOnCenter = Math.hypot(pointerX, pointerY) <= CENTER_SIZE * 0.75;

      if (!isPointerOnCenter || event.deltaY === 0) {
        return;
      }

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
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
      wheelLockRef.current = false;
    };
  }, [selectByOffset, total]);

  if (total === 0) {
    return null;
  }

  return (
    <div className={`mx-auto w-full max-w-[27rem] py-6 transition-opacity duration-500 ${hasEntered ? "besat-orbit-enter" : "opacity-0"}`}>
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
        <span className="besat-orbit-ring pointer-events-none absolute inset-[12%] rounded-full border border-dashed border-[#c98c3d]/30" aria-hidden="true" />
        <div
          className="absolute inset-0 will-change-transform transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
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
                      ? "bg-blue-500 text-white shadow-[0_20px_40px_rgba(43,111,159,0.34)]"
                      : "bg-white text-[#062452] shadow-[0_12px_26px_rgba(15,23,42,0.13)] hover:scale-110 hover:bg-blue-50 hover:text-blue-700"
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
          className="besat-orbit-core pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#12395b] text-center text-white shadow-[0_20px_45px_rgba(18,57,91,0.28)]"
          style={{
            width: `${CENTER_SIZE}px`,
            height: `${CENTER_SIZE}px`,
          }}
        >
          <span className="text-xs font-black text-blue-300">مجموعه بعثت</span>
          <span className="mt-1 text-[10px] font-bold text-white/85">اسکرول یا انتخاب</span>
        </div>
      </div>
    </div>
  );
}
