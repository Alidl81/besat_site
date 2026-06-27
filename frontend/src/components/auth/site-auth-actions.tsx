"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearBesatSession,
  getBesatSessionDisplayName,
  readBesatSession,
  type BesatSession,
} from "@/lib/auth/auth-session";

export function SiteAuthActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<BesatSession | null>(null);

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

  function handleLogout() {
    clearBesatSession();
    setSession(null);

    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/unit-manager") ||
      pathname.startsWith("/media") ||
      pathname.startsWith("/parents")
    ) {
      router.push("/");
      return;
    }

    router.refresh();
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

  const displayName = getBesatSessionDisplayName(session);

  return (
    <div className="grid w-full min-w-full grid-cols-2 gap-3 self-stretch lg:flex lg:w-auto lg:min-w-0 lg:items-center">
      <div className="col-span-2 flex h-14 min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-right shadow-sm lg:h-11 lg:w-auto lg:min-w-40">
        <span className="text-xs font-black text-slate-400 lg:text-[0.7rem]">
          وارد شده‌اید
        </span>
        <span className="min-w-0 truncate text-sm font-black text-[#062452]">
          {displayName}
        </span>
      </div>

      <Link
        href={session.redirectPath}
        className="besat-green-button inline-flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black transition hover:bg-emerald-700 lg:h-11 lg:w-auto"
      >
        پنل من
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#062452] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 lg:h-11 lg:w-auto"
      >
        خروج
      </button>
    </div>
  );
}
