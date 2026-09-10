"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardPageData } from "@/components/dashboard/dashboard-data";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { PanelLogoutButton } from "@/components/auth/panel-logout-button";
import { useMounted } from "@/hooks/use-mounted";

export function DashboardMobileMenu({
  data,
  activeKey,
}: {
  data: DashboardPageData;
  activeKey: string;
}) {
  const [open, setOpen] = useState(false);
  // Two REOPENs on FE-DASH-MOBILE-CLOSED-OVERFLOW-001 proved that neither
  // html-level overflow-x:hidden nor overflow-hidden on the portaled
  // wrapper actually removes the closed drawer's contribution to
  // documentElement.scrollWidth -- both only masked the symptom, and
  // Codex's own evidence showed the geometry persisted even with the
  // wrapper computed overflow:hidden. The only way to guarantee zero
  // overflow contribution while closed is to not have the drawer in the
  // DOM at all then, matching the pattern already used correctly by the
  // shop cart drawer (which mounts only while open). `visible` stays true
  // for the duration of the close transition (so the slide-out animation
  // still plays), then unmounts the portal entirely once it's done.
  const [visible, setVisible] = useState(false);
  // Separate from `visible` (whether the portal is mounted at all): drives
  // the actual translate/opacity classes. If the drawer mounted with
  // `open`'s classes applied on its very first render, the browser would
  // never see a prior frame at the closed position to transition FROM (a
  // freshly-inserted element's transition-property doesn't fire just
  // because its initial computed style happens to differ from some other
  // element's) -- the slide-in entrance animation would silently vanish.
  // Deferring this flip by one animation frame after mount reproduces the
  // "mount closed, then animate to open" two-step every CSS-transition-
  // on-enter pattern needs.
  const [slideOpen, setSlideOpen] = useState(false);
  const mounted = useMounted();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);

  // FE-MOBILE-MENU-OPEN-REGRESSION-001: an earlier revision moved this
  // synchronous mirroring of `open` into React's "adjust state during
  // render" pattern specifically to satisfy the react-hooks/set-state-in-effect
  // lint rule below -- that produced a real regression (clicking the
  // trigger set aria-expanded=true but no dialog ever mounted). Rather
  // than keep guessing at a render-phase/portal interaction, reverted to
  // this plain, well-understood effect that mirrors `open` into
  // `visible`/`slideOpen` a render behind (after commit, not during
  // render) -- nothing here needs the drawer to exist within the SAME
  // render `open` flips in, so the lint rule's usual concern doesn't
  // apply; suppressed deliberately rather than risk another subtle bug
  // chasing the rule a second time.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    setSlideOpen(false);
    const timer = window.setTimeout(() => setVisible(false), 250);
    return () => window.clearTimeout(timer);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // FE-MOBILE-MENU-RAPID-REOPEN-001 (same defect confirmed in the public
  // site-header's identical pattern): keying this on `visible` instead of
  // `open` misses a rapid close-then-reopen -- if the close transition's
  // 250ms unmount timer above is still pending when the user reopens, the
  // cleanup for the `[open]` effect cancels that timer and `visible` was
  // ALREADY true the whole time, so it never transitions and this effect
  // never re-fires, leaving `slideOpen` stuck at the `false` the close
  // click had just set (mounted with `aria-expanded=true` but still
  // visually at `translate-x-full`). Keying on `open` directly re-fires on
  // every reopen regardless of whether `visible` happened to already be
  // true; `visible` is guaranteed already true by the time this frame's
  // callback runs, since it's set synchronously in the same commit by the
  // effect above.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => setSlideOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
      // preventScroll -- see the identical fix/reasoning in
      // site-header.tsx for FE-PUBLIC-MOBILE-MENU-SCROLL-LOCK-001: without
      // it, the browser's own focus-scroll-into-view behavior runs right
      // after the manual window.scrollTo(0, scrollPosition.current) above
      // and overrides it.
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  // FE-MOBILE-MENU-FOCUS-TRAP-001: originally keyed on `visible` instead
  // of `open` so it would only run once the drawer genuinely exists in the
  // DOM (drawerRef.current was still null on the same render `open` first
  // flips true). That fix has the same defect as
  // FE-MOBILE-MENU-RAPID-REOPEN-001's slideOpen effect: on a close
  // immediately followed by a reopen, `visible` was already `true` the
  // whole time and never transitions, so this effect never re-fires --
  // focus is never pulled back into the reopened dialog.
  //
  // A first attempt fixed this by keying on `open` alone and deferring the
  // ref read via requestAnimationFrame, mirroring the slideOpen effect --
  // but unlike slideOpen (which only calls a state setter, safe regardless
  // of DOM timing), this effect reads drawerRef.current directly, and a
  // disposable regression test proved the scheduled animation frame can
  // fire BEFORE the cascading `visible` update has actually committed the
  // drawer into the DOM, leaving the ref null. The robust fix instead keys
  // on BOTH `open` and `visible`, only doing the work once both are true:
  // on a normal open this naturally re-fires once `visible` catches up (no
  // rAF needed, no timing assumption); on a rapid reopen, `open` becoming
  // true again is itself a dependency change that re-fires this effect
  // immediately, and `visible` is already `true` by then, so the guard
  // passes right away.
  useEffect(() => {
    if (!open || !visible) return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
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
  }, [open, visible]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="panel-icon-button"
        aria-expanded={open}
        aria-controls="panel-mobile-menu"
        // FE-DASH-MOBILE-MENU-LABEL-001: this stayed "باز کردن منو" (open
        // menu) even once aria-expanded was already true -- a screen
        // reader landing back on this same trigger heard a name that
        // contradicted its own expanded state. Deriving the name from
        // `open` (matching the drawer's own close button's "بستن منو")
        // requires the click handler to actually toggle rather than only
        // ever open, so the name stays truthful either way.
        aria-label={open ? "بستن منو" : "باز کردن منو"}
      >
        <PanelIcon name="menu" />
      </button>

      {/* Portaled to <body>: DashboardTopbar's <header> carries
          backdrop-blur-xl, which -- same as FE-CART-001's cart drawer --
          makes it a containing block for position:fixed descendants, so
          this overlay was being sized to the topbar's own height instead
          of the viewport. `mounted` guards SSR (document.body doesn't
          exist server-side); `visible` guards whether the drawer exists
          in the DOM at all -- unlike an always-mounted
          translate-x-full-when-closed drawer, this one is fully absent
          once the close transition finishes, so it cannot contribute to
          documentElement.scrollWidth while closed (two prior CSS-only
          containment attempts -- html overflow-x:hidden, then
          overflow-hidden on this wrapper -- were both proven insufficient
          by Codex's re-tests; see FE-DASH-MOBILE-CLOSED-OVERFLOW-001). */}
      {mounted && visible && createPortal(
        <div
          inert={open ? undefined : true}
          aria-hidden={!open}
          className={`fixed inset-0 z-[80] overflow-hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        >
        <button
          type="button"
          tabIndex={-1}
          aria-label="بستن منو"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-950/55 transition-opacity duration-[250ms] motion-reduce:duration-0 motion-reduce:transition-none ${slideOpen ? "opacity-100" : "opacity-0"}`}
        />
        {/* <div>, not <aside>: an aside's implicit ARIA role is
            "complementary", which does not permit an explicit role="dialog"
            override -- Axe's aria-allowed-role flags it. A bare <div> has
            no implicit role, so role="dialog" is valid here. */}
        <div
          ref={drawerRef}
          id="panel-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="منوی پنل"
          className={`absolute right-0 top-0 flex h-dvh w-[min(88vw,22rem)] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:duration-0 motion-reduce:transition-none ${slideOpen ? "translate-x-0" : "translate-x-full"}`}
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

          <footer className="space-y-1 border-t border-slate-200 p-3">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="dashboard-sidebar-link border border-slate-200 bg-slate-50 !text-[#0a2b50] hover:!bg-[#f6f0e7]"
            >
              <PanelIcon name="globe" className="size-[1.25rem]" />
              <span>بازگشت به سایت</span>
            </Link>
            <PanelLogoutButton className="dashboard-sidebar-link w-full border border-rose-200 bg-rose-50 !text-rose-700 hover:!bg-rose-100 disabled:opacity-60" />
          </footer>
        </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
