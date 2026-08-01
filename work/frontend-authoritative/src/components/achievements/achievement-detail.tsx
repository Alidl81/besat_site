"use client";

import { Award, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { getPublicAchievement } from "@/services/public-content-service";
import type { PublicAchievement } from "@/types/public-content";

export function AchievementDetail({ slug }: { slug: string }) {
  const [item, setItem] = useState<PublicAchievement | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getPublicAchievement(slug).then((response) => { if (!cancelled) setItem(response); }).catch((reason) => { if (!cancelled) setError(getApiErrorMessage(reason)); });
    return () => { cancelled = true; };
  }, [slug, version]);
  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center"><p className="text-rose-700">{error}</p><button type="button" onClick={() => setVersion((value) => value + 1)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"><RefreshCw aria-hidden="true" className="size-4" />تلاش دوباره</button></div>;
  if (!item) return <div aria-busy="true" className="h-96 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />;
  const image = safePublicMediaUrl(item.cover_image ?? item.image);
  return (
    <article className="mx-auto max-w-4xl text-right">
      {image ? <div className="aspect-[16/9] overflow-hidden rounded-lg bg-slate-100"><img src={image} alt="" loading="eager" className="size-full object-cover" /></div> : <Award aria-hidden="true" className="size-12 text-slate-400" />}
      <h1 className="mt-8 text-3xl font-black leading-[1.5] text-[#0f2f4a]">{item.title}</h1>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-slate-500">
        {item.achievement_date ? <time dateTime={item.achievement_date}>{new Intl.DateTimeFormat("fa-IR").format(new Date(item.achievement_date))}</time> : null}
        {item.related_unit ? <span>{item.related_unit.title}</span> : null}
      </div>
      {item.description || item.summary ? <p className="mt-8 whitespace-pre-line text-base font-bold leading-9 text-slate-700">{item.description || item.summary}</p> : null}
    </article>
  );
}

