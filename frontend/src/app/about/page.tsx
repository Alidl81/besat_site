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
        description="مدرسه بعثت با محوریت آموزش، تربیت و رشد دینی دانش‌آموزان فعالیت می‌کند."
      />

      <PageSection>
        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard title="آموزش">
            <p>تمرکز بر یادگیری منظم، رشد علمی و تقویت توانمندی‌های دانش‌آموزان.</p>
          </InfoCard>

          <InfoCard title="تربیت">
            <p>توجه به رشد اخلاقی، مسئولیت‌پذیری و شکل‌گیری شخصیت دانش‌آموز.</p>
          </InfoCard>

          <InfoCard title="همراهی خانواده">
            <p>اهمیت ارتباط مؤثر میان مدرسه و خانواده در مسیر رشد دانش‌آموز.</p>
          </InfoCard>
        </div>
      </PageSection>
    </PublicPageLayout>
  );
}
