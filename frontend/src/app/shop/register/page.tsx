import type { Metadata } from "next";
import { RegisterCard } from "@/components/shop/register-card";

export const metadata: Metadata = {
  title: "ساخت حساب کاربری | فروشگاه بعثت",
};

export default function ShopRegisterPage() {
  return (
    <main className="min-h-screen bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
      <RegisterCard />
    </main>
  );
}
