"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { BookOpen, FilePenLine, Newspaper, Play } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useHeroVisibility } from "@/lib/home/hero-visibility-context";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { isSafeExternalHttpUrl, isSafeRelativePath } from "@/lib/url-safety";
import {
  getPublicHomeSlides,
  getPublicNews,
  getPublicSiteSettings,
} from "@/services/public-content-service";

const slideDuration = 6200;

type Slide = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  title?: string;
  subtitle?: string;
};

// FE-HOME-SLIDE-HREF-001: a CMS-authored slide's `href` (backend/apps/home/
// models.py's own help_text: "می‌تواند مسیر داخلی مثل /about یا لینک کامل
// باشد" -- "can be an internal path like /about or a full link") is
// admin-entered free text, not a value this frontend can trust by
// construction -- an unsafe value (`javascript:`, `data:`, a protocol-
// relative bypass) must never reach a real `<Link href>`. Validating once
// here, at slide-mapping time, mirrors how `imageSrc` is already validated
// via `safePublicMediaUrl()` two lines below -- the rest of the component
// only ever sees an `href` that's already known-safe (or `undefined`),
// exactly like `imageSrc` is only ever a known-safe URL or excluded
// entirely.
function safeSlideHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return isSafeRelativePath(value) || isSafeExternalHttpUrl(value) ? value : undefined;
}

export function HomeSliderSection() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const visibleSlides = slides ?? [];
  const { setHasVisibleHero } = useHeroVisibility();

  useEffect(() => {
    // Tell SiteHeader whether there's an actual dark hero behind it.
    // `slides === null` (still loading) is deliberately left as the
    // existing default (true) rather than flipped to false here, so the
    // header doesn't flash solid-then-transparent while the initial
    // request is in flight.
    if (slides !== null) setHasVisibleHero(visibleSlides.length > 0);
  }, [slides, visibleSlides.length, setHasVisibleHero]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getPublicHomeSlides(),
      getPublicSiteSettings(),
      // Featured news (is_featured=true) belongs in the main slider only —
      // it must never also appear in the homepage "important" section or
      // the /news archive (enforced by their own is_featured/is_important
      // filters).
      getPublicNews({ featured: "true", ordering: "-priority", page_size: 5 }).catch(
        () => ({ results: [] as Awaited<ReturnType<typeof getPublicNews>>["results"] }),
      ),
    ])
      .then(([all, settings, featuredNews]) => {
        if (!mounted) return;
        const newsSlides: Slide[] = featuredNews.results
          .map((item): Slide | null => {
            const imageSrc = safePublicMediaUrl(item.cover_image ?? item.image);
            return imageSrc
              ? {
                  id: `news-${item.id}`,
                  imageSrc,
                  imageAlt: item.title,
                  href: `/news/${encodeURIComponent(item.slug)}`,
                  title: item.title,
                  subtitle: item.summary ?? undefined,
                }
              : null;
          })
          .filter((slide): slide is Slide => slide !== null);
        const cmsSlides = all
          .filter((slide) => slide.is_active && slide.image)
          .sort((a, b) => a.order - b.order)
          .map((slide): Slide | null => {
            const imageSrc = safePublicMediaUrl(slide.image);
            return imageSrc
              ? {
                  id: String(slide.id),
                  imageSrc,
                  imageAlt: slide.alt_text ?? slide.title ?? settings.school_name ?? "",
                  href: safeSlideHref(slide.href),
                  title: slide.title ?? undefined,
                  subtitle: slide.subtitle ?? undefined,
                }
              : null;
          })
          .filter((slide): slide is Slide => slide !== null);
        const mapped = [...newsSlides, ...cmsSlides];
        const heroImageSrc = safePublicMediaUrl(settings.hero_image);
        setSlides(
          mapped.length > 0
            ? mapped
            : heroImageSrc
              ? [
                  {
                    id: "site-hero",
                    imageSrc: heroImageSrc,
                    imageAlt: settings.school_name ?? "",
                    title: settings.hero_title ?? undefined,
                    subtitle: settings.hero_subtitle ?? undefined,
                  },
                ]
              : [],
        );
        setActiveIndex(0);
      })
      .catch(() => setSlides([]));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (visibleSlides.length <= 1 || reducedMotion || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleSlides.length);
    }, slideDuration);
    return () => window.clearInterval(timer);
  }, [reducedMotion, paused, visibleSlides.length]);

  function goToSlide(index: number) {
    setActiveIndex(((index % visibleSlides.length) + visibleSlides.length) % visibleSlides.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // RTL reading direction: left is "forward" (next), right is "back".
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToSlide(visibleSlides.length - 1);
    }
  }

  if (slides === null) {
    return (
      <div
        role="status"
        aria-label="در حال بارگذاری تصویر اصلی"
        className="min-h-[660px] animate-pulse bg-[#071b31] motion-reduce:animate-none"
      />
    );
  }

  if (visibleSlides.length === 0) {
    return (
      <section
        dir="rtl"
        className="flex min-h-[660px] flex-col items-center justify-center bg-[#071b31] px-5 py-16 text-center text-white sm:min-h-[700px] lg:min-h-[720px]"
      >
        <p className="mb-4 flex items-center gap-3 text-xs font-black tracking-wide text-[#e7b665] sm:text-sm">
          <span className="h-px w-9 bg-[#e7b665]" />
          مجتمع آموزشی، تربیتی و فرهنگی بعثت
          <span className="h-px w-9 bg-[#e7b665]" />
        </p>
        <h1 className="max-w-[700px] text-[2.25rem] font-black leading-[1.45] text-white drop-shadow-sm sm:text-5xl lg:text-[3.55rem] lg:leading-[1.35]">
          پیوند آموزش و بصیرت دینی
        </h1>
        <p className="mt-5 max-w-[610px] text-sm font-bold leading-8 text-white/82 sm:text-base sm:leading-9">
          به وب‌سایت رسمی مجتمع آموزشی، تربیتی و فرهنگی بعثت خوش آمدید.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/registration"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#e2ae5b] px-6 text-sm font-black text-[#0b213c] shadow-[0_15px_35px_rgba(226,174,91,0.2)] transition hover:-translate-y-0.5 hover:bg-[#edc57f]"
          >
            <FilePenLine className="size-5" aria-hidden="true" />
            پیش‌ثبت‌نام آنلاین
          </Link>
          <Link
            href="/about"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/65 bg-white/[0.04] px-6 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/12"
          >
            <BookOpen className="size-5" aria-hidden="true" />
            آشنایی با بعثت
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      dir="rtl"
      role="region"
      aria-roledescription="اسلایدر"
      aria-label="اسلایدر معرفی مجتمع بعثت"
      tabIndex={0}
      onKeyDown={visibleSlides.length > 1 ? handleKeyDown : undefined}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative min-h-[660px] overflow-hidden bg-[#071b31] text-white outline-none sm:min-h-[700px] lg:min-h-[720px] focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/60"
    >
      <div aria-live="polite" className="sr-only">
        {visibleSlides[activeIndex]?.title}
      </div>
      <div className="absolute inset-0">
        {visibleSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition duration-[1400ms] ease-out ${
              index === activeIndex ? "scale-100 opacity-100" : "scale-[1.035] opacity-0"
            }`}
          >
            <img src={slide.imageSrc} alt={slide.imageAlt} className={`h-full w-full object-cover ${index === activeIndex && !reducedMotion ? "besat-hero-ken-burns" : ""}`} draggable={false} />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,17,31,0.34)_0%,rgba(4,17,31,0.58)_44%,rgba(4,17,31,0.91)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,14,27,0.22)_0%,rgba(3,14,27,0.03)_42%,rgba(3,14,27,0.72)_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_72%_28%,rgba(227,177,94,0.22),transparent_32%)]" />

      <div className="relative mx-auto flex min-h-[660px] w-full max-w-[1440px] items-center px-5 pb-24 pt-28 sm:min-h-[700px] sm:px-8 sm:pt-32 lg:min-h-[720px] lg:px-12 lg:pb-28 lg:pt-36 2xl:px-16">
        <div key={visibleSlides[activeIndex]?.id} className="max-w-[700px] text-right">
          <p className="besat-hero-line besat-hero-line-1 mb-4 flex items-center gap-3 text-xs font-black tracking-wide text-[#e7b665] sm:text-sm">
            <span className="h-px w-9 bg-[#e7b665]" />
            مجتمع آموزشی، تربیتی و فرهنگی بعثت
          </p>
          <h1 className="besat-hero-line besat-hero-line-2 max-w-[640px] text-[2.25rem] font-black leading-[1.45] text-white drop-shadow-sm sm:text-5xl lg:text-[3.55rem] lg:leading-[1.35]">
            {visibleSlides[activeIndex]?.title}
          </h1>
          <p className="besat-hero-line besat-hero-line-3 mt-5 max-w-[610px] text-sm font-bold leading-8 text-white/82 sm:text-base sm:leading-9">
            {visibleSlides[activeIndex]?.subtitle}
          </p>

          <div className="besat-hero-line besat-hero-line-4 mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            {visibleSlides[activeIndex]?.href ? (
              <Link
                href={visibleSlides[activeIndex]?.href ?? "/news"}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#e2ae5b] px-6 text-sm font-black text-[#0b213c] shadow-[0_15px_35px_rgba(226,174,91,0.2)] transition hover:-translate-y-0.5 hover:bg-[#edc57f]"
              >
                <Newspaper className="size-5" aria-hidden="true" />
                مطالعه کامل خبر
              </Link>
            ) : (
              <>
                <Link
                  href="/registration"
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#e2ae5b] px-6 text-sm font-black text-[#0b213c] shadow-[0_15px_35px_rgba(226,174,91,0.2)] transition hover:-translate-y-0.5 hover:bg-[#edc57f]"
                >
                  <FilePenLine className="size-5" aria-hidden="true" />
                  پیش‌ثبت‌نام آنلاین
                </Link>
                <Link
                  href="/about"
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/65 bg-white/[0.04] px-6 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/12"
                >
                  <BookOpen className="size-5" aria-hidden="true" />
                  آشنایی با بعثت
                </Link>
              </>
            )}
          </div>

          <Link href="/gallery" className="besat-hero-line besat-hero-line-5 mt-10 inline-flex items-center gap-3 text-xs font-bold text-white/82 transition hover:text-[#e7b665]">
            <span className="flex size-10 items-center justify-center rounded-full border border-white/55 bg-white/8 text-white backdrop-blur-sm">
              <Play className="size-5" aria-hidden="true" />
            </span>
            ویدئوی معرفی مجتمع بعثت
          </Link>
        </div>
      </div>

      {visibleSlides.length > 1 ? (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-full border border-white/15 bg-[#06182b]/42 px-1 py-1 backdrop-blur-md">
          {visibleSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`نمایش اسلاید ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className="flex h-6 w-6 shrink-0 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`block h-2 rounded-full transition-all duration-500 ${
                  index === activeIndex ? "w-8 bg-[#e2ae5b]" : "w-2 bg-white/55 hover:bg-white"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
