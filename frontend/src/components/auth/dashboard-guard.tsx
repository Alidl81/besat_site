"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clearBesatSession,
  readBesatSession,
  redirectPathForRole,
  rolesForDashboardSegment,
  sessionFromUser,
  writeBesatSession,
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
  // AUTH-FE-DASH-GUARD-STALE-SESSION-001: see the effect below.
  const sessionGenerationRef = useRef(0);

  useEffect(() => {
    let active = true;

    // AUTH-FE-DASH-GUARD-STALE-SESSION-001: the single source of truth for
    // what this guard should render, re-derived from the CURRENT session
    // in storage every time it's called -- both from the event listener
    // below (any tab logging out/in, or this tab's own logout) and,
    // indirectly, from the initial getCurrentUser() resolution, since
    // writeBesatSession()/clearBesatSession() below synchronously dispatch
    // besat-auth-changed and this listener is already attached by then.
    function applyGuardDecision() {
      const current = readBesatSession();
      if (!current) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        setState("denied");
        return;
      }
      const allowedRoles = rolesForDashboardSegment(segment);
      if (allowedRoles.length > 0 && !allowedRoles.includes(current.role)) {
        router.replace(redirectPathForRole(current.role));
        setState("denied");
        return;
      }
      setState("allowed");
    }

    // Previously there was no listener at all here, so a guard that had
    // already settled to "allowed" kept rendering the protected children
    // forever, even after a logout (this tab's or another tab's) cleared
    // the session out from under it. Every invocation -- including the
    // self-echo from this effect's own writeBesatSession/clearBesatSession
    // calls -- also bumps the generation ref so a still-pending, now-stale
    // getCurrentUser() completion below can detect it's obsolete.
    function handleSessionChange() {
      sessionGenerationRef.current += 1;
      applyGuardDecision();
    }

    const forGeneration = sessionGenerationRef.current;
    getCurrentUser()
      .then((user) => {
        if (!active || sessionGenerationRef.current !== forGeneration) return;
        writeBesatSession(sessionFromUser(user));
      })
      .catch(() => {
        if (!active || sessionGenerationRef.current !== forGeneration) return;
        clearBesatSession();
      });

    window.addEventListener("storage", handleSessionChange);
    window.addEventListener("besat-auth-changed", handleSessionChange);

    return () => {
      active = false;
      window.removeEventListener("storage", handleSessionChange);
      window.removeEventListener("besat-auth-changed", handleSessionChange);
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
