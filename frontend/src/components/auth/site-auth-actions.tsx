"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { destroySession } from "@/lib/auth/login-service";
import {
  clearBesatSession,
  readBesatSession,
  sessionFromUser,
  writeBesatSession,
  type BesatSession,
} from "@/lib/auth/auth-session";
import { getCurrentUser } from "@/services/auth-service";

export function SiteAuthActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<BesatSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // FE-AUTH-SITE-LOGOUT-DOUBLE-SUBMIT-001: `isLoggingOut` is state-backed,
  // so two same-tick clicks both read it as `false` before either update
  // commits -- a synchronous ref guard closes that race.
  const isLoggingOutRef = useRef(false);
  // AUTH-FE-SESSION-DISPLAY-STALE-RESURRECT-001: see the mount effect below.
  const sessionGenerationRef = useRef(0);

  useEffect(() => {
    let active = true;
    // AUTH-FE-SESSION-DISPLAY-STALE-RESURRECT-001: the mount-time
    // getCurrentUser() call used to be fenced only by `active` (unmount),
    // so an external besat-auth-changed event (this tab's own logout, or a
    // storage event from another tab) that landed *while it was still
    // pending* was invisible to it -- a stale success arriving after the
    // display had already been cleared re-wrote and resurrected the old
    // user, and (the reverse) a stale rejection arriving after a *newer*
    // account had already been written cleared that valid session back to
    // guest. sessionGenerationRef is bumped every time syncSession() runs
    // (for either event, including the synchronous self-echo the
    // writeBesatSession/clearBesatSession calls below trigger), so any
    // stale completion whose generation no longer matches is discarded.
    function syncSession() {
      sessionGenerationRef.current += 1;
      setSession(readBesatSession());
    }

    const forGeneration = sessionGenerationRef.current;
    getCurrentUser()
      .then((user) => {
        if (!active || sessionGenerationRef.current !== forGeneration) return;
        const nextSession = sessionFromUser(user);
        writeBesatSession(nextSession);
        setSession(nextSession);
      })
      .catch(() => {
        if (!active || sessionGenerationRef.current !== forGeneration) return;
        clearBesatSession();
        setSession(null);
      });

    window.addEventListener("storage", syncSession);
    window.addEventListener("besat-auth-changed", syncSession);

    return () => {
      active = false;
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("besat-auth-changed", syncSession);
    };
  }, []);

  async function handleLogout() {
    if (!session || isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);

    try {
      await destroySession();
    } catch {
      // اگر API خطا داد، باز هم session را پاک می‌کنیم
    } finally {
      clearBesatSession();
      setSession(null);
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }

    const isDashboardPath =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/unit-manager") ||
      pathname.startsWith("/media") ||
      pathname.startsWith("/parents");

    if (isDashboardPath) {
      router.push("/");
    } else {
      router.refresh();
    }
  }

  if (!session) {
    return (
      <div className="w-full min-w-full self-stretch lg:w-auto lg:min-w-0">
        <Link
          href="/login"
          className="besat-navy-button inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#12395b] px-6 text-sm font-black transition hover:bg-[#0d2f4d] lg:h-11 lg:w-auto lg:px-5"
        >
          ورود
        </Link>
      </div>
    );
  }
return (
    <div className="grid w-full min-w-full grid-cols-2 gap-3 self-stretch lg:flex lg:w-auto lg:min-w-0 lg:items-center">

      <Link
        href={session.redirectPath}
        className="besat-accent-button inline-flex h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black transition hover:bg-blue-700 lg:h-11 lg:w-auto"
      >
        پنل من
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#062452] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-11 lg:w-auto"
      >
        {isLoggingOut ? "در حال خروج" : "خروج"}
      </button>
    </div>
  );
}
