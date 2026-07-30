import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { GalleryExplorer } from "@/components/gallery/gallery-explorer";

export const metadata: Metadata = {
  title: "گالری | مدرسه بعثت",
};

export default function GalleryPage() {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-blue-700">گالری</p>

            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              گالری تصاویر مدرسه بعثت
            </h1>

            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              تصاویر منتشرشده مدرسه بعثت در این صفحه نمایش داده می‌شوند.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-14 md:py-16">
        <Container>
          <GalleryExplorer />
        </Container>
      </section>
    </PublicPageLayout>
  );
}
