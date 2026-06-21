import type { Metadata } from "next";
import { UnitScopedPage } from "@/components/units/unit-scoped-page";

export const metadata: Metadata = {
  title: "اخبار واحد | مدرسه بعثت",
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function UnitNewsPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <UnitScopedPage
      slug={slug}
      active="news"
      eyebrow="اخبار واحد"
      title="اخبار این واحد آموزشی"
      description="خبرهای مربوط به هر واحد آموزشی در صفحه اختصاصی همان واحد منتشر می‌شود."
      emptyTitle="خبری برای این واحد ثبت نشده است."
      emptyDescription="پس از ثبت خبرهای مرتبط با این واحد، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
