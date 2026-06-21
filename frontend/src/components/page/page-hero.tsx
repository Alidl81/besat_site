import { Container } from "@/components/shared/container";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <Container className="py-14 md:py-20">
        {eyebrow ? (
          <p className="mb-4 text-sm font-bold text-emerald-700">{eyebrow}</p>
        ) : null}

        <h1 className="max-w-3xl text-3xl font-black leading-[1.4] tracking-tight text-slate-950 md:text-5xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-5 max-w-3xl text-base leading-9 text-slate-600 md:text-lg">
            {description}
          </p>
        ) : null}
      </Container>
    </section>
  );
}
