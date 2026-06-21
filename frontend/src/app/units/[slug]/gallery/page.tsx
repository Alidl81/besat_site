import type { Metadata } from "next";
import { UnitScopedPage } from "@/components/units/unit-scoped-page";

export const metadata: Metadata = {
  title: "گالری واحد | مدرسه بعثت",
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function UnitGalleryPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <UnitScopedPage
      slug={slug}
      active="gallery"
      eyebrow="گالری واحد"
      title="گالری تصاویر این واحد آموزشی"
      description="تصاویر و آلبوم‌های مربوط به هر واحد آموزشی در صفحه اختصاصی همان واحد نمایش داده می‌شود."
      emptyTitle="تصویری برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت آلبوم‌ها و تصاویر مربوط به این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
