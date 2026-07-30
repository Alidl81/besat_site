import type { Metadata } from "next";
import { AchievementsList } from "@/components/achievements/achievements-list";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "افتخارات | مجتمع آموزشی بعثت",
};

export default function AchievementsPage() {
  return (
    <PublicPageLayout>
      <header className="border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-blue-700">افتخارات</p>
          <h1 className="text-3xl font-black leading-[1.4] text-[#0f2f4a] md:text-5xl">افتخارات مجتمع و واحدهای آموزشی</h1>
        </Container>
      </header>
      <main className="bg-slate-50 py-14 md:py-16">
        <Container><AchievementsList /></Container>
      </main>
    </PublicPageLayout>
  );
}
