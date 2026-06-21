type CleanEmptyPanelProps = {
  icon: string;
  title: string;
  description: string;
};

export function CleanEmptyPanel({ icon, title, description }: CleanEmptyPanelProps) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
        {icon}
      </div>

      <h2 className="text-xl font-black text-[#0f2f4a]">{title}</h2>

      <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">{description}</p>
    </div>
  );
}
