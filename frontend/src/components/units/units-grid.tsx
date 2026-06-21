import { UnitCard, type UnitSummary } from "@/components/units/unit-card";

type UnitsGridProps = {
  units: UnitSummary[];
};

export function UnitsGrid({ units }: UnitsGridProps) {
  if (units.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
          ▥
        </div>

        <h2 className="text-xl font-black text-[#0f2f4a]">واحدی برای نمایش ثبت نشده است.</h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
          پس از ثبت واحدهای آموزشی در سامانه، فهرست واحدها در این صفحه نمایش داده می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {units.map((unit) => (
        <UnitCard key={unit.slug} unit={unit} />
      ))}
    </div>
  );
}
