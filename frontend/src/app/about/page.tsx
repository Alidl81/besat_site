import type { Metadata } from "next";
import { cache } from "react";
import { AboutCmsPage } from "@/components/about/about-cms-page";
import { AboutLegacyPage } from "@/components/about/about-legacy-page";
import { getResolvedAboutPage } from "@/services/about-service";

export const dynamic = "force-dynamic";

const loadAboutPage = cache(getResolvedAboutPage);

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await loadAboutPage();

  if (resolved.source === "django-cms") {
    return {
      title: `${resolved.page.page_title || resolved.page.title} | مدرسه بعثت`,
      description: resolved.page.meta_description || undefined,
    };
  }

  return {
    title: `${resolved.page.title || "درباره ما"} | مدرسه بعثت`,
    description: resolved.page.meta_description || undefined,
  };
}

export default async function AboutPage() {
  const resolved = await loadAboutPage();

  return resolved.source === "django-cms" ? (
    <AboutCmsPage page={resolved.page} />
  ) : (
    <AboutLegacyPage page={resolved.page} />
  );
}
