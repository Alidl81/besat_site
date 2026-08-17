import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد | مجتمع آموزشی بعثت",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PublicPageLayout>
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-black text-[#c98c3d]">۴۰۴</p>
        <h1 className="mt-2 text-2xl font-black text-[#0a2848]">این صفحه پیدا نشد</h1>
        <p className="mt-3 max-w-md text-sm font-bold leading-8 text-[#0a2848]/60">
          نشانی وارد‌شده در سایت وجود ندارد یا جابه‌جا شده است.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="besat-accent-button inline-flex rounded-xl px-6 py-3 text-sm font-black">
            بازگشت به صفحه نخست
          </Link>
          <Link
            href="/contact"
            className="inline-flex rounded-xl border border-[#e5e7eb] px-6 py-3 text-sm font-black text-[#0a2848] transition hover:bg-[#f4f1ea]"
          >
            تماس با ما
          </Link>
        </div>
      </Container>
    </PublicPageLayout>
  );
}
