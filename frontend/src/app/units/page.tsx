import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { EmptyState } from "@/components/page/empty-state";
import { PageHero } from "@/components/page/page-hero";
import {
  getUnits,
  type PaginatedResponse,
  type SchoolUnit,
} from "@/lib/api/public-api";

export const metadata: Metadata = {
  title: "واحدها | مدرسه بعثت",
};

function normalizeUnitsResponse(
  response: SchoolUnit[] | PaginatedResponse<SchoolUnit>,
): SchoolUnit[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.results;
}

async function loadUnits() {
  try {
    const response = await getUnits();
    return normalizeUnitsResponse(response);
  } catch {
    return [];
  }
}

export default async function UnitsPage() {
  const units = await loadUnits();

  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="واحدها"
        title="واحدهای مدرسه بعثت"
        description="واحدهای آموزشی مدرسه در این بخش نمایش داده می‌شود."
      />

      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {units.length === 0 ? (
            <EmptyState title="موردی برای نمایش وجود ندارد." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {units.map((unit) => (
                <article
                  key={unit.id}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-right shadow-[0_16px_45px_rgba(15,23,42,0.06)]"
                >
                  <h2 className="text-lg font-black leading-8 text-[#062452]">
                    {unit.title}
                  </h2>

                  {unit.description ? (
                    <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
                      {unit.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}
