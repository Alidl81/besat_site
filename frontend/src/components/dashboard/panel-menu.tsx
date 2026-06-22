"use client";

import Link from "next/link";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { useEffect, useState } from "react";
import type { PanelData } from "@/components/dashboard/panel-data";

type PanelMenuProps = {
  data: PanelData;
  activeKey: string;
};

function AnimatedHamburger({ isOpen }: { isOpen: boolean }) {
  return (
    <span className="relative block h-5 w-6">
      <span
        className={`absolute right-0 top-0 h-0.5 w-6 rounded-full bg-current transition duration-500 ease-out ${
          isOpen ? "translate-y-2 rotate-45" : "translate-y-0 rotate-0"
        }`}
      />
      <span
        className={`absolute right-0 top-2 h-0.5 w-6 rounded-full bg-current transition duration-300 ease-out ${
          isOpen ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
        }`}
      />
      <span
        className={`absolute right-0 top-4 h-0.5 w-6 rounded-full bg-current transition duration-500 ease-out ${
          isOpen ? "-translate-y-2 -rotate-45" : "translate-y-0 rotate-0"
        }`}
      />
    </span>
  );
}

export function PanelMenu({ data, activeKey }: PanelMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "بستن منو" : "باز کردن منو"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className={`flex size-12 items-center justify-center rounded-2xl text-white shadow-sm transition duration-500 ${
          isOpen
            ? "fixed right-4 top-4 z-[70] bg-white/10 backdrop-blur hover:bg-white/15"
            : "relative z-10 bg-[#062452] hover:bg-[#0b3068]"
        }`}
      >
        <AnimatedHamburger isOpen={isOpen} />
      </button>

      <div
        className={`fixed inset-0 z-50 transition duration-500 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="بستن منو"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-0 h-dvh w-screen bg-slate-950/35 backdrop-blur-sm"
        />

        <aside
          dir="rtl"
          className={`absolute right-0 top-0 z-10 flex h-dvh w-[min(22rem,86vw)] flex-col overflow-hidden bg-[#062452] px-4 py-5 text-white shadow-2xl transition duration-500 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-5 flex shrink-0 items-center gap-3 pr-14">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-white text-2xl font-black text-[#062452] shadow-xl">
              ب
            </div>

            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-xl font-black text-white">مدرسه بعثت</p>
              <p className="mt-1 truncate text-xs font-bold text-white/65">
                سیستم مدیریت مدرسه
              </p>
            </div>
          </div>

          <div className="mb-4 shrink-0 rounded-[1.4rem] border border-white/10 bg-white/10 p-3">
            <p className="text-right text-xs font-bold text-white/65">نقش کاربری</p>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg text-white">
                ▾
              </div>

              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-base font-black text-white">{data.roleTitle}</p>
              </div>
            </div>
          </div>

          <nav className="besat-panel-menu-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pl-1">
            {data.menu.map((item) => {
              const isActive = item.key === activeKey;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-black transition duration-500 ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-xl shadow-emerald-900/20"
                      : "text-white/82 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-white">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 shrink-0">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-white transition duration-500 hover:bg-white hover:text-[#062452]"
            >
              <span>بازگشت به سایت</span>
              <span>←</span>
            </Link>

            <p className="mt-4 text-center text-xs font-bold text-white/45">
              تمامی حقوق محفوظ است.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}






