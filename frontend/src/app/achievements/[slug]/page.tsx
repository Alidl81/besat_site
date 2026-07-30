import type { Metadata } from "next";
import { AchievementDetail } from "@/components/achievements/achievement-detail";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "جزئیات افتخار | مجتمع آموزشی بعثت",
};

export default async function AchievementDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPageLayout><main className="bg-slate-50 py-14 md:py-16"><Container><AchievementDetail slug={slug} /></Container></main></PublicPageLayout>;
}
