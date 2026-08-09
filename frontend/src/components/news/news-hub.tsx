"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import {
  type KeyboardEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { partitionNews } from "@/lib/news/partition-news";
import { getPublicNews } from "@/services/public-content-service";
import type { PublicNewsItem } from "@/types/public-content";

function formatDate(value: string | null | undefined) {
  if (!value) return "تاریخ انتشار ثبت نشده";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "تاریخ انتشار ثبت نشده";

  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function NewsMeta({ item }: { item: PublicNewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays aria-hidden="true" className="size-4" />
        {formatDate(item.published_at)}
      </span>
      {item.category ? <span>{item.category.title}</span> : null}
      {item.unit ? <span>{item.unit.title}</span> : null}
    </div>
  );
}

function NewsImage({
  item,
  eager = false,
}: {
  item: PublicNewsItem;
  eager?: boolean;
}) {
  const image = safePublicMediaUrl(item.cover_image ?? item.image);

  return image ? (
    <img
      src={image}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      className="size-full object-cover"
    />
  ) : (
    <div className="flex size-full items-center justify-center bg-slate-100 text-slate-400">
      <Newspaper aria-hidden="true" className="size-10" />
    </div>
  );
}

function FeaturedSlider({ items }: { items: PublicNewsItem[] }) {
  const [active, setActive] = useState(0);
  const touchStart = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const current = items[active];

  const move = useCallback(
    (direction: 1 | -1) => {
      setActive((index) => (index + direction + items.length) % items.length);
    },
    [items.length],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(items.length - 1);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStart.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStart.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 48) return;
    move(delta < 0 ? -1 : 1);
  }

  return (
    <section
      aria-labelledby="featured-news-title"
      aria-roledescription="اسلایدر"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="featured-news-title" className="text-2xl font-black text-[#0f2f4a]">
          خبرهای ویژه
        </h2>
        <p className="text-sm font-bold text-slate-500">
          {new Intl.NumberFormat("fa-IR").format(active + 1)} از{" "}
          {new Intl.NumberFormat("fa-IR").format(items.length)}
        </p>
      </div>

      <article className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,47,74,0.08)] lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative aspect-[16/10] min-h-64 overflow-hidden bg-slate-100 lg:aspect-auto">
          <div
            key={current.id}
            className={reducedMotion ? "size-full" : "size-full animate-[fadeIn_240ms_ease-out]"}
          >
            <NewsImage item={current} eager />
          </div>
        </div>
        <div className="flex min-h-72 flex-col justify-center p-6 text-right sm:p-8">
          <NewsMeta item={current} />
          <h3 className="mt-4 text-2xl font-black leading-[1.7] text-[#0f2f4a]">
            {current.title}
          </h3>
          {current.summary ? (
            <p className="mt-4 line-clamp-3 text-sm font-bold leading-8 text-slate-600">
              {current.summary}
            </p>
          ) : null}
          <Link
            href={`/news/${encodeURIComponent(current.slug)}`}
            className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            مشاهده خبر
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </article>

      {items.length > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex gap-2" role="group" aria-label="انتخاب خبر ویژه">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`نمایش خبر ${index + 1}: ${item.title}`}
                aria-current={index === active ? "true" : undefined}
                className={`size-11 rounded-full border transition ${
                  index === active
                    ? "border-[#12395b] bg-[#12395b]"
                    : "border-slate-300 bg-white hover:border-blue-500"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mx-auto block size-2 rounded-full ${
                    index === active ? "bg-white" : "bg-slate-400"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="خبر ویژه قبلی"
              className="flex size-11 items-center justify-center rounded-full border border-slate-300 bg-white text-[#12395b] transition hover:border-blue-500"
            >
              <ArrowRight aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="خبر ویژه بعدی"
              className="flex size-11 items-center justify-center rounded-full border border-slate-300 bg-white text-[#12395b] transition hover:border-blue-500"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {current.title}
      </p>
    </section>
  );
}

function ImportantNews({ items }: { items: PublicNewsItem[] }) {
  return (
    <section aria-labelledby="important-news-title">
      <h2 id="important-news-title" className="mb-5 text-2xl font-black text-[#0f2f4a]">
        خبرهای مهم
      </h2>
      {items.length ? <div className="grid gap-5 lg:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="grid overflow-hidden rounded-lg border-r-4 border-r-[#b87522] border-y border-l border-slate-200 bg-white sm:grid-cols-[11rem_1fr]"
          >
            <div className="aspect-[16/10] overflow-hidden bg-slate-100 sm:aspect-auto">
              <NewsImage item={item} />
            </div>
            <div className="p-5 text-right">
              <NewsMeta item={item} />
              <h3 className="mt-3 text-lg font-black leading-8 text-[#0f2f4a]">
                <Link href={`/news/${encodeURIComponent(item.slug)}`} className="hover:text-blue-700">
                  {item.title}
                </Link>
              </h3>
              {item.summary ? (
                <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">
                  {item.summary}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div> : (
        <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
          خبر مهم دیگری خارج از اسلایدر منتشر نشده است.
        </div>
      )}
    </section>
  );
}

function UnitNews({ items }: { items: PublicNewsItem[] }) {
  return (
    <section aria-labelledby="unit-news-title">
      <h2 id="unit-news-title" className="mb-5 text-2xl font-black text-[#0f2f4a]">
        منتخب واحدهای آموزشی
      </h2>
      {items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="aspect-[16/9] overflow-hidden bg-slate-100">
              <NewsImage item={item} />
            </div>
            <div className="p-5 text-right">
              <NewsMeta item={item} />
              <h3 className="mt-3 text-base font-black leading-8 text-[#0f2f4a]">
                <Link href={`/news/${encodeURIComponent(item.slug)}`} className="hover:text-blue-700">
                  {item.title}
                </Link>
              </h3>
              {item.summary ? (
                <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-600">
                  {item.summary}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div> : (
        <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
          خبر منتخب دیگری از واحدهای آموزشی منتشر نشده است.
        </div>
      )}
    </section>
  );
}

export function NewsHub() {
  const [items, setItems] = useState<PublicNewsItem[] | null>(null);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getPublicNews({ page_size: 100, ordering: "-published_at" })
      .then((response) => {
        if (!controller.signal.aborted) {
          setError("");
          setItems(response.results);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(reason));
      });
    return () => controller.abort();
  }, [requestVersion]);

  const sections = useMemo(() => {
    return partitionNews(items ?? []);
  }, [items]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center">
        <h2 className="text-xl font-black text-[#0f2f4a]">دریافت اخبار انجام نشد</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setItems(null);
            setError("");
            setRequestVersion((value) => value + 1);
          }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (items === null) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="در حال دریافت اخبار"
        className="space-y-8"
      >
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <Newspaper aria-hidden="true" className="mx-auto size-10 text-slate-400" />
        <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">خبر منتشرشده‌ای وجود ندارد</h2>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {sections.featured.length ? (
        <FeaturedSlider items={sections.featured} />
      ) : (
        <section aria-labelledby="featured-news-title">
          <h2 id="featured-news-title" className="mb-5 text-2xl font-black text-[#0f2f4a]">
            خبرهای ویژه
          </h2>
          <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
            خبر ویژه، مهم یا اولویت‌داری منتشر نشده است.
          </div>
        </section>
      )}
      <ImportantNews items={sections.important} />
      <UnitNews items={sections.units} />
    </div>
  );
}
