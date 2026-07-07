"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/page/empty-state";
import { RichContentRenderer } from "@/components/content/rich-content-renderer";
import { contentRepository } from "@/lib/data/repositories";
import type { ContentRecord } from "@/lib/data/domain-types";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";

  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return "";
  }
}

function normalizeMediaSrc(src: string | null) {
  if (!src) return null;

  if (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return src;
  }

  return `/${src}`;
}

export function NewsDetailContent({ slug }: { slug: string }) {
  const [item, setItem] = useState<ContentRecord | null | undefined>(undefined);

  useEffect(() => {
    contentRepository.list().then((records) => {
      const found =
        records.find(
          (record) =>
            record.kind === "news" &&
            record.status === "published" &&
            record.slug === slug,
        ) ?? null;

      setItem(found);
    });
  }, [slug]);

  if (item === undefined) {
    return (
      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto flex min-h-56 w-full max-w-4xl items-center justify-center rounded-[2rem] border border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
        </div>
      </section>
    );
  }

  if (item === null) {
    return (
      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <EmptyState title="خبر مورد نظر پیدا نشد." />
        </div>
      </section>
    );
  }

  const dateLabel = formatDate(item.published_at ?? item.created_at);
  const coverImage = normalizeMediaSrc(item.cover_image);

  return (
    <section className="bg-[#f8fafc] py-14">
      <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-sm">
        {coverImage ? (
          <div className="aspect-[16/9] overflow-hidden bg-slate-100">
            <img
              src={coverImage}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="p-5 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {item.category ? (
              <span className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                {item.category}
              </span>
            ) : null}

            {dateLabel ? (
              <span className="text-xs font-black text-slate-400">
                {dateLabel}
              </span>
            ) : null}
          </div>

          <h1 className="text-2xl font-black leading-[1.6] text-[#062452] sm:text-4xl">
            {item.title}
          </h1>

          {item.summary ? (
            <p className="mt-5 text-base font-bold leading-9 text-slate-500">
              {item.summary}
            </p>
          ) : null}

          <RichContentRenderer html={item.body_html} />

          <div className="mt-10 border-t border-slate-100 pt-5">
            <Link
              href="/news"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#062452] transition hover:bg-slate-50"
            >
              بازگشت به اخبار
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}