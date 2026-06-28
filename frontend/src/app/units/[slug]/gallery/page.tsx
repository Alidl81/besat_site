import type { Metadata } from "next";
import { getUnitBySlug } from "@/lib/api/public-api";
import { UnitScopedPage } from "@/components/units/unit-scoped-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const unit = await getUnitBySlug(slug);
    return { title: `گالری ${unit.title} | مدرسه بعثت` };
  } catch {
    return { title: "گالری واحد | مدرسه بعثت" };
  }
}

export default async function UnitGalleryPage({ params }: PageProps) {
  const { slug } = await params;

  let unitTitle = "گالری تصاویر این واحد آموزشی";
  try {
    const unit = await getUnitBySlug(slug);
    unitTitle = `گالری ${unit.title}`;
  } catch {
    // مقدار پیش‌فرض استفاده می‌شود
  }

  return (
    <UnitScopedPage
      slug={slug}
      active="gallery"
      eyebrow="گالری واحد"
      title={unitTitle}
      description="تصاویر و آلبوم‌های مربوط به این واحد آموزشی در این صفحه نمایش داده می‌شود."
      emptyTitle="تصویری برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت آلبوم‌ها و تصاویر مربوط به این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
