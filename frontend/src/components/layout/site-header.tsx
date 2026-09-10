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
import { useHeroVisibility } from "@/lib/home/hero-visibility-context";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenMenu(menuKey)}
      onMouseLeave={() => setOpenMenu((current) => current === menuKey ? null : current)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpenMenu(null);
          triggerRef.current?.focus();
        }
      }}
      onFocus={(event) => {
        // A mouse click on the trigger button also fires a native focus
        // event (focus arrives before click in the browser's event
        // order). Opening unconditionally here raced with the button's
        // own onClick toggle below: onFocus opened the menu, then by the
        // time the click event's handler ran (after the focus-triggered
        // re-render already flipped `open` to true), its own
        // open-vs-toggle logic closed it again -- net result, one real
        // click never visibly opened the menu (see
        // FE-NAV-DESKTOP-DROPDOWN-CLICK-001). Only opening for
        // keyboard-driven focus (:focus-visible is false for a focus that
        // arrived from a pointer click in every current browser) leaves
        // the click handler as the sole authority over click-driven
        // opens, while Tab-focus still opens the panel for keyboard users.
        if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
          setOpenMenu(menuKey);
        }
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setOpenMenu((current) => current === menuKey ? null : current);
        }
      }}
    >
      <button ref={triggerRef} type="button" aria-expanded={open} data-open={open} onClick={() => setOpenMenu(open ? null : menuKey)}
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
    {/* FE-A11Y-MOBILE-ACCORDION-HIDDEN-TAB-001: the collapse is CSS-only
        (grid-template-rows/opacity, so the open transition keeps animating
        smoothly) and previously left the collapsed links reachable via Tab
        even though they're visually gone. `inert` removes the whole
        subtree from the tab order and the accessibility tree without
        unmounting it -- unlike `hidden`/conditional mounting, it doesn't
        interrupt the CSS transition on either open or close. */}
    <div inert={open ? undefined : true} className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
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
  // Same fix and history as the dashboard mobile menu's
  // FE-DASH-MOBILE-CLOSED-OVERFLOW-001: an always-mounted
  // translate-x-full-when-closed drawer still contributes to
  // documentElement.scrollWidth even with overflow-hidden on this
  // wrapper -- only fully removing it from the DOM while closed works.
  // `mobileVisible` mounts the overlay; `mobileSlideOpen` (deferred one
  // frame after mount) drives the actual transform/opacity so the
  // slide-in entrance animation still plays instead of skipping straight
  // to its open state on first paint.
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileSlideOpen, setMobileSlideOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  // FE-MOBILE-MENU-OPEN-REGRESSION-001: an earlier revision moved this
  // synchronous mirroring of `mobileOpen` into React's "adjust state
  // during render" pattern specifically to satisfy the
  // react-hooks/set-state-in-effect lint rule below -- that produced a
  // real regression (clicking the trigger set aria-expanded=true but no
  // dialog ever mounted). Reverted to this plain, well-understood effect
  // that mirrors `mobileOpen` into `mobileVisible`/`mobileSlideOpen` a
  // render behind (after commit, not during render) -- nothing here
  // needs the drawer to exist within the SAME render `mobileOpen` flips
  // in, so the lint rule's usual concern doesn't apply; suppressed
  // deliberately rather than risk another subtle bug chasing the rule a
  // second time.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mobileOpen) {
      setMobileVisible(true);
      return;
    }
    setMobileSlideOpen(false);
    const timer = window.setTimeout(() => setMobileVisible(false), 250);
    return () => window.clearTimeout(timer);
  }, [mobileOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // FE-MOBILE-MENU-RAPID-REOPEN-001: this used to be keyed on `mobileVisible`
  // instead of `mobileOpen` -- normally fine, since `mobileVisible` flips
  // false->true in the same tick `mobileOpen` does. But if the close
  // transition's 250ms unmount timer above is still pending when the user
  // reopens (close, then immediately click the trigger again), the cleanup
  // for the `[mobileOpen]` effect cancels that timer and `mobileVisible`
  // was ALREADY true the whole time -- it never transitions, so this effect
  // never re-ran and `mobileSlideOpen` stayed stuck at the `false` the close
  // click had just set, leaving the drawer mounted with `aria-expanded=true`
  // but still visually at `translate-x-full`. Keying on `mobileOpen`
  // directly fixes this: it re-fires on every reopen regardless of whether
  // `mobileVisible` happened to already be true, and by the time this
  // frame's callback runs, `mobileVisible` is guaranteed already true (set
  // synchronously in the same commit by the effect above), so the drawer
  // exists in the DOM to receive the class flip.
  useEffect(() => {
    if (!mobileOpen) return;
    const frame = window.requestAnimationFrame(() => setMobileSlideOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileOpen]);

  // FE-PUBLIC-MOBILE-MENU-SCROLL-LOCK-001: this previously only set
  // `body.style.overflow = "hidden"`, which stops BODY's own scrollbar
  // but does nothing about the root/viewport itself -- wheel and
  // programmatic scrollTo could still move the page behind the open
  // dialog, with a visible scrollbar-gap strip left over. Adopted the
  // same position:fixed + scroll-offset + root overscroll-behavior lock
  // already used correctly by the dashboard mobile menu (which was never
  // flagged for this).
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = mobileTriggerRef.current;
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overscrollBehavior: root.style.overscrollBehavior,
    };
    const scrollY = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    root.style.overscrollBehavior = "none";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      root.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKeyDown);
      // preventScroll: without it, the browser's own default
      // focus-scroll-into-view behavior runs right after the manual
      // window.scrollTo(0, scrollY) above and overrides it, landing the
      // page at wherever the trigger happens to sit rather than the
      // pre-open scroll position (see
      // FE-PUBLIC-MOBILE-MENU-SCROLL-LOCK-001's REOPEN).
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  // FE-MOBILE-MENU-FOCUS-TRAP-001: originally keyed on `mobileVisible`
  // instead of `mobileOpen` so it would only run once the drawer genuinely
  // exists in the DOM (mobileDrawerRef.current was still null on the same
  // render `mobileOpen` first flips true). That fix has the same defect as
  // FE-MOBILE-MENU-RAPID-REOPEN-001's slideOpen effect: on a close
  // immediately followed by a reopen, `mobileVisible` was already `true`
  // the whole time and never transitions, so this effect never re-fires --
  // focus is never pulled back into the reopened dialog, leaving it on
  // whatever was focused before (observed: the first Tab lands on an
  // outside header link instead of being trapped).
  //
  // A first attempt fixed this by keying on `mobileOpen` alone and
  // deferring the ref read via requestAnimationFrame, mirroring the
  // slideOpen effect -- but unlike slideOpen (which only calls a state
  // setter, safe regardless of DOM timing), this effect reads
  // mobileDrawerRef.current directly, and a disposable regression test
  // proved the scheduled animation frame can fire BEFORE the cascading
  // `mobileVisible` update has actually committed the drawer into the DOM,
  // leaving the ref null. The robust fix instead keys on BOTH `mobileOpen`
  // and `mobileVisible`, only doing the work once both are true: on a
  // normal open this naturally re-fires once `mobileVisible` catches up
  // (no rAF needed, no timing assumption); on a rapid reopen, `mobileOpen`
  // becoming true again is itself a dependency change that re-fires this
  // effect immediately, and `mobileVisible` is already `true` by then, so
  // the guard passes right away.
  useEffect(() => {
    if (!mobileOpen || !mobileVisible) return;
    const drawer = mobileDrawerRef.current;
    // FE-A11Y-MOBILE-ACCORDION-HIDDEN-TAB-001: querySelectorAll has no
    // concept of `inert` -- a collapsed MobileAccordion's links still
    // structurally match this selector even though the browser's native
    // Tab traversal correctly skips them. Without filtering them out here
    // too, `first`/`last` could point at an inert (collapsed) link;
    // `.focus()` on an inert element is a no-op per spec, so Shift+Tab
    // from the true first item would silently do nothing instead of
    // wrapping to the true last visible item.
    const focusable = drawer
      ? Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.closest("[inert]"))
      : undefined;
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
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
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, mobileVisible]);

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

  const { hasVisibleHero } = useHeroVisibility();
  // isHome alone used to be treated as "safe to go transparent" -- but
  // SiteHeader and the hero section are siblings, not overlapping, so a
  // transparent white-text header is only actually readable while the
  // hero itself is a real, populated (dark) section, not the short/light
  // empty-state fallback.
  const transparentHero = isHome && !scrolled && hasVisibleHero;

  return <>
    <header
      dir="rtl"
      className={`besat-site-header sticky top-0 z-50 w-full text-white transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        transparentHero
          ? // A deliberate dark scrim behind the white header text at
            // every breakpoint (see FE-GLOBAL-HEADER-TOP-LEGIBILITY-001's
            // history): round 1 made the gradient apply below xl: too, but
            // its via-45%/to-transparent stops still faded too far -- a
            // bright hero image showed through enough that white nav
            // text/subtitle over the lower half of the header measured
            // under 4.5:1. The floor is now #06172c/75 instead of fully
            // transparent: computed by hand against a worst-case pure-white
            // background (the brightest a hero image could possibly be),
            // 75% opacity #06172c still gives white text ~8:1, so every
            // point in this gradient stays legible regardless of what's
            // actually behind it.
            "border-b border-transparent bg-gradient-to-b from-[#06172c]/95 via-[#06172c]/85 to-[#06172c]/75"
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
          <Link href="/registration" className="besat-gold-button inline-flex h-11 min-w-[132px] items-center justify-center rounded-xl bg-[#e2ae5b] px-5 text-[13px] font-black shadow-[0_10px_22px_rgba(226,174,91,.24)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-[#edc57f] 2xl:text-[14px]">ثبت‌نام آنلاین</Link>
        </div>
      </div>

      <div className="mx-auto flex h-[calc(62px+env(safe-area-inset-top))] max-w-7xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6 xl:hidden">
        <button ref={mobileTriggerRef} type="button" onClick={() => setMobileOpen((value) => !value)} className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition hover:bg-white/20" aria-expanded={mobileOpen} aria-controls="site-mobile-menu" aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}><MenuIcon open={mobileOpen} /></button>
        <Logo compact />
        {isShopRoute ? <CartWidget /> : <span className="size-10" aria-hidden="true" />}
      </div>
    </header>

    {mobileVisible ? (
    <div inert={mobileOpen ? undefined : true} className={`fixed inset-0 z-[60] overflow-hidden xl:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
      <button type="button" tabIndex={-1} onClick={() => setMobileOpen(false)} aria-label="بستن منو" className={`absolute inset-0 bg-[#04101f]/75 backdrop-blur-sm transition-opacity duration-[250ms] motion-reduce:duration-0 motion-reduce:transition-none ${mobileSlideOpen ? "opacity-100" : "opacity-0"}`} />
      {/* <div>, not <aside>: an aside's implicit ARIA role is
          "complementary", which does not permit an explicit role="dialog"
          override -- Axe's aria-allowed-role flags it. A bare <div> has no
          implicit role, so role="dialog" is valid here. */}
      <div ref={mobileDrawerRef} id="site-mobile-menu" role="dialog" aria-modal="true" aria-label="منوی اصلی" dir="rtl" className={`absolute right-0 top-0 flex h-dvh w-[min(90vw,25rem)] flex-col bg-[#0a2039] p-5 text-white shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:duration-0 motion-reduce:transition-none ${mobileSlideOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-5"><Logo compact /><button onClick={() => setMobileOpen(false)} className="flex size-10 items-center justify-center rounded-xl bg-white/10" aria-label="بستن"><MenuIcon open /></button></div>
        <nav className="mt-5 grid gap-2 overflow-y-auto pb-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="rounded-xl bg-white/[.035] px-4 py-3 text-sm font-black">صفحه نخست</Link>
          {menus.map((menu) => <MobileAccordion key={menu.key} label={menu.label} items={menu.items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
          {mainItems.slice(1).map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-xl bg-white/[.035] px-4 py-3 text-sm font-black text-white/82 transition hover:bg-white/10">{item.label}</Link>)}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-white/10 pt-4">
          <SiteAuthActions />
          <Link href="/registration" onClick={() => setMobileOpen(false)} className="besat-gold-button block rounded-xl bg-[#e2ae5b] px-4 py-3 text-center text-sm font-black">پیش‌ثبت‌نام آنلاین</Link>
        </div>
      </div>
    </div>
    ) : null}
  </>;
}
