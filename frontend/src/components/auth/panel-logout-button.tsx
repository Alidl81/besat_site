"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { destroySession } from "@/lib/auth/login-service";
import { clearBesatSession } from "@/lib/auth/auth-session";
import { PanelIcon } from "@/components/dashboard/panel-icons";

export function PanelLogoutButton({
  className = "dashboard-sidebar-link dashboard-sidebar-link--danger w-full disabled:opacity-60",
}: {
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // AUTH-UI-PANEL-LOGOUT-DOUBLE-SUBMIT-001: `loading` is state-backed, so
  // two same-tick clicks both read it as `false` before either update
  // commits -- a synchronous ref guard closes that race.
  const loadingRef = useRef(false);

  async function handleLogout() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await destroySession();
    } catch {
      // silent
    } finally {
      clearBesatSession();
      router.push("/");
    }
  }

  return (
    <button type="button" onClick={handleLogout} disabled={loading} className={className}>
      <PanelIcon name="logout" className="size-[1.35rem]" />
      <span>{loading ? "در حال خروج..." : "خروج از حساب"}</span>
    </button>
  );
}
