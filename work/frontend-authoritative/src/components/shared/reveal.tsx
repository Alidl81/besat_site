"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealMode = "immediate" | "lazy";

type RevealProps = {
  children: ReactNode;
  className?: string;
  reserveClassName?: string;
  delay?: number;
  mode?: RevealMode;
  direction?: "up" | "right" | "left" | "scale";
};

export function Reveal({
  children,
  className = "",
  reserveClassName = "min-h-24",
  delay = 0,
  mode = "immediate",
  direction = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(mode === "immediate");
  const [isVisible, setIsVisible] = useState(mode === "immediate");

  useEffect(() => {
    if (mode === "immediate") {
      return;
    }

    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const timer = globalThis.setTimeout(() => {
        setShouldRender(true);
        setIsVisible(true);
      }, 30);
      return () => globalThis.clearTimeout(timer);
    }

    let frameOne = 0;
    let frameTwo = 0;

    const reveal = () => {
      setShouldRender(true);
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => setIsVisible(true));
      });
    };

    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          preloadObserver.disconnect();
        }
      },
      { rootMargin: "420px 0px", threshold: 0 },
    );

    const revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          revealObserver.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    preloadObserver.observe(element);
    revealObserver.observe(element);

    return () => {
      preloadObserver.disconnect();
      revealObserver.disconnect();
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [mode]);

  const hiddenTransform = {
    up: "translate-y-12",
    right: "translate-x-12",
    left: "-translate-x-12",
    scale: "scale-[.965]",
  }[direction];

  return (
    <div
      ref={ref}
      data-reveal-state={isVisible ? "visible" : "hidden"}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${shouldRender ? "" : reserveClassName} transform-gpu transition-[opacity,transform,filter] duration-[950ms] ease-[cubic-bezier(.16,1,.3,1)] ${
        isVisible ? "translate-x-0 translate-y-0 scale-100 opacity-100 blur-0" : `${hiddenTransform} opacity-0 blur-[3px]`
      } ${className}`}
    >
      {shouldRender ? children : null}
    </div>
  );
}
