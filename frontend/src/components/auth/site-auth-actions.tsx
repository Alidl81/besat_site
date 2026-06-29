"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAccount } from "@/lib/api/account-api";
import { isApiMode } from "@/lib/data/repository";
import {
  clearBesatSession,
readBesatSession,
  type BesatSession,
} from "@/lib/auth/auth-session";

export function SiteAuthActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<BesatSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    function syncSession() {
      setSession(readBesatSession());
    }

    syncSession();

    window.addEventListener("storage", syncSession);
    window.addEventListener("besat-auth-changed", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("besat-auth-changed", syncSession);
    };
  }, []);

  async function handleLogout() {
    if (!session || isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (isApiMode()) {
        await logoutAccount(session.accessToken, { refresh: session.refreshToken });
      }
    } catch {
      // اگر API خطا داد، باز هم session را پاک می‌کنیم
    } finally {
      clearBesatSession();
      setSession(null);
      setIsLoggingOut(false);
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
        className="besat-green-button inline-flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black transition hover:bg-emerald-700 lg:h-11 lg:w-auto"
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
