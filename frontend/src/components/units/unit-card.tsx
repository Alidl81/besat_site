import Link from "next/link";

import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";
export type UnitSummary = {
  title: string;
  slug: string;
  description?: string;
};

type UnitCardProps = {
  unit: UnitSummary;
};

export function UnitCard({ unit }: UnitCardProps) {
  return (
    <article className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70">
      <div className="h-36 bg-[linear-gradient(135deg,#0f2f4a,#16496f)]" />

      <div className="p-6 text-right">
        <h2 className="text-xl font-black text-[#0f2f4a]">{getOfficialUnitShortTitle(unit)}</h2>

        {unit.description ? (
          <p className="mt-3 text-sm leading-8 text-slate-600">{unit.description}</p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link
            href={`/units/${unit.slug}`}
            className="besat-tab-link rounded-2xl px-4 py-3 text-center text-sm font-black"
          >
            معرفی
          </Link>

          <Link
            href={`/units/${unit.slug}/news`}
            className="besat-tab-link rounded-2xl px-4 py-3 text-center text-sm font-black"
          >
            اخبار
          </Link>

          <Link
            href={`/units/${unit.slug}/gallery`}
            className="besat-tab-link rounded-2xl px-4 py-3 text-center text-sm font-black"
          >
            گالری
          </Link>
        </div>
      </div>
    </article>
  );
}
