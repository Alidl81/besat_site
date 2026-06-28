"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAccount } from "@/lib/api/account-api";
import { isApiMode } from "@/lib/data/repository";
import { clearBesatSession, readBesatSession } from "@/lib/auth/auth-session";

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
      className="flex w-full items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-black text-rose-200 transition duration-500 hover:bg-rose-500/20 disabled:opacity-60"
    >
      <span>{loading ? "خروج..." : "خروج از حساب"}</span>
      <span>⎋</span>
    </button>
  );
}
