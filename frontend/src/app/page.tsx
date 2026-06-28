import { HomeIntroSection } from "@/components/home/home-intro-section";
import { HomeNewsSection } from "@/components/home/home-news-section";
import { HomeSliderSection } from "@/components/home/home-slider-section";
import { HomeUnitsSection } from "@/components/home/home-units-section";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export default function HomePage() {
  return (
    <PublicPageLayout>
      <HomeSliderSection />
      <HomeIntroSection />
      <HomeUnitsSection />
      <HomeNewsSection />
    </PublicPageLayout>
  );
}
