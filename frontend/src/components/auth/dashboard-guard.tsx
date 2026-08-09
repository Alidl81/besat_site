"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  clearBesatSession,
  redirectPathForRole,
  rolesForDashboardSegment,
  sessionFromUser,
  writeBesatSession,
  type BesatRole,
} from "@/lib/auth/auth-session";
import { getCurrentUser } from "@/services/auth-service";

type DashboardGuardProps = {
  /** بخش داشبورد: admin | content-manager | parents */
  segment: string;
  children: ReactNode;
};

type GuardState = "checking" | "allowed" | "denied";

export function DashboardGuard({ segment, children }: DashboardGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        writeBesatSession(sessionFromUser(user));
        const allowedRoles = rolesForDashboardSegment(segment);
        const userRole = user.role as BesatRole;
        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
          router.replace(redirectPathForRole(userRole));
          setState("denied");
          return;
        }
        setState("allowed");
      })
      .catch(() => {
        if (!active) return;
        clearBesatSession();
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        setState("denied");
      });
    return () => {
      active = false;
    };
  }, [router, segment]);

  if (state !== "allowed") {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f3f7f9]"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
          <p className="text-sm font-black text-slate-500">
            در حال بررسی دسترسی...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
