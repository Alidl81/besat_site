"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  target: number;
  before?: string;
  after?: string;
  duration?: number;
  className?: string;
};

const persianNumber = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function easeOutQuint(progress: number) {
  return 1 - Math.pow(1 - progress, 5);
}

export function AnimatedCounter({
  target,
  before = "",
  after = "",
  duration = 1350,
  className = "",
}: AnimatedCounterProps) {
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const hasPlayedRef = useRef(false);
  const animationFrameRef = useRef(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const play = () => {
      if (hasPlayedRef.current) return;
      hasPlayedRef.current = true;

      const startedAt = performance.now();
      const update = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        setValue(Math.round(target * easeOutQuint(progress)));

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(update);
        }
      };

      animationFrameRef.current = window.requestAnimationFrame(update);
    };

    if (typeof IntersectionObserver === "undefined") {
      animationFrameRef.current = window.requestAnimationFrame(play);
      return () => window.cancelAnimationFrame(animationFrameRef.current);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [duration, target]);

  return (
    <span
      ref={elementRef}
      className={`inline-flex items-baseline justify-center gap-1 ${className}`}
      dir="rtl"
      aria-label={`${before}${persianNumber.format(target)}${after}`}
    >
      {before ? <span>{before}</span> : null}
      <span className="tabular-nums" dir="ltr" aria-hidden="true">
        {persianNumber.format(value)}
      </span>
      {after ? <span>{after}</span> : null}
    </span>
  );
}
