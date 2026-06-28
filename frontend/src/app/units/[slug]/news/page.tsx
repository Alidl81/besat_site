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
    return { title: `اخبار ${unit.title} | مدرسه بعثت` };
  } catch {
    return { title: "اخبار واحد | مدرسه بعثت" };
  }
}

export default async function UnitNewsPage({ params }: PageProps) {
  const { slug } = await params;

  let unitTitle = "اخبار این واحد آموزشی";
  try {
    const unit = await getUnitBySlug(slug);
    unitTitle = `اخبار ${unit.title}`;
  } catch {
    // مقدار پیش‌فرض استفاده می‌شود
  }

  return (
    <UnitScopedPage
      slug={slug}
      active="news"
      eyebrow="اخبار واحد"
      title={unitTitle}
      description="خبرهای مربوط به این واحد آموزشی در این صفحه نمایش داده می‌شود."
      emptyTitle="خبری برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت خبرهای مرتبط با این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
