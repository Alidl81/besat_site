import type { Metadata } from "next";
import { PreregistrationCard } from "@/components/auth/preregistration-card";

export const metadata: Metadata = {
  title: "پیش‌ثبت‌نام | مدرسه بعثت",
};

type RegistrationPageProps = {
  searchParams: Promise<{ unit?: string | string[] }>;
};

export default async function RegistrationPage({ searchParams }: RegistrationPageProps) {
  const query = await searchParams;
  const unit = Array.isArray(query.unit) ? query.unit[0] : query.unit;
  return (
    <main className="min-h-screen bg-[#f6f9fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8" dir="rtl">
      <PreregistrationCard initialUnitSlug={unit} />
    </main>
  );
}
