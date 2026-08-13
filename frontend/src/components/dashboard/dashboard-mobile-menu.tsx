"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DashboardPageData } from "@/components/dashboard/dashboard-data";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { BesatLogoMark } from "@/components/shared/besat-logo";

export function DashboardMobileMenu({
  data,
  activeKey,
}: {
  data: DashboardPageData;
  activeKey: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const scrollPosition = useRef(0);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overscrollBehavior: root.style.overscrollBehavior,
    };
    scrollPosition.current = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition.current}px`;
    body.style.width = "100%";
    root.style.overscrollBehavior = "none";

    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const trigger = triggerRef.current;
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      root.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollPosition.current);
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="panel-icon-button"
        aria-expanded={open}
        aria-controls="panel-mobile-menu"
        aria-label="باز کردن منو"
      >
        <PanelIcon name="dashboard" />
      </button>

      <div
        inert={open ? undefined : true}
        aria-hidden={!open}
        className={`fixed inset-0 z-[80] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="بستن منو"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-950/55 transition-opacity duration-[250ms] motion-reduce:duration-0 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          ref={drawerRef}
          id="panel-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="منوی پنل"
          className={`absolute right-0 top-0 flex h-dvh w-[min(88vw,22rem)] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:duration-0 motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <header className="flex items-center gap-3 border-b border-slate-100 bg-[#082f57] p-4 text-white">
            <BesatLogoMark size="sm" tone="light" className="!h-12 !w-12" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">مجتمع آموزشی بعثت</p>
              <p className="mt-1 text-[11px] font-bold text-white/65">
                {data.roleTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-11 items-center justify-center rounded-lg border border-white/20 bg-white/10"
              aria-label="بستن منو"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <nav
            className="grid min-h-0 flex-1 gap-1 overflow-y-auto p-3"
            aria-label="منوی پنل"
          >
            {data.menu.filter((item) => !item.hidden).map((item) => {
              const active = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`dashboard-sidebar-link !text-[#0a2b50] hover:!bg-[#f6f0e7] ${active ? "!bg-[#f6e7cf]" : ""}`}
                >
                  <PanelIcon name={item.icon} className="size-[1.25rem] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <footer className="border-t border-slate-200 p-3">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="dashboard-sidebar-link !text-[#0a2b50] hover:!bg-[#f6f0e7]"
            >
              <PanelIcon name="globe" className="size-[1.25rem]" />
              <span>بازگشت به سایت</span>
            </Link>
          </footer>
        </aside>
      </div>
    </div>
  );
}
