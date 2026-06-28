"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { contentRepository } from "@/lib/data/repositories";
import type { ContentRecord } from "@/lib/data/domain-types";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function formatDate(dateStr: string | null | undefined): string {
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

export function HomeNewsSection() {
  const [news, setNews] = useState<ContentRecord[] | null>(null);

  useEffect(() => {
    contentRepository.list().then((all) => {
      const published = all
        .filter((c) => c.kind === "news" && c.status === "published" && c.scope === "school")
        .sort(
          (a, b) =>
            new Date(b.published_at ?? b.created_at).getTime() -
            new Date(a.published_at ?? a.created_at).getTime(),
        )
        .slice(0, 3);
      setNews(published);
    });
  }, []);

  if (news === null) return <div className="bg-[#f8fafc] py-14" />;
  if (news.length === 0) return null;

  return (
    <section dir="rtl" className="bg-[#f8fafc] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div className="text-right">
            <p className="mb-2 text-sm font-black text-emerald-600">اخبار</p>
            <h2 className="text-3xl font-black leading-[1.5] text-[#062452] sm:text-4xl">
              آخرین اخبار مدرسه
            </h2>
          </div>
          <Link
            href="/news"
            className="hidden shrink-0 items-center gap-2 text-sm font-black text-emerald-700 transition hover:text-emerald-800 sm:flex"
          >
            <span>همه اخبار</span>
            <ArrowIcon />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item, index) => (
            <Link
              key={item.id}
              href="/news"
              className={`group overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] ${
                index === 0 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              {item.cover_image ? (
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  <img
                    src={item.cover_image}
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

                <h3 className="text-base font-black leading-[1.7] text-[#062452] line-clamp-2">
                  {item.title}
                </h3>

                {item.summary ? (
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500 line-clamp-2">
                    {item.summary}
                  </p>
                ) : null}

                {item.published_at ? (
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                    <CalendarIcon />
                    <span>{formatDate(item.published_at)}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Link
            href="/news"
            className="flex items-center justify-center gap-2 rounded-[1.75rem] border border-emerald-200 bg-white px-5 py-4 text-sm font-black text-emerald-700 transition duration-500 hover:bg-emerald-50"
          >
            <span>مشاهده همه اخبار</span>
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
