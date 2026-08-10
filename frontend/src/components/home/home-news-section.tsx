"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicNews } from "@/services/public-content-service";
import type { PublicNewsItem } from "@/types/public-content";

function formatDate(value: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export function HomeNewsSection() {
  const [news, setNews] = useState<PublicNewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    // Disjoint with the slider (is_featured) and the /news archive
    // (is_featured=false && is_important=false): this section shows only
    // is_important=true && is_featured=false, ordered by priority.
    getPublicNews({
      page_size: 4,
      important: "true",
      featured: "false",
      ordering: "-priority",
    })
      .then(({ results }) => {
        if (!mounted) return;
        setFailed(false);
        setNews(results);
      })
      .catch(() => {
        if (!mounted) return;
        setNews([]);
        setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [requestKey]);

  return (
    <section dir="rtl" className="bg-[#fbfaf7] px-5 pb-16 pt-4 sm:px-8 lg:pb-20 lg:pt-5">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-7 flex items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-3 text-xs font-black text-[#c98c3d]">
              <span className="h-px w-8 bg-[#c98c3d]" />
              در جریان بعثت باشید
            </p>
            <h2 className="text-2xl font-black text-[#0a2848] sm:text-3xl">اخبار و رویدادها</h2>
          </div>
          <Link href="/news" className="inline-flex items-center gap-2 text-xs font-black text-[#0a2848] transition hover:text-[#c98c3d]">
            مشاهده همه اخبار
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        {news === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="overflow-hidden rounded-[1.15rem] border border-[#e2e5e8] bg-white">
                <div className="aspect-[16/9] animate-pulse bg-slate-100" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-5 w-full animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="border border-rose-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-bold text-rose-700">
              دریافت خبرها با خطا روبه‌رو شد.
            </p>
            <button
              type="button"
              onClick={() => {
                setNews(null);
                setFailed(false);
                setRequestKey((value) => value + 1);
              }}
              className="mt-4 min-h-11 border border-[#0a2848] px-5 text-sm font-black text-[#0a2848]"
            >
              تلاش دوباره
            </button>
          </div>
        ) : news.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {news.map((item, index) => (
              <Link
                key={item.id}
                data-stagger-item
                style={{ animationDelay: `${index * 90}ms` }}
                href={`/news/${item.slug}`}
                className="group overflow-hidden rounded-[1.15rem] border border-[#e2e5e8] bg-white shadow-[0_10px_25px_rgba(8,30,55,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#d8aa65]/55 hover:shadow-[0_20px_40px_rgba(8,30,55,0.1)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#e8edf1]">
                  {item.cover_image ? (
                    <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(135deg,#133b5f,#8ea7ba)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06182b]/42 via-transparent to-transparent" />
                  {item.category ? (
                    <span className="absolute right-3 top-3 rounded-lg bg-[#0a2848]/85 px-3 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                      {item.category.title}
                    </span>
                  ) : null}
                </div>
                <div className="p-4 text-right">
                  <h3 className="text-[13px] font-black leading-7 text-[#0a2848] line-clamp-2">{item.title}</h3>
                  <p className="mt-2 text-[10px] font-bold text-slate-400">{formatDate(item.published_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.15rem] border border-dashed border-[#d8dde2] bg-white px-6 py-10 text-center text-sm font-bold text-slate-500">
            خبر تازه‌ای برای نمایش وجود ندارد.
          </div>
        )}
      </div>
    </section>
  );
}
