import type { Metadata } from "next";
import { RegisterCard } from "@/components/shop/register-card";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "ساخت حساب کاربری | فروشگاه بعثت",
};

// Account-creation form -- must not be statically generated as one shared page.
export const dynamic = "force-dynamic";

export default function ShopRegisterPage() {
  return (
    <PublicPageLayout>
      <div className="flex min-h-[calc(100dvh-5rem)] items-center bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
        <RegisterCard />
      </div>
    </PublicPageLayout>
  );
}
