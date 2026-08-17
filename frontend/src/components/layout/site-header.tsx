"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SiteAuthActions } from "@/components/auth/site-auth-actions";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { CartWidget } from "@/components/shop/cart-drawer";

type HeaderItem = { label: string; href: string; description?: string };
type DropdownProps = {
  menuKey: string;
  label: string;
  items: HeaderItem[];
  pathname: string;
  openMenu: string | null;
  setOpenMenu: Dispatch<SetStateAction<string | null>>;
};

const mainItems: HeaderItem[] = [
  { label: "صفحه نخست", href: "/" },
  { label: "معرفی بعثت", href: "/about" },
  { label: "فروشگاه", href: "/shop" },
  { label: "اخبار", href: "/news" },
  { label: "افتخارات", href: "/achievements" },
  { label: "گالری", href: "/gallery" },
  { label: "تماس با ما", href: "/contact" },
];

const educationItems: HeaderItem[] = [
  { label: "واحدهای آموزشی", href: "/units", description: "مشاهده و انتخاب واحدهای مجتمع" },
  { label: "دپارتمان‌های تخصصی", href: "/departments", description: "برنامه‌های آموزشی، مهارتی و تربیتی" },
];

const menus = [
  { key: "branches", label: "شعب", items: educationItems },
];

function external(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}
function activePath(pathname: string, href: string) {
  if (external(href)) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-3.5 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DropdownItem({ item, pathname }: { item: HeaderItem; pathname: string }) {
  const cls = `besat-dropdown-item group/item flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-right transition-all duration-300 ${activePath(pathname, item.href) ? "bg-[#f8efe1]" : "hover:translate-x-[-3px] hover:bg-[#f3f6f8]"}`;
  const body = (
    <>
      <span>
        <span className="besat-dropdown-title block text-[14px] font-black leading-6">{item.label}</span>
        {item.description ? <span className="besat-dropdown-description mt-1 block text-[12px] font-bold leading-6">{item.description}</span> : null}
      </span>
      <span className="besat-dropdown-arrow translate-x-1 text-lg opacity-0 transition-all duration-300 group-hover/item:translate-x-0 group-hover/item:opacity-100">←</span>
    </>
  );
  return external(item.href) ? <a href={item.href} target="_blank" rel="noreferrer" className={cls}>{body}</a> : <Link href={item.href} className={cls}>{body}</Link>;
}

function DesktopDropdown({ menuKey, label, items, pathname, openMenu, setOpenMenu }: DropdownProps) {
  const open = openMenu === menuKey;
  const active = items.some((item) => activePath(pathname, item.href));
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenMenu(menuKey)}
      onMouseLeave={() => setOpenMenu((current) => current === menuKey ? null : current)}
      onFocus={() => setOpenMenu(menuKey)}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setOpenMenu((current) => current === menuKey ? null : current);
        }
      }}
    >
      <button type="button" aria-expanded={open} data-open={open} onClick={() => setOpenMenu(open ? null : menuKey)}
        className={`besat-menu-trigger group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-2 text-[13px] font-black transition-all duration-300 2xl:px-3 2xl:text-[14px] ${open || active ? "bg-white/14 text-white" : "text-white/90 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"}`}>
        <span className={`absolute inset-0 origin-bottom bg-[linear-gradient(135deg,rgba(226,174,91,.2),rgba(255,255,255,.03))] transition-transform duration-500 ${open ? "scale-y-100" : "scale-y-0"}`} />
        <span className="relative">{label}</span><span className="relative"><Chevron open={open} /></span>
        <span className={`absolute inset-x-3 -bottom-1 h-0.5 origin-right rounded-full bg-[#e2ae5b] transition-transform duration-500 ${open || active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
      </button>
      <div data-open={open} className={`besat-dropdown-panel absolute right-1/2 top-full z-50 w-[20rem] translate-x-1/2 pt-3 ${open ? "visible pointer-events-auto" : "invisible pointer-events-none opacity-0"}`}>
        <div className="besat-dropdown-surface overflow-hidden rounded-2xl border p-2 shadow-[0_24px_70px_rgba(3,15,30,.28)] backdrop-blur-xl">
          <div className="besat-dropdown-heading mb-1 flex items-center gap-2 border-b px-4 py-2.5 text-[11px] font-black">
            <span className="h-px w-5 bg-current" />{label}
          </div>
          {items.map((item, index) => (
            <div key={item.href} style={{ transitionDelay: open ? `${index * 35}ms` : "0ms" }} className={`transition-all duration-300 ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}>
              <DropdownItem item={item} pathname={pathname} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return <span className="relative block h-5 w-6" aria-hidden="true">
    <span className={`absolute right-0 top-0 h-0.5 w-6 rounded-full bg-current transition duration-500 ${open ? "translate-y-2 rotate-45" : ""}`} />
    <span className={`absolute right-0 top-2 h-0.5 w-6 rounded-full bg-current transition duration-300 ${open ? "scale-x-0 opacity-0" : ""}`} />
    <span className={`absolute right-0 top-4 h-0.5 w-6 rounded-full bg-current transition duration-500 ${open ? "-translate-y-2 -rotate-45" : ""}`} />
  </span>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="صفحه نخست مجتمع بعثت">
    <span className="transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-105">
      <BesatLogoMark size="sm" tone="light" className={compact ? "!h-11 !w-11" : "!h-14 !w-14"} />
    </span>
    <span className="text-right text-white">
      <span className={`block whitespace-nowrap font-black leading-none ${compact ? "text-base" : "text-[17px]"}`}>مجتمع آموزشی بعثت</span>
      <span className="mt-1.5 block whitespace-nowrap text-[10px] font-bold text-white/68">پیوند آموزش و بصیرت دینی</span>
    </span>
  </Link>;
}

function MobileAccordion({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: HeaderItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(items.some((item) => activePath(pathname, item.href)));
  return <div className={`overflow-hidden rounded-xl border transition-all duration-300 ${open ? "border-white/15 bg-white/[.07]" : "border-transparent bg-white/[.035]"}`}>
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3.5 text-right text-[15px] font-black">
      {label}<Chevron open={open} />
    </button>
    <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden"><div className="grid gap-1 px-2 pb-2">
        {items.map((item) => {
          const cls = "rounded-lg px-3 py-2.5 text-[13px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white";
          return external(item.href) ? <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={cls} onClick={onNavigate}>{item.label}</a> : <Link key={item.href} href={item.href} className={cls} onClick={onNavigate}>{item.label}</Link>;
        })}
      </div></div>
    </div>
  </div>;
}

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isShopRoute = pathname.startsWith("/shop");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    if (!mobileOpen) return () => { document.body.style.overflow = ""; };

    const drawer = mobileDrawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const trigger = mobileTriggerRef.current;
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
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
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const transparentHero = isHome && !scrolled;

  return <>
    <header
      dir="rtl"
      className={`besat-site-header sticky top-0 z-50 w-full text-white transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        transparentHero
          ? "border-b border-transparent bg-transparent xl:bg-gradient-to-b xl:from-[#06172c]/90 xl:via-[#06172c]/45 xl:to-transparent"
          : "border-b border-white/10 bg-[#081d35]/97 shadow-lg backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto hidden h-20 w-full max-w-[1840px] items-center justify-between gap-4 px-6 xl:flex 2xl:px-10">
        <div className="flex min-w-0 shrink-0 items-center gap-8 2xl:gap-10">
          <Logo />
          <nav className="flex min-w-0 items-center gap-0.5 2xl:gap-1">
            <Link href="/" className={`rounded-lg px-2.5 py-2 text-[13px] font-black transition-all duration-300 2xl:px-3 2xl:text-[14px] ${pathname === "/" ? "bg-white/14 text-white" : "text-white/90 hover:bg-white/10"}`}>صفحه نخست</Link>
            {menus.map((menu) => <DesktopDropdown key={menu.key} menuKey={menu.key} label={menu.label} items={menu.items} pathname={pathname} openMenu={openMenu} setOpenMenu={setOpenMenu} />)}
            {mainItems.slice(1).map((item) => <Link key={item.href} href={item.href} className={`rounded-lg px-2.5 py-2 text-[13px] font-black transition-all duration-300 2xl:px-3 2xl:text-[14px] ${activePath(pathname, item.href) ? "bg-white/14 text-white" : "text-white/90 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 2xl:gap-3">
          {isShopRoute ? <CartWidget /> : null}
          <SiteAuthActions />
          <Link href="/registration" className="inline-flex h-11 min-w-[132px] items-center justify-center rounded-xl bg-[#e2ae5b] px-5 text-[13px] font-black text-[#0b213c] shadow-[0_10px_22px_rgba(226,174,91,.24)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-[#edc57f] 2xl:text-[14px]">ثبت‌نام آنلاین</Link>
        </div>
      </div>

      <div className="mx-auto flex h-[calc(62px+env(safe-area-inset-top))] max-w-7xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6 xl:hidden">
        <button ref={mobileTriggerRef} type="button" onClick={() => setMobileOpen((value) => !value)} className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition hover:bg-white/20" aria-expanded={mobileOpen} aria-controls="site-mobile-menu" aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}><MenuIcon open={mobileOpen} /></button>
        <Logo compact />
        {isShopRoute ? <CartWidget /> : <span className="size-10" aria-hidden="true" />}
      </div>
    </header>

    <div inert={mobileOpen ? undefined : true} className={`fixed inset-0 z-[60] xl:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
      <button type="button" tabIndex={-1} onClick={() => setMobileOpen(false)} aria-label="بستن منو" className={`absolute inset-0 bg-[#04101f]/75 backdrop-blur-sm transition-opacity duration-[250ms] motion-reduce:duration-0 motion-reduce:transition-none ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
      <aside ref={mobileDrawerRef} id="site-mobile-menu" role="dialog" aria-modal="true" aria-label="منوی اصلی" dir="rtl" className={`absolute right-0 top-0 flex h-dvh w-[min(90vw,25rem)] flex-col bg-[#0a2039] p-5 text-white shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:duration-0 motion-reduce:transition-none ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-5"><Logo compact /><button onClick={() => setMobileOpen(false)} className="flex size-10 items-center justify-center rounded-xl bg-white/10" aria-label="بستن"><MenuIcon open /></button></div>
        <nav className="mt-5 grid gap-2 overflow-y-auto pb-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="rounded-xl bg-white/[.035] px-4 py-3 text-sm font-black">صفحه نخست</Link>
          {menus.map((menu) => <MobileAccordion key={menu.key} label={menu.label} items={menu.items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
          {mainItems.slice(1).map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-xl bg-white/[.035] px-4 py-3 text-sm font-black text-white/82 transition hover:bg-white/10">{item.label}</Link>)}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-white/10 pt-4">
          <SiteAuthActions />
          <Link href="/registration" onClick={() => setMobileOpen(false)} className="block rounded-xl bg-[#e2ae5b] px-4 py-3 text-center text-sm font-black text-[#0b213c]">پیش‌ثبت‌نام آنلاین</Link>
        </div>
      </aside>
    </div>
  </>;
}
