export type DepartmentItem = {
  id: string;
  title: string;
  description: string | null;
};

type DepartmentsGridProps = {
  departments: DepartmentItem[];
};

export function DepartmentsGrid({ departments }: DepartmentsGridProps) {
  if (departments.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
          ◌
        </div>

        <h2 className="text-xl font-black text-[#0f2f4a]">دپارتمانی برای نمایش ثبت نشده است.</h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
          پس از ثبت دپارتمان‌ها، فهرست آن‌ها در این صفحه نمایش داده می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {departments.map((department) => (
        <article
          key={department.id}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70"
        >
          <h2 className="text-xl font-black text-[#0f2f4a]">{department.title}</h2>

          {department.description ? (
            <p className="mt-4 text-sm leading-8 text-slate-600">{department.description}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
