import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { UnitEmptyState } from "@/components/units/unit-empty-state";
import { UnitScopedTabs } from "@/components/units/unit-scoped-tabs";

type UnitScopedPageProps = {
  slug: string;
  active: "overview" | "news" | "gallery";
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function UnitScopedPage({
  slug,
  active,
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: UnitScopedPageProps) {
  return (
    <PublicPageLayout>
      <section className="border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-emerald-700">{eyebrow}</p>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-9 text-slate-600 md:text-lg">
            {description}
          </p>
        </Container>
      </section>

      <section className="bg-slate-50 py-8">
        <Container>
          <UnitScopedTabs slug={slug} active={active} />
        </Container>
      </section>

      <section className="bg-slate-50 pb-14 md:pb-16">
        <Container>
          <UnitEmptyState title={emptyTitle} description={emptyDescription} />
        </Container>
      </section>
    </PublicPageLayout>
  );
}
