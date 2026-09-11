import type { Metadata } from "next";
import { AboutContent } from "@/components/about/about-content";
import { PublicPageLayout } from "@/components/layout/public-page-layout";

export const metadata: Metadata = {
  title: "درباره ما | مجتمع آموزشی بعثت",
  description: "روایت مجتمع آموزشی بعثت؛ از ۱۳۷۰ تا آموزش علمی، مهارت و تربیت دینی.",
};

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <AboutContent />
    </PublicPageLayout>
  );
}
