import { HomeContactBanner } from "@/components/home/home-contact-banner";
import { HomeHero } from "@/components/home/home-hero";
import { HomeSections } from "@/components/home/home-sections";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HomeHero />
        <HomeSections />
        <HomeContactBanner />
      </main>
      <SiteFooter />
    </>
  );
}
