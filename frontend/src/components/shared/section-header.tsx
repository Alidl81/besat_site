type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="mb-8 max-w-2xl text-right">
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold text-emerald-700">{eyebrow}</p>
      ) : null}

      <h2 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-4 leading-8 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
