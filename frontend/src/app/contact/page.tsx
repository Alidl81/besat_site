import type { Metadata } from "next";
import { CleanEmptyPanel } from "@/components/simple-pages/clean-empty-panel";
import { CleanSimplePage } from "@/components/simple-pages/clean-simple-page";

export const metadata: Metadata = {
  title: "تماس با ما | مدرسه بعثت",
};

export default function ContactPage() {
  return (
    <CleanSimplePage
      eyebrow="تماس با ما"
      title="راه‌های ارتباطی مدرسه بعثت"
      description="اطلاعات ارتباطی مدرسه پس از ثبت، در این صفحه نمایش داده می‌شود."
    >
      <CleanEmptyPanel
        icon="◌"
        title="اطلاعات تماس ثبت نشده است."
        description="پس از ثبت راه‌های ارتباطی مدرسه، اطلاعات مربوط به تماس در این صفحه نمایش داده می‌شود."
      />
    </CleanSimplePage>
  );
}
