"use client";

import Link from "next/link";
import { ImageIcon, Newspaper, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { UnitRegistrationCta } from "@/components/units/unit-registration-cta";
import { UnitScopedTabs } from "@/components/units/unit-scoped-tabs";
import { getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import {
  getPublicGallery,
  getPublicNews,
  getPublicUnit,
} from "@/services/public-content-service";
import type {
  PublicGalleryItem,
  PublicNewsItem,
  PublicSchoolUnit,
} from "@/types/public-content";

type UnitContentPageProps = {
  slug: string;
  type: "news" | "gallery";
};

export function UnitContentPage({ slug, type }: UnitContentPageProps) {
  const [unit, setUnit] = useState<PublicSchoolUnit | null>(null);
  const [items, setItems] = useState<Array<PublicNewsItem | PublicGalleryItem> | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPublicUnit(slug)
      .then(async (schoolUnit) => {
        const response =
          type === "news"
            ? await getPublicNews({ unit_id: schoolUnit.id, scope: "unit", page_size: 100 })
            : await getPublicGallery({ unit_id: schoolUnit.id, scope: "unit", page_size: 100 });
        if (!cancelled) {
          setError("");
          setUnit(schoolUnit);
          setItems(response.results);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, type, version]);

  return (
    <PublicPageLayout>
      <header className="border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <p className="mb-4 text-sm font-black text-blue-700">{type === "news" ? "اخبار واحد" : "گالری واحد"}</p>
          <h1 className="text-3xl font-black leading-[1.4] text-[#0f2f4a] md:text-5xl">
            {type === "news" ? "اخبار" : "گالری"} {unit?.title ?? ""}
          </h1>
        </Container>
      </header>
      <main className="bg-slate-50 py-8">
        <Container className="space-y-8">
          <UnitScopedTabs slug={slug} active={type} />
          {error ? (
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
          ) : items === null ? (
            <div aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />)}
            </div>
          ) : items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const image = safePublicMediaUrl("cover_image" in item ? item.cover_image : item.image);
                const href = type === "news" ? `/news/${encodeURIComponent(item.slug)}` : null;
                const card = (
                  <article className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                      {image ? <img src={image} alt={type === "gallery" && "alt_text" in item ? item.alt_text || item.title : ""} loading="lazy" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-slate-400">{type === "news" ? <Newspaper aria-hidden="true" className="size-9" /> : <ImageIcon aria-hidden="true" className="size-9" />}</div>}
                    </div>
                    <div className="p-5 text-right">
                      <h2 className="text-base font-black leading-8 text-[#0f2f4a]">{item.title}</h2>
                      {item.summary ? <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">{item.summary}</p> : null}
                    </div>
                  </article>
                );
                return href ? <Link key={item.id} href={href}>{card}</Link> : <div key={item.id}>{card}</div>;
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
              {type === "news" ? <Newspaper aria-hidden="true" className="mx-auto size-10 text-slate-400" /> : <ImageIcon aria-hidden="true" className="mx-auto size-10 text-slate-400" />}
              <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">
                {type === "news" ? "خبر منتشرشده‌ای برای این واحد وجود ندارد" : "تصویری برای این واحد وجود ندارد"}
              </h2>
            </div>
          )}
          {unit ? <UnitRegistrationCta unit={unit} /> : null}
        </Container>
      </main>
    </PublicPageLayout>
  );
}
