"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAccount } from "@/lib/api/account-api";
import { isApiMode } from "@/lib/data/repository";
import { clearBesatSession, readBesatSession } from "@/lib/auth/auth-session";
import { PanelIcon } from "@/components/dashboard/panel-icons";

export function PanelLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    const session = readBesatSession();

    try {
      if (isApiMode() && session) {
        await logoutAccount(session.accessToken, { refresh: session.refreshToken });
      }
    } catch {
      // silent
    } finally {
      clearBesatSession();
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="dashboard-sidebar-link w-full disabled:opacity-60"
    >
      <PanelIcon name="chevron" className="size-[1.35rem] rotate-180" />
      <span>{loading ? "در حال خروج..." : "خروج از حساب"}</span>
    </button>
  );
}
