"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { AppLink } from "@/components/shared/app-link";

const navItems = [
  { label: "صفحه اصلی", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "واحدها", href: "/units" },
  { label: "دپارتمان‌ها", href: "/departments" },
  { label: "اخبار", href: "/news" },
  { label: "گالری", href: "/gallery" },
  { label: "تماس", href: "/contact" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-4">
        <button
          type="button"
          aria-label={isOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="order-1 inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 md:hidden"
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
          className="order-2 flex min-w-0 items-center gap-3 md:order-1"
          onClick={closeMenu}
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f2f4a] text-sm font-bold text-white">
            ب
          </div>

          <div className="min-w-0 text-right">
            <p className="truncate text-base font-bold text-slate-950">مدرسه بعثت</p>
            <p className="truncate text-xs text-slate-500">پیوند آموزش و بصیریت دینی</p>
          </div>
        </Link>

        <nav className="order-2 hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-emerald-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="order-3 hidden md:block">
          <AppLink href="/registration">پیش‌ثبت‌نام</AppLink>
        </div>
      </Container>

      <div
        aria-hidden={!isOpen}
        onClick={closeMenu}
        className={`fixed inset-0 top-20 z-40 bg-slate-950/40 transition-opacity duration-300 md:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed right-0 top-20 z-50 h-[calc(100vh-5rem)] w-[82vw] max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <nav className="flex h-full flex-col gap-2 overflow-y-auto p-4 text-right text-sm font-semibold text-slate-700">
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
            پیش‌ثبت‌نام
          </Link>
        </nav>
      </aside>
    </header>
  );
}
