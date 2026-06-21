type UnitEmptyStateProps = {
  title: string;
  description: string;
};

export function UnitEmptyState({ title, description }: UnitEmptyStateProps) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
        ◌
      </div>

      <h2 className="text-xl font-black text-[#0f2f4a]">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-slate-600">{description}</p>
    </div>
  );
}
