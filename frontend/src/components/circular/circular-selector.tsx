"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

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
const IDLE_SPEED = 2.2;

type DragState = {
  pointerId: number;
  lastAngle: number;
  lastTime: number;
  moved: boolean;
};

function normalizeAngle(value: number) {
  let angle = value;
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

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
        className={`flex items-center justify-center text-center font-black transition-[background-color,border-color,box-shadow,opacity,transform] duration-300 motion-reduce:transition-none ${
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
  const [hasEntered, setHasEntered] = useState(false);
  const [orbitRadius, setOrbitRadius] = useState(128);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orbitRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(-28);
  const velocityRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const idlePausedRef = useRef(false);
  const wheelLockRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);

  const anglePer = useMemo(() => (total > 0 ? 360 / total : 0), [total]);

  const setRotation = useCallback((rotation: number) => {
    rotationRef.current = rotation;
    if (orbitRef.current) {
      orbitRef.current.style.transform = `rotate(${rotation}deg)`;
      orbitRef.current.style.setProperty("--orbit-rotation", `${rotation}deg`);
    }
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  const settleToActive = useCallback((index: number, immediate = false) => {
    if (!total || !anglePer) return;
    const target = -index * anglePer - 28;
    const destination = rotationRef.current + normalizeAngle(target - rotationRef.current);
    cancelAnimation();
    if (immediate || reducedMotion) {
      setRotation(destination);
      return;
    }
    const started = performance.now();
    const start = rotationRef.current;
    const duration = 480;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setRotation(start + (destination - start) * eased);
      if (progress < 1) animationRef.current = window.requestAnimationFrame(tick);
      else animationRef.current = null;
    };
    animationRef.current = window.requestAnimationFrame(tick);
  }, [anglePer, cancelAnimation, reducedMotion, setRotation, total]);

  const selectByOffset = useCallback(
    (offset: number) => {
      if (!total) return;
      const nextIndex = (activeIndex + offset + total) % total;
      onSelect(items[nextIndex].id);
    },
    [activeIndex, items, onSelect, total],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateRadius = () => {
      const width = element.clientWidth || 420;
      const nodeAllowance = dense ? (width < 480 ? 42 : 58) : width < 480 ? 54 : 78;
      setOrbitRadius(Math.max(76, Math.min(168, Math.round(width / 2 - nodeAllowance))));
    };
    updateRadius();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateRadius);
    observer.observe(element);
    return () => observer.disconnect();
  }, [dense]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setHasEntered(true), 20);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.18, rootMargin: "0px 0px -5% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!total || !hasEntered) return;
    settleToActive(activeIndex);
  }, [activeIndex, hasEntered, settleToActive, total]);

  useEffect(() => {
    if (!hasEntered || reducedMotion || total < 2) return;
    let frame: number;
    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      const elapsed = Math.min(40, now - previous);
      lastFrameRef.current = now;
      if (!idlePausedRef.current && !dragRef.current && animationRef.current === null) {
        setRotation(rotationRef.current + (IDLE_SPEED * elapsed) / 1000);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      lastFrameRef.current = null;
    };
  }, [hasEntered, reducedMotion, setRotation, total]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || total < 2) return;
    const handleWheel = (event: WheelEvent) => {
      const rect = element.getBoundingClientRect();
      const pointerX = event.clientX - (rect.left + rect.width / 2);
      const pointerY = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(pointerX, pointerY) > CENTER_SIZE * 0.85 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      event.stopPropagation();
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      selectByOffset(event.deltaY > 0 ? 1 : -1);
      wheelTimerRef.current = window.setTimeout(() => { wheelLockRef.current = false; }, 300);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
      wheelLockRef.current = false;
    };
  }, [selectByOffset, total]);

  function getPointerAngle(clientX: number, clientY: number) {
    const element = containerRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return Math.atan2(clientY - (rect.top + rect.height / 2), clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelAnimation();
    idlePausedRef.current = true;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    dragRef.current = {
      pointerId: event.pointerId,
      lastAngle: getPointerAngle(event.clientX, event.clientY),
      lastTime: performance.now(),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStartRef.current.x, event.clientY - pointerStartRef.current.y);
    if (distance > DRAG_THRESHOLD) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    if (!drag.moved) return;
    event.preventDefault();
    const angle = getPointerAngle(event.clientX, event.clientY);
    const delta = normalizeAngle(angle - drag.lastAngle);
    const now = performance.now();
    const elapsed = Math.max(8, now - drag.lastTime);
    setRotation(rotationRef.current + delta);
    velocityRef.current = delta / elapsed;
    drag.lastAngle = angle;
    drag.lastTime = now;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.moved && total) {
      const normalized = ((-rotationRef.current - 28) % 360 + 360) % 360;
      const nearest = Math.round(normalized / anglePer) % total;
      const runInertia = !reducedMotion && Math.abs(velocityRef.current) > 0.015;
      if (runInertia) {
        const inertiaStart = performance.now();
        velocityRef.current *= 16;
        const tick = (now: number) => {
          const previous = lastFrameRef.current ?? now;
          const elapsed = Math.min(32, now - previous);
          lastFrameRef.current = now;
          velocityRef.current *= Math.pow(0.91, elapsed / 16);
          setRotation(rotationRef.current + velocityRef.current * elapsed);
          if (Math.abs(velocityRef.current) > 0.004 && now - inertiaStart < 850) {
            animationRef.current = window.requestAnimationFrame(tick);
          } else {
            animationRef.current = null;
            lastFrameRef.current = null;
            const settled = Math.round((((-rotationRef.current - 28) % 360) + 360) % 360 / anglePer) % total;
            onSelect(items[settled].id);
          }
        };
        animationRef.current = window.requestAnimationFrame(tick);
      } else {
        onSelect(items[nearest].id);
      }
    }
    idlePausedRef.current = false;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <span className="pointer-events-none absolute inset-[8%] rounded-full border border-dashed border-[#c98c3d]/40" aria-hidden="true" />
        <div ref={orbitRef} className="absolute inset-0 will-change-transform" style={{ transform: "rotate(-28deg)", "--orbit-rotation": "-28deg" } as CSSProperties}>
          {items.map((item, index) => {
            const angle = index * anglePer - 90;
            const radian = (angle * Math.PI) / 180;
            const direct = Math.abs(index - activeIndex);
            const distance = Math.min(direct, total - direct);
            const isActive = item.id === activeId;
            const x = Math.cos(radian) * orbitRadius;
            const y = Math.sin(radian) * orbitRadius;
            return (
              <div key={item.id} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, zIndex: isActive ? 30 : 20 - distance }}>
                <div className="will-change-transform" style={{ transform: "rotate(calc(-1 * var(--orbit-rotation)))" }}>
                  <AdaptiveNode item={item} active={isActive} dense={dense} distant={dense && distance > 2} onClick={() => { if (!suppressClickRef.current) onSelect(item.id); }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#12395b] text-center text-white shadow-[0_20px_45px_rgba(18,57,91,0.28)]" style={{ width: `${CENTER_SIZE}px`, height: `${CENTER_SIZE}px` }}>
          <span className="text-xs font-black text-[#f1ca83]">مجموعه بعثت</span>
          <span className="mt-1 text-[10px] font-bold leading-4 text-white/85">اسکرول یا انتخاب</span>
        </div>
      </div>
    </div>
  );
}
