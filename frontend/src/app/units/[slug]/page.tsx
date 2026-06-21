import type { Metadata } from "next";
import { UnitScopedPage } from "@/components/units/unit-scoped-page";

export const metadata: Metadata = {
  title: "معرفی واحد | مدرسه بعثت",
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function UnitDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <UnitScopedPage
      slug={slug}
      active="overview"
      eyebrow="واحد آموزشی"
      title="معرفی واحد آموزشی"
      description="اطلاعات هر واحد آموزشی پس از ثبت در سامانه، در صفحه اختصاصی همان واحد نمایش داده می‌شود."
      emptyTitle="اطلاعاتی برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت اطلاعات واحد، معرفی، بخش‌ها و محتوای مرتبط در این صفحه نمایش داده می‌شود."
    />
  );
}
