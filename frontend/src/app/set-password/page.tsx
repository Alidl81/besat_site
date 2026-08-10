import type { Metadata } from "next";
import { SetPasswordCard } from "@/components/auth/set-password-card";

export const metadata: Metadata = {
  title: "تعیین رمز عبور | مدرسه بعثت",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tokenParam = resolvedSearchParams.token;
  const token = typeof tokenParam === "string" && tokenParam.trim() ? tokenParam : null;

  return (
    <main className="min-h-screen bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
      <SetPasswordCard token={token} />
    </main>
  );
}
