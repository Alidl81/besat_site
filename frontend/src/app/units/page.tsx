import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { UnitsGrid } from "@/components/units/units-grid";
import type { UnitSummary } from "@/components/units/unit-card";

export const metadata: Metadata = {
  title: "واحدهای آموزشی | مدرسه بعثت",
};

const units: UnitSummary[] = [];

export default function UnitsPage() {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-emerald-700">واحدها</p>

            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              واحدهای آموزشی مدرسه بعثت
            </h1>

            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              فهرست واحدهای آموزشی مدرسه بعثت در این صفحه نمایش داده می‌شود.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-14 md:py-16">
        <Container>
          <UnitsGrid units={units} />
        </Container>
      </section>
    </PublicPageLayout>
  );
}
