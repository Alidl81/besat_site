"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/page/empty-state";
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

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

export function NewsListContent() {
  const [items, setItems] = useState<ContentRecord[] | null>(null);

  useEffect(() => {
    contentRepository.list().then((records) => {
      const newsItems = records
        .filter((item) => item.kind === "news" && item.status === "published")
        .sort((a, b) => {
          const dateA = new Date(a.published_at ?? a.created_at).getTime();
          const dateB = new Date(b.published_at ?? b.created_at).getTime();

          return dateB - dateA;
        });

      setItems(newsItems);
    });
  }, []);

  if (items === null) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
        <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="خبری برای نمایش وجود ندارد." />;
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const href = `/news/${encodeURIComponent(item.slug)}`;
        const summary = item.summary || stripHtml(item.body_html).slice(0, 150);
        const dateLabel = formatDate(item.published_at ?? item.created_at);
        const coverImage = normalizeMediaSrc(item.cover_image);

        return (
          <article
            key={item.id}
            className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
          >
            <Link href={href} className="block">
              {coverImage ? (
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  <img
                    src={coverImage}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gradient-to-br from-[#143e61]/10 via-[#0d3157]/5 to-emerald-50" />
              )}

              <div className="p-5">
                {item.category ? (
                  <span className="mb-3 inline-block rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {item.category}
                  </span>
                ) : null}

                <h2 className="line-clamp-2 text-base font-black leading-[1.7] text-[#062452]">
                  {item.title}
                </h2>

                {summary ? (
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-500">
                    {summary}
                  </p>
                ) : null}

                {dateLabel ? (
                  <p className="mt-4 text-xs font-black text-slate-400">
                    {dateLabel}
                  </p>
                ) : null}
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}