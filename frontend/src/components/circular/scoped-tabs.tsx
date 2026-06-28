"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ScopedTab = {
  key: string;
  label: string;
  icon: string;
};

type ScopedTabsProps = {
  tabs: ScopedTab[];
  activeKey: string;
  onChange: (key: string) => void;
  children: ReactNode;
};

/**
 * نویگیشن تب‌دار با:
 * - نشانگر متحرک که با ResizeObserver به‌روز می‌شود (responsive)
 * - انیمیشن جمع/پهن محتوا
 */
export function ScopedTabs({ tabs, activeKey, onChange, children }: ScopedTabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ right: number; width: number }>({
    right: 0,
    width: 0,
  });
  const [displayChildren, setDisplayChildren] = useState<ReactNode>(children);
  const [phase, setPhase] = useState<"in" | "out">("in");

  // محاسبه موقعیت نشانگر — به عنوان callback تا هم useLayoutEffect هم ResizeObserver بتوانند صدا بزنند
  const recalcIndicator = useCallback(() => {
    const el = tabRefs.current[activeKey];
    const container = containerRef.current;
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setIndicator({
      right: containerRect.right - rect.right,
      width: rect.width,
    });
  }, [activeKey]);

  // محاسبه اولیه و هنگام تغییر activeKey
  useLayoutEffect(() => {
    recalcIndicator();
  }, [recalcIndicator]);

  // ResizeObserver برای واکنش به تغییر اندازه صفحه
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      recalcIndicator();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalcIndicator]);

  // انیمیشن تعویض محتوا
  useEffect(() => {
    setPhase("out");
    const timer = window.setTimeout(() => {
      setDisplayChildren(children);
      setPhase("in");
    }, 200);
    return () => window.clearTimeout(timer);
  }, [children]);

  return (
    <div>
      {/* نوار تب */}
      <div
        ref={containerRef}
        className="relative flex gap-1 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm"
      >
        {/* نشانگر متحرک */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 top-2 rounded-2xl bg-[#062452] transition-all duration-400 ease-out"
          style={{ right: indicator.right, width: indicator.width }}
        />
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-xs font-black transition-colors duration-400 sm:gap-2 sm:px-4 sm:text-sm ${
                isActive ? "text-white" : "text-[#062452] hover:text-emerald-700"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split("‌")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* محتوا */}
      <div
        className="mt-5 transition-all duration-250 ease-out"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(6px)",
        }}
      >
        {displayChildren}
      </div>
    </div>
  );
}
