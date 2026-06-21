import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { InfoCard } from "@/components/page/info-card";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "درباره ما | مدرسه بعثت",
};

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="درباره ما"
        title="درباره مدرسه بعثت"
        description="این بخش برای معرفی مدرسه، رویکرد آموزشی، فضای تربیتی و مسیر ارتباط خانواده‌ها با مدرسه طراحی شده است."
      />

      <PageSection>
        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard title="معرفی مدرسه">
            <p>اطلاعات رسمی معرفی مدرسه در این بخش قرار می‌گیرد.</p>
          </InfoCard>

          <InfoCard title="رویکرد آموزشی">
            <p>در این بخش، رویکرد آموزشی و تربیتی مدرسه معرفی می‌شود.</p>
          </InfoCard>

          <InfoCard title="ارتباط با خانواده‌ها">
            <p>مسیرهای ارتباطی مدرسه با خانواده‌ها در بخش تماس با ما ارائه می‌شود.</p>
          </InfoCard>
        </div>
      </PageSection>
    </PublicPageLayout>
  );
}
