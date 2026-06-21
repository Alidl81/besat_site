import type { Metadata } from "next";
import { UnitScopedPage } from "@/components/units/unit-scoped-page";

export const metadata: Metadata = {
  title: "اطلاعیه‌های واحد | مدرسه بعثت",
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function UnitAnnouncementsPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <UnitScopedPage
      slug={slug}
      active="announcements"
      eyebrow="اطلاعیه‌های واحد"
      title="اطلاعیه‌های این واحد آموزشی"
      description="اطلاعیه‌های اختصاصی هر واحد آموزشی در صفحه همان واحد نمایش داده می‌شود."
      emptyTitle="اطلاعیه‌ای برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت اطلاعیه‌های مربوط به این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
