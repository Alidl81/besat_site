import { HomeDepartmentsSection } from "@/components/home/home-departments-section";
import { HomeExperienceSection } from "@/components/home/home-experience-section";
import { HomeIntroSection } from "@/components/home/home-intro-section";
import { HomeNewsSection } from "@/components/home/home-news-section";
import { HomeSliderSection } from "@/components/home/home-slider-section";
import { HomeUnitsSection } from "@/components/home/home-units-section";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Reveal } from "@/components/shared/reveal";

export default function HomePage() {
  return (
    <PublicPageLayout>
      <HomeSliderSection />
      <Reveal mode="lazy" direction="right" reserveClassName="min-h-[38rem] bg-[#fbfaf7]">
        <HomeIntroSection />
      </Reveal>
      <Reveal mode="lazy" direction="scale" reserveClassName="min-h-[48rem] bg-white" delay={40}>
        <HomeUnitsSection />
      </Reveal>
      <Reveal mode="lazy" direction="left" reserveClassName="min-h-[48rem] bg-[#fbfaf7]" delay={60}>
        <HomeExperienceSection />
      </Reveal>
      <Reveal mode="lazy" direction="up" reserveClassName="min-h-[28rem] bg-white" delay={80}>
        <HomeDepartmentsSection />
      </Reveal>
      <Reveal mode="lazy" direction="scale" reserveClassName="min-h-[28rem] bg-[#fbfaf7]" delay={100}>
        <HomeNewsSection />
      </Reveal>
    </PublicPageLayout>
  );
}
