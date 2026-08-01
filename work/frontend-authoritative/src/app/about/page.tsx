import type { Metadata } from "next";
import { AboutContent } from "@/components/about/about-content";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "درباره ما | مجتمع آموزشی بعثت",
  description: "معرفی، تاریخچه، ماموریت و افراد کلیدی مجتمع آموزشی بعثت.",
};

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <header className="border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-blue-700">درباره ما</p>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.4] text-[#0f2f4a] md:text-5xl">
            مجتمع آموزشی بعثت
          </h1>
        </Container>
      </header>
      <main className="bg-slate-50 py-14 md:py-16">
        <Container>
          <AboutContent />
        </Container>
      </main>
    </PublicPageLayout>
  );
}

