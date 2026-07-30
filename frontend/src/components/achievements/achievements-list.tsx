"use client";

import Link from "next/link";
import { Award, CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { getPublicAchievements } from "@/services/public-content-service";
import type { PublicAchievement } from "@/types/public-content";

export function AchievementsList() {
  const [items, setItems] = useState<PublicAchievement[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPublicAchievements({ page_size: 100, ordering: "-achievement_date" })
      .then((response) => {
        if (!cancelled) {
          setError("");
          setItems(response.results);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center">
        <p className="text-sm font-bold text-rose-700">{error}</p>
        <button type="button" onClick={() => {
          setItems(null);
          setError("");
          setVersion((value) => value + 1);
        }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white">
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </div>
    );
  }
  if (items === null) {
    return <div aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />)}</div>;
  }
  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><Award aria-hidden="true" className="mx-auto size-10 text-slate-400" /><h2 className="mt-4 text-xl font-black text-[#0f2f4a]">افتخار منتشرشده‌ای وجود ندارد</h2></div>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const image = safePublicMediaUrl(item.cover_image ?? item.image);
        return (
          <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="aspect-[16/10] overflow-hidden bg-slate-100">
              {image ? <img src={image} alt="" loading="lazy" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-slate-400"><Award aria-hidden="true" className="size-10" /></div>}
            </div>
            <div className="p-5 text-right">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                {item.achievement_date ? <time dateTime={item.achievement_date} className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4" />{new Intl.DateTimeFormat("fa-IR").format(new Date(item.achievement_date))}</time> : null}
                {item.related_unit ? <span>{item.related_unit.title}</span> : null}
              </div>
              <h2 className="mt-3 text-lg font-black leading-8 text-[#0f2f4a]">
                <Link href={`/achievements/${encodeURIComponent(item.slug)}`} className="hover:text-blue-700">{item.title}</Link>
              </h2>
              {item.summary ? <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">{item.summary}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
