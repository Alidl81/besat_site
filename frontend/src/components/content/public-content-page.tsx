import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { PublicContentTabs } from "@/components/content/public-content-tabs";

type PublicContentPageProps = {
  active: "news";
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function PublicContentPage({
  active,
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: PublicContentPageProps) {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-emerald-700">{eyebrow}</p>

            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              {title}
            </h1>

            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              {description}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-8">
        <Container>
          <PublicContentTabs active={active} />
        </Container>
      </section>

      <section className="bg-slate-50 pb-14 md:pb-16">
        <Container>
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
              ◌
            </div>

            <h2 className="text-xl font-black text-[#0f2f4a]">{emptyTitle}</h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
              {emptyDescription}
            </p>
          </div>
        </Container>
      </section>
    </PublicPageLayout>
  );
}
