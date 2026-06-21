import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { PageHero } from "@/components/page/page-hero";
import { PageSection } from "@/components/page/page-section";

export const metadata: Metadata = {
  title: "واحدهای آموزشی | مدرسه بعثت",
};

const unitLinks = [
  { title: "واحدهای آموزشی", href: "/units" },
  { title: "دپارتمان‌ها", href: "/departments" },
  { title: "برنامه‌ها و فعالیت‌ها", href: "/news" },
];

export default function UnitsPage() {
  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="واحدها"
        title="واحدهای آموزشی"
        description="در این بخش، مسیرهای مرتبط با واحدهای آموزشی و بخش‌های مختلف مدرسه نمایش داده می‌شود."
      />

      <PageSection>
        <div className="grid gap-5 md:grid-cols-3">
          {unitLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              <h2 className="text-lg font-bold text-slate-950">{item.title}</h2>
              <p className="mt-4 text-sm leading-8 text-slate-600">مشاهده جزئیات</p>
            </Link>
          ))}
        </div>
      </PageSection>
    </PublicPageLayout>
  );
}
