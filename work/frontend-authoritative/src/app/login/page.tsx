import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/login-card";

export const metadata: Metadata = {
  title: "ورود | مدرسه بعثت",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
      <LoginCard />
    </main>
  );
}
