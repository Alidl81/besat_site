"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/shared/container";

const navItems = [
  { label: "خانه", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "واحدها", href: "/units" },
  { label: "دپارتمان‌ها", href: "/departments" },
  { label: "اخبار", href: "/news" },
  { label: "اطلاعیه‌ها", href: "/announcements" },
  { label: "گالری", href: "/gallery" },
  { label: "تماس با ما", href: "/contact" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white/92 backdrop-blur-md">
      <div className="h-1 w-full bg-[linear-gradient(90deg,#0f2f4a,#16a36a,#0f2f4a)]" />

      <div className="border-b border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <Container className="relative">
          <div className="relative flex h-[84px] items-center justify-center lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8">
            <button
              type="button"
              aria-label={isOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={isOpen}
              onClick={() => setIsOpen((current) => !current)}
              className="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a] shadow-sm transition hover:bg-slate-50 lg:hidden"
            >
              <span className="relative block h-5 w-5">
                <span
                  className={`absolute right-0 top-1 block h-0.5 w-5 rounded-full bg-current transition duration-200 ${
                    isOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute right-0 top-2.5 block h-0.5 w-5 rounded-full bg-current transition duration-200 ${
                    isOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`absolute right-0 top-4 block h-0.5 w-5 rounded-full bg-current transition duration-200 ${
                    isOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </span>
            </button>

            <Link
              href="/"
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 lg:static lg:translate-x-0 lg:translate-y-0"
              onClick={closeMenu}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#ecfdf5,#d1fae5)] text-base font-black text-emerald-700 shadow-sm">
                ب
              </div>

              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-lg font-black tracking-tight text-[#0f2f4a]">
                  مدرسه بعثت
                </p>
                <p className="truncate text-xs text-slate-500">
                  پیوند آموزش و بصیریت دینی
                </p>
              </div>
            </Link>

            <nav className="hidden items-center justify-center lg:flex">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-2 shadow-sm">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="besat-nav-link rounded-full px-4 py-2.5 text-sm font-bold"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                تماس سریع
              </Link>

              <Link
                href="/registration"
                className="besat-navy-button inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black transition duration-300"
              >
                ثبت‌نام آنلاین
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <div
        aria-hidden={!isOpen}
        onClick={closeMenu}
        className={`fixed inset-0 top-[85px] z-40 bg-slate-950/40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed right-0 top-[85px] z-50 h-[calc(100vh-85px)] w-[84vw] max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-sm font-black text-emerald-700">
              ب
            </div>

            <div className="text-right">
              <p className="text-sm font-black text-[#0f2f4a]">مدرسه بعثت</p>
              <p className="text-xs text-slate-500">پیوند آموزش و بصیریت دینی</p>
            </div>
          </div>
        </div>

        <nav className="flex h-full flex-col gap-2 overflow-y-auto p-4 text-right text-sm font-bold text-slate-700">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="besat-mobile-link rounded-2xl px-4 py-3"
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-3 grid gap-3">
            <Link
              href="/contact"
              onClick={closeMenu}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              تماس سریع
            </Link>

            <Link
              href="/registration"
              onClick={closeMenu}
              className="besat-navy-button rounded-2xl px-4 py-3 text-center text-sm font-black transition duration-300"
            >
              ثبت‌نام آنلاین
            </Link>
          </div>
        </nav>
      </aside>
    </header>
  );
}

