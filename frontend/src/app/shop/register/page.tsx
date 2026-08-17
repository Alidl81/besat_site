import type { Metadata } from "next";
import { RegisterCard } from "@/components/shop/register-card";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "ساخت حساب کاربری | فروشگاه بعثت",
};

export default function ShopRegisterPage() {
  return (
    <PublicPageLayout>
      <main className="flex min-h-[calc(100dvh-5rem)] items-center bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
        <RegisterCard />
      </main>
    </PublicPageLayout>
  );
}
