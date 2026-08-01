"use client";

import { useEffect, useState } from "react";
import { staticPagesRepository } from "@/lib/data/repositories";
import { Container } from "@/components/shared/container";
import type { StaticPageRecord } from "@/lib/data/domain-types";

export function AboutPageContent() {
  const [page, setPage] = useState<StaticPageRecord | null | "loading">("loading");

  useEffect(() => {
    staticPagesRepository.list().then((all) => {
      const found = all.find((p) => p.slug === "about") ?? null;
      setPage(found);
    });
  }, []);

  if (page === "loading") {
    return (
      <section className="bg-white py-14">
        <Container>
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        </Container>
      </section>
    );
  }

  if (!page || !page.body_html) return null;

  return (
    <section className="bg-white py-14 md:py-16">
      <Container>
        <article className="rounded-[2rem] border border-slate-200 bg-white p-8 text-right shadow-sm">
          {page.title ? (
            <h2 className="mb-6 text-2xl font-black text-[#062452]">{page.title}</h2>
          ) : null}
          <div
            className="besat-rich-content"
            dangerouslySetInnerHTML={{ __html: page.body_html }}
          />
        </article>
      </Container>
    </section>
  );
}
