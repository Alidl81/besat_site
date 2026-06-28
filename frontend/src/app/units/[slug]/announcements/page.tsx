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
    return { title: `اطلاعیه‌های ${unit.title} | مدرسه بعثت` };
  } catch {
    return { title: "اطلاعیه‌های واحد | مدرسه بعثت" };
  }
}

export default async function UnitAnnouncementsPage({ params }: PageProps) {
  const { slug } = await params;

  let unitTitle = "اطلاعیه‌های این واحد آموزشی";
  try {
    const unit = await getUnitBySlug(slug);
    unitTitle = `اطلاعیه‌های ${unit.title}`;
  } catch {
    // مقدار پیش‌فرض استفاده می‌شود
  }

  return (
    <UnitScopedPage
      slug={slug}
      active="announcements"
      eyebrow="اطلاعیه‌های واحد"
      title={unitTitle}
      description="اطلاعیه‌های اختصاصی این واحد آموزشی در این صفحه نمایش داده می‌شود."
      emptyTitle="اطلاعیه‌ای برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت اطلاعیه‌های مربوط به این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
