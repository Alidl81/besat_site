import { ContentRulesSection } from "@/components/home/content-rules-section";
import { HeroSection } from "@/components/home/hero-section";
import { VerifiedSectionsPreview } from "@/components/home/verified-sections-preview";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <VerifiedSectionsPreview />
        <ContentRulesSection />
      </main>
      <SiteFooter />
    </>
  );
}
