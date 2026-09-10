"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/page/empty-state";
import { contentRepository } from "@/lib/data/repositories";
import type { ContentRecord } from "@/lib/data/domain-types";
import { isSafeRelativePath } from "@/lib/url-safety";

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

// SEC-MOCK-PAYMENT-OPEN-REDIRECT-001 (same defect shape, proactively
// applied here too): `cover_image_url` is a free-text field a content
// manager can set via the CMS admin -- a bare `startsWith("/")` check also
// accepts a protocol-relative "//evil.example" or a tab-bypass
// "/\t/evil.example" unchanged, letting the public news list's <img>
// resolve off-origin.
function normalizeMediaSrc(src: string | null) {
  if (!src) return null;

  if (
    isSafeRelativePath(src) ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return src;
  }

  // A value that already starts with "/" but failed the safety check above
  // is protocol-relative or a parser-normalization bypass, not a bare
  // filename missing its leading slash -- reject it outright rather than
  // prepending another "/" (which wouldn't reliably neutralize it).
  if (src.startsWith("/")) return null;

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
        <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
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
        const dateLabel = formatDate(item.published_at);
        const coverImage = normalizeMediaSrc(item.cover_image);

        return (
          <article
            key={item.id}
            className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
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
                <div className="aspect-[16/9] bg-gradient-to-br from-[#143e61]/10 via-[#0d3157]/5 to-blue-50" />
              )}

              <div className="p-5">
                {item.category ? (
                  <span className="mb-3 inline-block rounded-xl bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
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

                {/* FE-A11Y-CONTRAST-PUBLIC-METADATA-001 (same defect pattern):
                    text-slate-400 on white measured 2.564:1, below AA's 4.5:1.
                    slate-600 gives real headroom (7.58:1) vs slate-500's
                    razor-thin pass. */}
                {dateLabel ? (
                  <p className="mt-4 text-xs font-black text-slate-600">
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
