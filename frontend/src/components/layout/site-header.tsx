"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/shared/container";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { SiteAuthActions } from "@/components/auth/site-auth-actions";

type HeaderLinkItem = {
  label: string;
  href: string;
  description?: string;
};

const navItems = [
  { label: "خانه", href: "/" },
  { label: "اخبار", href: "/news" },
  { label: "گالری", href: "/gallery" },
  { label: "درباره ما", href: "/about" },
  { label: "تماس با ما", href: "/contact" },
];

const branchItems: HeaderLinkItem[] = [
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

const besatFamilyItems: HeaderLinkItem[] = [
  {
    label: "روابط عمومی مدارس بعثت",
    href: "https://besat-r.com/",
    description: "سایت رسمی روابط عمومی مجموعه",
  },
  {
    label: "پیش‌ثبت‌نام مدارس بعثت",
    href: "https://besat-r.com/register.axd",
    description: "سامانه ثبت‌نام و معرفی واحدها",
  },
  {
    label: "دبیرستان بعثت",
    href: "https://www.besat-hs.ir/",
    description: "وب‌سایت رسمی دبیرستان بعثت",
  },
  {
    label: "ثبت‌نام آزمون دبیرستان",
    href: "https://register.besat-hs.ir/",
    description: "سامانه ثبت‌نام آزمون ورودی",
  },
];

const relatedLinkItems: HeaderLinkItem[] = [
  {
    label: "وزارت آموزش و پرورش",
    href: "https://www.medu.gov.ir/",
    description: "پایگاه اطلاع‌رسانی آموزش و پرورش",
  },
  {
    label: "مای‌مدیو",
    href: "https://my.medu.ir/",
    description: "پنجره واحد خدمات آموزش و پرورش",
  },
  {
    label: "سامانه شاد",
    href: "https://shad.ir/",
    description: "شبکه آموزشی دانش‌آموز",
  },
  {
    label: "کلاس مجازی شاد",
    href: "https://home.vc.shad.ir/",
    description: "کلاس آنلاین و ابزارهای آموزشی شاد",
  },
];

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function isActivePath(pathname: string, href: string) {
  if (isExternalHref(href)) return false;
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
      className="group relative whitespace-nowrap px-0.5 py-2 text-[13px] font-black text-[#062452] transition duration-500 hover:text-emerald-700"
    >
      <span className="font-bold text-sm">{label}</span>
      <span
        className={`absolute bottom-0 right-0 h-0.5 rounded-full bg-emerald-500 transition-all duration-500 ${
          isActive ? "w-full" : "w-0 group-hover:w-full"
        }`}
      />
    </Link>
  );
}

function DesktopDropdownItem({
  item,
  pathname,
}: {
  item: HeaderLinkItem;
  pathname: string;
}) {
  const itemIsActive = isActivePath(pathname, item.href);
  const className = `group/item block rounded-[1rem] px-4 py-3 transition duration-300 ${
    itemIsActive
      ? "bg-emerald-50 text-emerald-700"
      : "text-[#062452] hover:bg-slate-50 hover:text-emerald-700"
  }`;

  const content = (
    <span className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-bold">{item.label}</span>
        {item.description ? (
          <span className="mt-1 block text-xs font-bold leading-6 text-slate-400">
            {item.description}
          </span>
        ) : null}
      </span>

      <span className="text-slate-300 transition group-hover/item:text-emerald-500">
        ↗
      </span>
    </span>
  );

  if (isExternalHref(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function DesktopDropdown({
  dropdownKey,
  label,
  items,
  pathname,
  activeDropdown,
  setActiveDropdown,
  isActive = false,
}: {
  dropdownKey: string;
  label: string;
  items: HeaderLinkItem[];
  pathname: string;
  activeDropdown: string | null;
  setActiveDropdown: React.Dispatch<React.SetStateAction<string | null>>;
  isActive?: boolean;
}) {
  const isOpen = activeDropdown === dropdownKey;

  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveDropdown(dropdownKey)}
      onMouseLeave={() => {
        setActiveDropdown((current) => current === dropdownKey ? null : current);
      }}
      onFocus={() => setActiveDropdown(dropdownKey)}
      onBlur={(event) => {
        const nextFocusTarget = event.relatedTarget;

        if (!(nextFocusTarget instanceof Node) || !event.currentTarget.contains(nextFocusTarget)) {
          setActiveDropdown((current) => current === dropdownKey ? null : current);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        className="group relative flex appearance-none items-center gap-1 whitespace-nowrap bg-transparent px-0.5 py-2 font-[inherit] text-[clamp(0.68rem,0.72vw,0.875rem)] font-black leading-none tracking-normal text-[#062452] transition duration-500 hover:text-emerald-700 focus:outline-none focus-visible:text-emerald-700"
      >
        <span className="font-bold text-sm">{label}</span>

        <ChevronIcon
          className={`size-[0.95em] shrink-0 transition duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />

        <span
          className={`absolute bottom-0 right-0 h-0.5 rounded-full bg-emerald-500 transition-all duration-500 ${
            isActive || isOpen ? "w-full" : "w-0 group-hover:w-full group-focus-visible:w-full"
          }`}
        />
      </button>

      <div
        className={`absolute right-1/2 top-full z-50 w-80 translate-x-1/2 pt-4 transition duration-300 ${
          isOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-2 text-right shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          {items.map((item) => (
            <DesktopDropdownItem
              key={`${item.href}-${item.label}`}
              item={item}
              pathname={pathname}
            />
          ))}
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

function MobileDropdownItem({
  item,
  pathname,
  onLinkClick,
}: {
  item: HeaderLinkItem;
  pathname: string;
  onLinkClick: () => void;
}) {
  const itemIsActive = isActivePath(pathname, item.href);
  const className = `block rounded-2xl px-4 py-3 text-right transition duration-500 ${
    itemIsActive
      ? "bg-white text-emerald-700 shadow-sm"
      : "bg-white/70 text-[#062452] hover:bg-white hover:text-emerald-700"
  }`;

  const content = (
    <>
      <span className="block text-sm font-black">{item.label}</span>
      {item.description ? (
        <span className="mt-1 block text-xs font-bold leading-6 text-slate-400">
          {item.description}
        </span>
      ) : null}
    </>
  );

  if (isExternalHref(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className} onClick={onLinkClick}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onLinkClick} className={className}>
      {content}
    </Link>
  );
}

function MobileDropdownMenu({
  label,
  items,
  pathname,
  onLinkClick,
  isActive = false,
}: {
  label: string;
  items: HeaderLinkItem[];
  pathname: string;
  onLinkClick: () => void;
  isActive?: boolean;
}) {
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
        <span>{label}</span>
        <ChevronIcon className="transition duration-300 group-open:rotate-180" />
      </summary>

      <div className="grid gap-2 px-2 pb-2">
        {items.map((item) => (
          <MobileDropdownItem
            key={`${item.href}-${item.label}`}
            item={item}
            pathname={pathname}
            onLinkClick={onLinkClick}
          />
        ))}
      </div>
    </details>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDesktopDropdown, setActiveDesktopDropdown] = useState<string | null>(null);
  const branchesActive = isBranchesActive(pathname);

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
          <div className="hidden h-full w-full items-center justify-between gap-3 xl:flex">
            <div className="shrink-0">
              <LogoBlock />
            </div>

            <nav className="min-w-0 flex-1">
              <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-3 overflow-visible rounded-full border border-slate-200 bg-white px-6 py-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                <DesktopNavLink href="/" label="خانه" isActive={isActivePath(pathname, "/")} />

                <DesktopDropdown
                  dropdownKey="branches"
                  label="شعب"
                  items={branchItems}
                  pathname={pathname}
                  activeDropdown={activeDesktopDropdown}
                  setActiveDropdown={setActiveDesktopDropdown}
                  isActive={branchesActive}
                />

                <DesktopDropdown
                  dropdownKey="besat-family"
                  label="خانواده بعثت"
                  items={besatFamilyItems}
                  pathname={pathname}
                  activeDropdown={activeDesktopDropdown}
                  setActiveDropdown={setActiveDesktopDropdown}
                />

                <DesktopDropdown
                  dropdownKey="related-links"
                  label="لینک‌های مرتبط"
                  items={relatedLinkItems}
                  pathname={pathname}
                  activeDropdown={activeDesktopDropdown}
                  setActiveDropdown={setActiveDesktopDropdown}
                />

                {navItems.slice(1).map((item) => (
                  <DesktopNavLink
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    label={item.label}
                    isActive={isActivePath(pathname, item.href)}
                  />
                ))}
              </div>
            </nav>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Link
                href="/registration"
                className="besat-navy-button inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-[#12395b] px-4 text-[13px] font-black transition duration-500 hover:bg-[#0d2f4d]"
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
              <MobileNavLink
                href="/"
                label="خانه"
                isActive={isActivePath(pathname, "/")}
                onClick={() => setIsOpen(false)}
              />

              <MobileDropdownMenu
                label="شعب"
                items={branchItems}
                pathname={pathname}
                isActive={branchesActive}
                onLinkClick={() => setIsOpen(false)}
              />

              <MobileDropdownMenu
                label="خانواده بعثت"
                items={besatFamilyItems}
                pathname={pathname}
                onLinkClick={() => setIsOpen(false)}
              />

              <MobileDropdownMenu
                label="لینک‌های مرتبط"
                items={relatedLinkItems}
                pathname={pathname}
                onLinkClick={() => setIsOpen(false)}
              />

              {navItems.slice(1).map((item) => (
                <MobileNavLink
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  label={item.label}
                  isActive={isActivePath(pathname, item.href)}
                  onClick={() => setIsOpen(false)}
                />
              ))}
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