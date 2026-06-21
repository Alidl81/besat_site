import type { Metadata } from "next";
import { PublicContentPage } from "@/components/content/public-content-page";

export const metadata: Metadata = {
  title: "اخبار | مدرسه بعثت",
};

export default function NewsPage() {
  return (
    <PublicContentPage
      active="news"
      eyebrow="اخبار"
      title="اخبار مدرسه بعثت"
      description="خبرهای مدرسه بعثت پس از ثبت و انتشار، در این صفحه نمایش داده می‌شوند."
      emptyTitle="خبری برای نمایش ثبت نشده است."
      emptyDescription="پس از انتشار خبرهای مدرسه، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
