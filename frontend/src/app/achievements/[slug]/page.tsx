import type { Metadata } from "next";
import { AchievementDetail } from "@/components/achievements/achievement-detail";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { resolveSiteUrl } from "@/lib/site-url";
import { getPublicAchievement } from "@/services/public-content-service";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const achievement = await getPublicAchievement(decodeURIComponent(slug)).catch(() => null);
  const title = achievement?.title || "جزئیات افتخار";
  const description = achievement?.summary || achievement?.description || undefined;
  const canonical = `${resolveSiteUrl()}/achievements/${encodeURIComponent(slug)}`;
  return {
    title: `${title} | مجتمع آموزشی بعثت`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | مجتمع آموزشی بعثت`, description, url: canonical, type: "article" },
  };
}

export default async function AchievementDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPageLayout><div className="bg-slate-50 py-14 md:py-16"><Container><AchievementDetail slug={slug} /></Container></div></PublicPageLayout>;
}
