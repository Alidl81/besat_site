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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" onClick={closeMenu}>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0f2f4a] text-sm font-bold text-white">
            ب
          </div>

          <div>
            <p className="text-base font-bold text-slate-950">مدرسه بعثت</p>
            <p className="text-xs text-slate-500">پیوند آموزش و بصیریت دینی</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-emerald-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <AppLink href="/registration">پیش‌ثبت‌نام</AppLink>
        </div>

        <button
          type="button"
          aria-label={isOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 md:hidden"
        >
          <span className="relative block h-5 w-5">
            <span
              className={`absolute right-0 top-1 block h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute right-0 top-2.5 block h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute right-0 top-4 block h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </Container>

      <div
        className={`overflow-hidden border-t border-slate-200 bg-white transition-all duration-300 md:hidden ${
          isOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <Container className="py-4">
          <nav className="grid gap-2 text-sm font-semibold text-slate-700">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="rounded-2xl px-4 py-3 transition hover:bg-emerald-50 hover:text-emerald-700"
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
        </Container>
      </div>
    </header>
  );
}
