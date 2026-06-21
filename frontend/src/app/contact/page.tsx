import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "تماس با ما | مدرسه بعثت",
};

export default function ContactPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="تماس"
        title="تماس با ما"
        description="برای ارتباط با مدرسه بعثت، فرم زیر را تکمیل کنید."
      />

      <PageSection>
        <form className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5">
            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-bold text-slate-800">
                نام و نام خانوادگی
              </label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-bold text-slate-800">
                شماره تماس
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-bold text-slate-800">
                متن پیام
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <button
              type="button"
              className="h-12 rounded-full bg-[#0f2f4a] px-5 text-sm font-bold text-white transition hover:bg-[#143d5f]"
            >
              ارسال پیام
            </button>
          </div>
        </form>
      </PageSection>
    </PublicPageLayout>
  );
}
