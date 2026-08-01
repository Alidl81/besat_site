type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>

      {description ? (
        <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
