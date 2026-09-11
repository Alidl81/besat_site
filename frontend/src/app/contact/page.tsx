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
      <header className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbfd_0%,#ffffff_64%,#fffaf1_100%)]">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-[#8a641f]">تماس با ما</p>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.45] text-[#0f2f4a] md:text-5xl">ارتباط مستقیم با مجتمع بعثت</h1>
          <p className="mt-5 max-w-2xl text-base font-bold leading-8 text-slate-600">
            راه‌های ارتباطی رسمی را ببینید و برای پرسش، پیشنهاد یا پیگیری، پیام خود را برای مجموعه بفرستید.
          </p>
        </Container>
      </header>
      <div className="bg-slate-50 py-14 md:py-16">
        <Container>
          <ContactPageContent />
        </Container>
      </div>
    </PublicPageLayout>
  );
}
