"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";
import type { PublicSchoolUnit } from "@/types/public-content";

type PublicUnitsDirectoryProps = {
  units: PublicSchoolUnit[];
  initialSlug?: string | null;
};

const filters = [
  { key: "all", label: "همه" },
  { key: "girls", label: "دخترانه" },
  { key: "boys", label: "پسرانه" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

const kindLabels: Record<PublicSchoolUnit["kind"], string> = {
  preschool: "پیش‌دبستانی",
  elementary: "دبستان",
  middle_school: "متوسطه اول",
  high_school: "دبیرستان",
};

function unitMeta(unit: PublicSchoolUnit) {
  return unit.subtitle || unit.grade_range || kindLabels[unit.kind] || "واحد آموزشی";
}

export function PublicUnitsDirectory({ units, initialSlug }: PublicUnitsDirectoryProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const visibleUnits = useMemo(
    () => units.filter((unit) => filter === "all" || unit.gender === filter),
    [filter, units],
  );

  return (
    <section dir="rtl" className="bg-[#fbfaf7] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 border-b border-[#dedfdc] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-3 text-xs font-black text-[#8a641f]">
              <span className="h-px w-7 bg-[#c98c3d]" />
              یک انتخاب روشن برای هر خانواده
            </p>
            <h2 className="text-2xl font-black leading-[1.45] text-[#0a2848] sm:text-3xl">
              واحدهای آموزشی
            </h2>
            <p className="mt-2 max-w-xl text-sm font-bold leading-7 text-slate-600">
              مقطع و نشانی کوتاه هر واحد را ببینید و برای معرفی کامل وارد صفحه همان واحد شوید.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#dfe4e8] bg-white p-1" role="group" aria-label="فیلتر جنسیت واحدها">
            {filters.map((item) => {
              const active = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.key)}
                  className={`min-h-10 rounded-lg px-3 text-xs font-black transition motion-reduce:transition-none sm:px-4 ${
                    active
                      ? "bg-[#0a2848] text-white shadow-sm"
                      : "text-[#506477] hover:bg-[#f5f7f8] hover:text-[#0a2848]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleUnits.length ? (
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleUnits.map((unit) => {
              const highlighted = unit.slug === initialSlug;
              return (
                <Link
                  key={unit.id}
                  id={`unit-${unit.slug}`}
                  href={`/units?unit=${encodeURIComponent(unit.slug)}`}
                  data-highlighted={highlighted || undefined}
                  className={`group flex min-h-36 flex-col justify-between rounded-2xl border bg-white p-5 text-right transition duration-300 motion-reduce:transition-none ${
                    highlighted
                      ? "border-[#c88d3c] shadow-[0_14px_30px_rgba(201,140,61,0.14)]"
                      : "border-[#e1e5e8] shadow-[0_8px_22px_rgba(8,30,55,0.04)] hover:-translate-y-0.5 hover:border-[#d9aa62] hover:shadow-[0_14px_30px_rgba(8,30,55,0.08)]"
                  }`}
                >
                  <span>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block break-words text-lg font-black leading-7 text-[#0a2848]">
                          {getOfficialUnitShortTitle(unit)}
                        </span>
                        <span className="mt-1 block break-words text-xs font-bold leading-6 text-[#68798a]">
                          {unitMeta(unit)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[#fff6e7] px-2.5 py-1 text-[0.68rem] font-black text-[#8a641f]">
                        {unit.gender === "girls" ? "دخترانه" : unit.gender === "boys" ? "پسرانه" : "مختلط"}
                      </span>
                    </span>

                    {unit.address ? (
                      <span className="mt-4 flex items-start gap-2 text-xs font-bold leading-6 text-slate-600">
                        <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#b97827]" />
                        <span className="break-words">{unit.address}</span>
                      </span>
                    ) : null}
                  </span>

                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#0a2848] transition group-hover:text-[#a9681d]">
                    مشاهده واحد
                    <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="mt-7 rounded-2xl border border-dashed border-[#d8dee3] bg-white px-5 py-8 text-center text-sm font-bold leading-7 text-slate-600">
            در این دسته‌بندی واحدی برای نمایش وجود ندارد.
          </p>
        )}
      </div>
    </section>
  );
}
