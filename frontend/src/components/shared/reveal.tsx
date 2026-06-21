"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealMode = "immediate" | "lazy";

type RevealProps = {
  children: ReactNode;
  className?: string;
  reserveClassName?: string;
  delay?: number;
  mode?: RevealMode;
};

export function Reveal({
  children,
  className = "",
  reserveClassName = "min-h-24",
  delay = 0,
  mode = "immediate",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(mode === "immediate");
  const [isVisible, setIsVisible] = useState(mode === "immediate");

  useEffect(() => {
    if (mode === "immediate") {
      setShouldRender(true);
      setIsVisible(true);
      return;
    }

    const show = () => {
      setShouldRender(true);
      globalThis.setTimeout(() => {
        setIsVisible(true);
      }, 20);
    };

    const element = ref.current;

    if (!element) {
      show();
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        show();
        observer.unobserve(entry.target);
      },
      {
        rootMargin: "180px 0px",
        threshold: 0.04,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [mode]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${shouldRender ? "" : reserveClassName} transform-gpu transition duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {shouldRender ? children : null}
    </div>
  );
}
