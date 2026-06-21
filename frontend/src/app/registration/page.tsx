import type { Metadata } from "next";
import { CleanEmptyPanel } from "@/components/simple-pages/clean-empty-panel";
import { CleanSimplePage } from "@/components/simple-pages/clean-simple-page";

export const metadata: Metadata = {
  title: "ثبت‌نام | مدرسه بعثت",
};

export default function RegistrationPage() {
  return (
    <CleanSimplePage
      eyebrow="ثبت‌نام"
      title="ثبت‌نام مدرسه بعثت"
      description="اطلاعات مربوط به ثبت‌نام پس از ثبت، در این صفحه نمایش داده می‌شود."
    >
      <CleanEmptyPanel
        icon="◌"
        title="اطلاعات ثبت‌نام ثبت نشده است."
        description="پس از ثبت اطلاعات مربوط به ثبت‌نام، جزئیات قابل نمایش در این صفحه قرار می‌گیرد."
      />
    </CleanSimplePage>
  );
}
