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
  /** Unit wheels have many more nodes and therefore use the denser treatment. */
  variant?: "department" | "unit";
};

const CENTER_SIZE = 112;
const DRAG_THRESHOLD = 8;

/**
 * The public wheel follows the historical Besat interaction model. Rotation is
 * driven directly by the pointer angle around the wheel, then snaps to the
 * nearest item on release. There is no idle spin or synthetic inertia.
 */
type DragState = {
  pointerId: number;
  startAngle: number;
  startRotation: number;
  moved: boolean;
};

function AdaptiveNode({
  item,
  active,
  dense,
  distant,
  onClick,
}: {
  item: CircularItem;
  active: boolean;
  dense: boolean;
  distant: boolean;
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
        className={`flex items-center justify-center text-center font-black transition-[background-color,border-color,box-shadow,opacity,transform] duration-500 motion-reduce:transition-none ${
          dense
            ? `h-[clamp(2.9rem,12vw,4.2rem)] w-[clamp(3.9rem,16vw,5.6rem)] rounded-[1.2rem] px-1.5 text-[clamp(.62rem,2.4vw,.78rem)] leading-4 ${
                active
                  ? "scale-110 border border-[#c88d3c] bg-[#e2ae5b] text-[#0a2848] shadow-[0_16px_32px_rgba(201,140,61,0.3)]"
                  : distant
                    ? "scale-75 border border-slate-200/70 bg-white/70 text-[#496175] opacity-45 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                    : "border border-[#dbe3e9] bg-white text-[#0a2848] shadow-[0_10px_22px_rgba(15,23,42,0.11)] hover:scale-105 hover:bg-[#fff8ed]"
              }`
            : `min-h-[4rem] w-[clamp(5.8rem,27vw,10.5rem)] rounded-[1.45rem] border px-2.5 py-2 text-[clamp(.72rem,2.2vw,.9rem)] leading-5 [text-wrap:balance] sm:min-h-[4.25rem] sm:px-4 sm:py-3 ${
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
  variant = "department",
}: CircularSelectorProps) {
  const total = items.length;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const dense = variant === "unit" || total > 8;
  const [rotation, setRotation] = useState(-28);
  const [hasEntered, setHasEntered] = useState(false);
  const [orbitRadius, setOrbitRadius] = useState(138);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(-28);
  const dragRef = useRef<DragState | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const wheelLockRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);

  const anglePer = useMemo(() => (total > 0 ? 360 / total : 0), [total]);

  const setWheelRotation = useCallback((next: number | ((previous: number) => number)) => {
    setRotation((previous) => {
      const value = typeof next === "function" ? next(previous) : next;
      rotationRef.current = value;
      return value;
    });
  }, []);

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
      // Keep the historical 138px orbit on desktop while retaining one wheel
      // (not a separate list) at phone widths.
      const nodeAllowance = dense ? (width < 480 ? 42 : 58) : width < 480 ? 54 : 78;
      setOrbitRadius(Math.max(76, Math.min(152, Math.round(width / 2 - nodeAllowance))));
    };

    updateRadius();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateRadius);
    observer.observe(element);
    return () => observer.disconnect();
  }, [dense]);

  useEffect(() => {
    if (total === 0 || !hasEntered) return;

    // Historical snap behavior: selected item at the top, shortest path from
    // the current rotation, with the original 900ms easing handled by CSS.
    const target = -activeIndex * anglePer;
    const frame = window.requestAnimationFrame(() => {
      setWheelRotation((previousRotation) => {
        let delta = target - (previousRotation % 360);
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return previousRotation + delta;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, anglePer, hasEntered, setWheelRotation, total]);

  function getPointerAngle(clientX: number, clientY: number) {
    const element = containerRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return (
      Math.atan2(
        clientY - (rect.top + rect.height / 2),
        clientX - (rect.left + rect.width / 2),
      ) * 180 / Math.PI
    );
  }

  function beginDrag(pointerId: number, clientX: number, clientY: number) {
    dragRef.current = {
      pointerId,
      startAngle: getPointerAngle(clientX, clientY),
      startRotation: rotationRef.current,
      moved: false,
    };
    pointerStartRef.current = { x: clientX, y: clientY };
  }

  function moveDrag(pointerId: number, clientX: number, clientY: number, event?: { preventDefault: () => void }) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    const distance = Math.hypot(clientX - pointerStartRef.current.x, clientY - pointerStartRef.current.y);
    if (distance > DRAG_THRESHOLD) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    if (!drag.moved) return;
    event?.preventDefault();
    const currentAngle = getPointerAngle(clientX, clientY);
    // This direct start-angle delta is the original Besat wheel physics.
    setWheelRotation(drag.startRotation + (currentAngle - drag.startAngle));
  }

  function finishDrag(pointerId: number, event?: { releasePointerCapture?: (id: number) => void }) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    dragRef.current = null;
    event?.releasePointerCapture?.(pointerId);

    if (drag.moved && total > 0) {
      const normalized = ((-rotationRef.current % 360) + 360) % 360;
      const nearest = Math.round(normalized / anglePer) % total;
      const index = ((nearest % total) + total) % total;
      onSelect(items[index].id);
    }

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
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
    <div className={`mx-auto w-full max-w-[33rem] py-4 transition-opacity duration-500 md:py-6 motion-reduce:transition-none ${hasEntered ? "besat-orbit-enter" : "opacity-0"}`}>
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={variant === "unit" ? "گردونه انتخاب واحد آموزشی" : "گردونه انتخاب حوزه"}
        className="relative aspect-square w-full cursor-grab select-none touch-none overflow-visible outline-none active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/35"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectByOffset(1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            selectByOffset(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            onSelect(items[0].id);
          } else if (event.key === "End") {
            event.preventDefault();
            onSelect(items[items.length - 1].id);
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          // The historical wheel deliberately let pointer taps on nodes reach
          // the node button. Capturing those pointers at the orbit container
          // retargets the browser's click to the container, so the visible
          // node can no longer activate. Start orbit drags from the wheel
          // surface instead; a tap on a node remains a real click-to-focus.
          if ((event.target as HTMLElement).closest("button")) return;
          beginDrag(event.pointerId, event.clientX, event.clientY);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => moveDrag(event.pointerId, event.clientX, event.clientY, event)}
        onPointerUp={(event) => finishDrag(event.pointerId, event.currentTarget)}
        onPointerCancel={(event) => finishDrag(event.pointerId, event.currentTarget)}
        onMouseDown={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.button === 0) beginDrag(0, event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          moveDrag(0, event.clientX, event.clientY, event);
        }}
        onMouseUp={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          finishDrag(0, event.currentTarget);
        }}
        onMouseLeave={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          finishDrag(0, event.currentTarget);
        }}
        onTouchStart={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          if ((event.target as HTMLElement).closest("button")) return;
          const touch = event.touches[0];
          if (touch) beginDrag(0, touch.clientX, touch.clientY);
        }}
        onTouchMove={(event) => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          const touch = event.touches[0];
          if (touch) moveDrag(0, touch.clientX, touch.clientY, event);
        }}
        onTouchEnd={() => {
          if (typeof window !== "undefined" && "PointerEvent" in window) return;
          finishDrag(0);
        }}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <span className="besat-orbit-ring pointer-events-none absolute inset-[8%] rounded-full border border-dashed border-[#c98c3d]/40" aria-hidden="true" />
        <div
          className="absolute inset-0 will-change-transform transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {items.map((item, index) => {
            const angle = index * anglePer - 90;
            const radian = (angle * Math.PI) / 180;
            const direct = Math.abs(index - activeIndex);
            const distance = Math.min(direct, total - direct);
            const isActive = item.id === activeId;
            const x = Math.cos(radian) * orbitRadius;
            const y = Math.sin(radian) * orbitRadius;

            return (
              <div
                key={item.id}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  zIndex: isActive ? 30 : 20 - distance,
                }}
              >
                <div style={{ transform: `rotate(${-rotation}deg)` }}>
                  <AdaptiveNode
                    item={item}
                    active={isActive}
                    dense={dense}
                    distant={dense && distance > 2}
                    onClick={() => {
                      if (!suppressClickRef.current) onSelect(item.id);
                    }}
                  />
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
    </div>
  );
}
