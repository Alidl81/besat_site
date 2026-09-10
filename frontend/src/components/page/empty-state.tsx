type EmptyStateProps = {
  title: string;
  description?: string;
  /**
   * Most callers render this inside a page that already has its own real
   * <h1>, so the default stays <h2>. A handful of full-page error/empty
   * states (e.g. a detail page whose only content failed to load) have no
   * other heading anywhere on the page -- those pass "h1" so the page still
   * exposes exactly one meaningful top-level heading.
   */
  as?: "h1" | "h2";
};

export function EmptyState({ title, description, as = "h2" }: EmptyStateProps) {
  const Heading = as;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Heading className="text-xl font-bold text-slate-950">{title}</Heading>

      {description ? (
        <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
