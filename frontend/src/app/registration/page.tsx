import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "پیش‌ثبت‌نام | مدرسه بعثت",
};

export default function RegistrationPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="پیش‌ثبت‌نام"
        title="پیش‌ثبت‌نام مدرسه بعثت"
        description="برای ثبت درخواست اولیه، اطلاعات زیر را تکمیل کنید."
      />

      <PageSection>
        <form className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="studentName" className="mb-2 block text-sm font-bold text-slate-800">
                نام و نام خانوادگی دانش‌آموز
              </label>
              <input
                id="studentName"
                type="text"
                name="studentName"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="grade" className="mb-2 block text-sm font-bold text-slate-800">
                پایه تحصیلی
              </label>
              <input
                id="grade"
                type="text"
                name="grade"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="parentName" className="mb-2 block text-sm font-bold text-slate-800">
                نام ولی دانش‌آموز
              </label>
              <input
                id="parentName"
                type="text"
                name="parentName"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="parentPhone" className="mb-2 block text-sm font-bold text-slate-800">
                شماره تماس
              </label>
              <input
                id="parentPhone"
                type="tel"
                name="phone"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="button"
            className="mt-6 h-12 rounded-full bg-[#0f2f4a] px-6 text-sm font-bold text-white transition hover:bg-[#143d5f]"
          >
            ثبت درخواست
          </button>
        </form>
      </PageSection>
    </PublicPageLayout>
  );
}
