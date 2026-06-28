"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/shared/container";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { SiteAuthActions } from "@/components/auth/site-auth-actions";

const navItems = [
  { label: "خانه", href: "/" },
  { label: "اخبار", href: "/news" },
  { label: "اطلاعیه‌ها", href: "/announcements" },
  { label: "گالری", href: "/gallery" },
  { label: "درباره ما", href: "/about" },
  { label: "تماس با ما", href: "/contact" },
];

const branchItems = [
  {
    label: "واحدها",
    href: "/units",
    description: "واحدهای آموزشی مدرسه",
  },
  {
    label: "دپارتمان‌ها",
    href: "/departments",
    description: "دپارتمان‌های آموزشی و تربیتی",
  },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function isBranchesActive(pathname: string) {
  return branchItems.some((item) => isActivePath(pathname, item.href));
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AnimatedMenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span className="relative block h-5 w-6">
      <span
        className={`absolute right-0 top-0 h-0.5 w-6 rounded-full bg-current transition duration-500 ease-out ${
          isOpen ? "translate-y-2 rotate-45" : ""
        }`}
      />
      <span
        className={`absolute right-0 top-2 h-0.5 w-6 rounded-full bg-current transition duration-300 ease-out ${
          isOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        }`}
      />
      <span
        className={`absolute right-0 top-4 h-0.5 w-6 rounded-full bg-current transition duration-500 ease-out ${
          isOpen ? "-translate-y-2 -rotate-45" : ""
        }`}
      />
    </span>
  );
}

function LogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <BesatLogoMark size={compact ? "md" : "lg"} priority />

      <div className="text-right">
        <p className={`${compact ? "text-lg" : "text-xl"} font-black text-[#062452]`}>
          مدرسه بعثت
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          پیوند آموزش و بصیرت دینی
        </p>
      </div>
    </Link>
  );
}

function DesktopNavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative whitespace-nowrap px-1 py-2 text-sm font-black text-[#062452] transition duration-500 hover:text-emerald-700"
    >
      <span>{label}</span>
      <span
        className={`absolute bottom-0 right-0 h-0.5 rounded-full bg-emerald-500 transition-all duration-500 ${
          isActive ? "w-full" : "w-0 group-hover:w-full"
        }`}
      />
    </Link>
  );
}

function DesktopBranchesDropdown({ pathname }: { pathname: string }) {
  const isActive = isBranchesActive(pathname);

  return (
    <div className="group relative">
      <Link
        href="/units"
        className="group/branches relative flex items-center gap-1 whitespace-nowrap px-1 py-2 text-sm font-black text-[#062452] transition duration-500 hover:text-emerald-700 group-focus-within:text-emerald-700"
      >
        <ChevronIcon className="transition duration-300 group-hover:rotate-180 group-focus-within:rotate-180" />
        <span>شعب</span>
        <span
          className={`absolute bottom-0 right-0 h-0.5 rounded-full bg-emerald-500 transition-all duration-500 ${
            isActive ? "w-full" : "w-0 group-hover:w-full group-focus-within:w-full"
          }`}
        />
      </Link>

      <div className="invisible absolute right-1/2 top-full z-50 w-72 translate-x-1/2 pt-4 opacity-0 transition duration-300 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-2 text-right shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          {branchItems.map((item) => {
            const itemIsActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group/item block rounded-[1rem] px-4 py-3 transition duration-300 ${
                  itemIsActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-[#062452] hover:bg-slate-50 hover:text-emerald-700"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className="mt-1 block text-xs font-bold leading-6 text-slate-400">
                      {item.description}
                    </span>
                  </span>

                  <span className="text-slate-300 transition group-hover/item:text-emerald-500">
                    ↗
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileNavLink({
  href,
  label,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-2xl px-4 py-3 text-right text-base font-black transition duration-500 ${
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "text-[#062452] hover:bg-slate-50 hover:text-emerald-700"
      }`}
    >
      {label}
    </Link>
  );
}

function MobileBranchesMenu({
  pathname,
  onLinkClick,
}: {
  pathname: string;
  onLinkClick: () => void;
}) {
  const isActive = isBranchesActive(pathname);

  return (
    <details
      className={`group rounded-2xl transition duration-500 ${
        isActive ? "bg-emerald-50" : "bg-transparent"
      }`}
      open={isActive}
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 text-right text-base font-black transition duration-500 marker:hidden [&::-webkit-details-marker]:hidden ${
          isActive
            ? "text-emerald-700"
            : "text-[#062452] hover:bg-slate-50 hover:text-emerald-700"
        }`}
      >
        <span>شعب</span>
        <ChevronIcon className="transition duration-300 group-open:rotate-180" />
      </summary>

      <div className="grid gap-2 px-2 pb-2">
        {branchItems.map((item) => {
          const itemIsActive = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`block rounded-2xl px-4 py-3 text-right transition duration-500 ${
                itemIsActive
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "bg-white/70 text-[#062452] hover:bg-white hover:text-emerald-700"
              }`}
            >
              <span className="block text-sm font-black">{item.label}</span>
              <span className="mt-1 block text-xs font-bold leading-6 text-slate-400">
                {item.description}
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <header
        className="besat-site-header sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"
        dir="rtl"
      >
        <Container className="h-24">
          <div className="hidden h-full w-full items-center justify-between gap-5 xl:flex">
            <div className="shrink-0">
              <LogoBlock />
            </div>

            <nav className="min-w-0 flex-1">
              <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-4 overflow-visible rounded-full border border-slate-200 bg-white px-10 py-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                {navItems.map((item, index) => {
                  const isActive = isActivePath(pathname, item.href);

                  return (
                    <div key={`${item.href}-${item.label}`} className="contents">
                      {index === 1 ? <DesktopBranchesDropdown pathname={pathname} /> : null}

                      <DesktopNavLink
                        href={item.href}
                        label={item.label}
                        isActive={isActive}
                      />
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Link
                href="/registration"
                className="besat-navy-button inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full bg-[#12395b] px-5 text-sm font-black transition duration-500 hover:bg-[#0d2f4d]"
              >
                پیش‌ثبت‌نام آنلاین
              </Link>

              <SiteAuthActions />
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-between gap-4 xl:hidden">
            <button
              type="button"
              aria-label="باز کردن منو"
              aria-expanded={isOpen}
              onClick={() => setIsOpen(true)}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#062452] text-white shadow-sm transition duration-500 hover:bg-[#0b3068]"
            >
              <AnimatedMenuIcon isOpen={false} />
            </button>

            <LogoBlock compact />

            <div className="size-12 shrink-0" />
          </div>
        </Container>
      </header>

      <div
        className={`fixed inset-0 z-50 transition duration-500 ease-out xl:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="بستن منو"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(false)}
          className="fixed right-4 top-6 z-[70] flex size-12 items-center justify-center rounded-2xl bg-[#062452] text-white shadow-lg shadow-slate-950/20 transition duration-500 hover:bg-[#0b3068]"
        >
          <AnimatedMenuIcon isOpen={isOpen} />
        </button>

        <button
          type="button"
          aria-label="بستن منو"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-0 h-dvh w-screen bg-slate-950/30 backdrop-blur-sm"
        />

        <aside
          dir="rtl"
          className={`absolute right-0 top-0 z-10 flex h-dvh w-[min(26rem,92vw)] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-500 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="border-b border-slate-200 px-5 pb-5 pt-24">
            <LogoBlock compact />
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-2">
              {navItems.map((item, index) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <div key={`${item.href}-${item.label}`} className="space-y-2">
                    {index === 1 ? (
                      <MobileBranchesMenu
                        pathname={pathname}
                        onLinkClick={() => setIsOpen(false)}
                      />
                    ) : null}

                    <MobileNavLink
                      href={item.href}
                      label={item.label}
                      isActive={isActive}
                      onClick={() => setIsOpen(false)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-3">
              <Link
                href="/registration"
                onClick={() => setIsOpen(false)}
                className="besat-navy-button flex h-14 w-full items-center justify-center rounded-2xl bg-[#12395b] px-5 text-sm font-black transition duration-500 hover:bg-[#0d2f4d]"
              >
                پیش‌ثبت‌نام آنلاین
              </Link>

              <SiteAuthActions />
            </div>
          </nav>
        </aside>
      </div>
    </>
  );
}


