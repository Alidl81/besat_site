import type { Metadata } from "next";
import { ContactPageContent } from "@/components/contact/contact-page-content";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "تماس با ما | مجتمع آموزشی بعثت",
};

export default function ContactPage() {
  return (
    <PublicPageLayout>
      <header className="border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-blue-700">تماس با ما</p>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.4] text-[#0f2f4a] md:text-5xl">
            راه‌های ارتباط با مجتمع و واحدهای آموزشی
          </h1>
        </Container>
      </header>
      <main className="bg-slate-50 py-14 md:py-16">
        <Container>
          <ContactPageContent />
        </Container>
      </main>
    </PublicPageLayout>
  );
}

