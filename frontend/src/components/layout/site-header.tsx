"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/shared/container";

const navItems = [
  { label: "خانه", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "واحدها", href: "/units" },
  { label: "دپارتمان‌ها", href: "/departments" },
  { label: "اخبار و اطلاعیه‌ها", href: "/news" },
  { label: "گالری", href: "/gallery" },
  { label: "تماس با ما", href: "/contact" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-center gap-4 lg:justify-between">
        <button
          type="button"
          aria-label={isOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="absolute right-4 top-1/2 inline-flex size-11 -translate-y-1/2 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a] transition hover:bg-slate-50 lg:hidden"
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
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 lg:static lg:translate-x-0 lg:translate-y-0 lg:gap-3"
          onClick={closeMenu}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-sm font-black text-emerald-700">
            ب
          </div>

          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-black text-[#0f2f4a] md:text-base">مدرسه بعثت</p>
            <p className="truncate text-[11px] text-slate-500">پیوند آموزش و بصیریت دینی</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-bold text-slate-700 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-emerald-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/registration"
            className="rounded-xl bg-[#0f2f4a] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#143d5f]"
          >
            ثبت‌نام آنلاین
          </Link>
        </div>
      </Container>

      <div
        aria-hidden={!isOpen}
        onClick={closeMenu}
        className={`fixed inset-0 top-16 z-40 bg-slate-950/40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed right-0 top-16 z-50 h-[calc(100vh-4rem)] w-[82vw] max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <nav className="flex h-full flex-col gap-2 overflow-y-auto p-4 text-right text-sm font-bold text-slate-700">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="rounded-2xl px-4 py-3 text-right transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/registration"
            onClick={closeMenu}
            className="mt-2 rounded-2xl bg-[#0f2f4a] px-4 py-3 text-center text-white transition hover:bg-[#143d5f]"
          >
            ثبت‌نام آنلاین
          </Link>
        </nav>
      </aside>
    </header>
  );
}
