"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  readBesatSession,
  rolesForDashboardSegment,
  type BesatRole,
} from "@/lib/auth/auth-session";

type DashboardGuardProps = {
  /** بخش داشبورد: admin | unit-manager | media | parents */
  segment: string;
  children: ReactNode;
};

type GuardState = "checking" | "allowed" | "denied";

/**
 * محافظ دسترسی پنل‌ها (سمت کلاینت).
 *
 * - اگر کاربر لاگین نباشد → هدایت به /login با بازگشت بعدی
 * - اگر نقش کاربر مجاز نباشد → هدایت به پنل خودش
 *
 * این محافظ برای تست با npm کافی است. هنگام آماده شدن بک‌اند،
 * می‌توان آن را با middleware مبتنی بر cookie تکمیل کرد.
 */
export function DashboardGuard({ segment, children }: DashboardGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    const session = readBesatSession();

    if (!session) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      setState("denied");
      return;
    }

    const allowedRoles = rolesForDashboardSegment(segment);
    const userRole = session.role as BesatRole;

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      router.replace(session.redirectPath);
      setState("denied");
      return;
    }

    setState("allowed");
  }, [router, segment]);

  if (state !== "allowed") {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f3f7f9]"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          <p className="text-sm font-black text-slate-500">
            در حال بررسی دسترسی...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
