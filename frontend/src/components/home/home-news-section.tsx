"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ContentRecord } from "@/lib/data/domain-types";
import { contentRepository } from "@/lib/data/repositories";

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function EmptyNewsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return "";
  }

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

function getNewsTime(item: ContentRecord) {
  return new Date(item.published_at ?? item.created_at).getTime();
}

export function HomeNewsSection() {
  const [news, setNews] = useState<ContentRecord[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    contentRepository
      .list()
      .then((all) => {
        if (!isMounted) {
          return;
        }

        const publishedNews = all
          .filter((item) => item.kind === "news" && item.status === "published")
          .sort((a, b) => getNewsTime(b) - getNewsTime(a))
          .slice(0, 12);

        setNews(publishedNews);
      })
      .catch(() => {
        if (isMounted) {
          setNews([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateActiveCard() {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-news-card]"));

    if (cards.length === 0) {
      return;
    }

    const railRect = rail.getBoundingClientRect();
    const railCenter = railRect.left + railRect.width / 2;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - railCenter);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveIndex(nearestIndex);
  }

  function scrollByCard(direction: "next" | "prev") {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const firstCard = rail.querySelector<HTMLElement>("[data-news-card]");
    const distance = firstCard ? firstCard.offsetWidth + 20 : 360;

    rail.scrollBy({
      left: direction === "next" ? -distance : distance,
      behavior: "smooth",
    });
  }

  return (
    <section dir="rtl" className="bg-[#f8fafc] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-right">
            <p className="mb-2 text-sm font-black text-emerald-600">
              تازه‌ترین رویدادها
            </p>
            <h2 className="text-3xl font-black leading-[1.5] text-[#062452] sm:text-4xl">
              آخرین اخبار مدرسه
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-8 text-slate-500">
              جدیدترین خبرها و رویدادهای مجموعه آموزشی فرهنگی بعثت را اینجا دنبال کنید.
            </p>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={() => scrollByCard("prev")}
              className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-black text-[#062452] shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700"
              aria-label="خبر قبلی"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => scrollByCard("next")}
              className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-black text-[#062452] shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700"
              aria-label="خبر بعدی"
            >
              ›
            </button>

            <Link
              href="/news"
              className="mr-1 inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <span>همه اخبار</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>

        {news === null ? (
          <div className="flex gap-5 overflow-hidden">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="w-[82vw] shrink-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:w-[22rem] lg:w-[24rem]"
              >
                <div className="aspect-[16/9] animate-pulse bg-slate-100" />
                <div className="space-y-4 p-5">
                  <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-5 w-full animate-pulse rounded-full bg-slate-100" />
                  <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
              <EmptyNewsIcon />
            </div>
            <h3 className="text-xl font-black text-[#062452]">
              خبری برای نمایش وجود ندارد.
            </h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-8 text-slate-500">
              پس از ثبت و انتشار خبرها، آخرین موارد در این بخش نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#f8fafc] to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#f8fafc] to-transparent sm:w-24" />

            <div
              ref={railRef}
              onScroll={updateActiveCard}
              className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-4 pb-5 pt-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden"
            >
              {news.map((item, index) => {
                const distance = Math.abs(index - activeIndex);
                const isMain = distance === 0;
                const isNear = distance === 1;

                return (
                  <Link
                    key={item.id}
                    href="/news"
                    data-news-card
                    className={`group w-[82vw] shrink-0 snap-center overflow-hidden rounded-[2rem] border bg-white text-right shadow-sm transition-all duration-700 ease-out sm:w-[22rem] lg:w-[24rem] ${
                      isMain
                        ? "scale-100 border-emerald-200 opacity-100 shadow-[0_24px_60px_rgba(15,23,42,0.13)]"
                        : isNear
                          ? "scale-[0.94] border-slate-200 opacity-70 shadow-sm"
                          : "scale-[0.9] border-slate-200 opacity-45 shadow-none"
                    } hover:scale-100 hover:border-emerald-200 hover:opacity-100 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]`}
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
                      <div className="aspect-[16/9] bg-[linear-gradient(135deg,rgba(20,62,97,0.12),rgba(16,185,129,0.12))]" />
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

                      <div className="mt-5 flex items-center justify-between gap-3">
                        {item.published_at ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <CalendarIcon />
                            <span>{formatDate(item.published_at)}</span>
                          </div>
                        ) : (
                          <span />
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                          ادامه خبر
                          <ArrowIcon />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
