import type { Metadata } from "next";
import { AboutContentBlock, type AboutContent } from "@/components/about/about-content-block";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "درباره ما | مدرسه بعثت",
};

const aboutContent: AboutContent | null = null;

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-emerald-700">درباره ما</p>

            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              درباره مدرسه بعثت
            </h1>

            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              معرفی مدرسه بعثت پس از ثبت اطلاعات، در این صفحه نمایش داده می‌شود.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-14 md:py-16">
        <Container>
          <AboutContentBlock content={aboutContent} />
        </Container>
      </section>
    </PublicPageLayout>
  );
}
