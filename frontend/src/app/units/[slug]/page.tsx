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
    return { title: `${unit.title} | مدرسه بعثت` };
  } catch {
    return { title: "واحد آموزشی | مدرسه بعثت" };
  }
}

export default async function UnitDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let title = "معرفی واحد آموزشی";
  let description = "اطلاعات این واحد آموزشی در این صفحه نمایش داده می‌شود.";

  try {
    const unit = await getUnitBySlug(slug);
    title = unit.title;
    description = unit.description ?? description;
  } catch {
    // اگر واحد پیدا نشد همان مقادیر پیش‌فرض نمایش داده می‌شوند
  }

  return (
    <UnitScopedPage
      slug={slug}
      active="overview"
      eyebrow="واحد آموزشی"
      title={title}
      description={description}
      emptyTitle="اطلاعاتی برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت اطلاعات واحد، محتوای مرتبط در این صفحه نمایش داده می‌شود."
    />
  );
}
