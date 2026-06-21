import type { Metadata } from "next";
import { PublicContentPage } from "@/components/content/public-content-page";

export const metadata: Metadata = {
  title: "اطلاعیه‌ها | مدرسه بعثت",
};

export default function AnnouncementsPage() {
  return (
    <PublicContentPage
      active="announcements"
      eyebrow="اطلاعیه‌ها"
      title="اطلاعیه‌های مدرسه بعثت"
      description="اطلاعیه‌های عمومی مدرسه بعثت پس از ثبت و انتشار، در این صفحه نمایش داده می‌شوند."
      emptyTitle="اطلاعیه‌ای برای نمایش ثبت نشده است."
      emptyDescription="پس از انتشار اطلاعیه‌های مدرسه، موارد منتشرشده در این صفحه نمایش داده می‌شوند."
    />
  );
}
