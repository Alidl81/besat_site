import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/login-card";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "ورود | مدرسه بعثت",
};

export default function LoginPage() {
  return (
    <PublicPageLayout>
      <main className="flex min-h-[calc(100dvh-5rem)] items-center bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
        <LoginCard />
      </main>
    </PublicPageLayout>
  );
}
