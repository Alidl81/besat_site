"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { homeSlidesRepository } from "@/lib/data/repositories";

const slideDuration = 6200;

type Slide = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  title?: string;
  subtitle?: string;
};

const fallbackSlides: Slide[] = [
  {
    id: "home-fallback",
    imageSrc: "/images/official/hero/besat-main.jpg",
    imageAlt: "نمای مجتمع آموزشی بعثت",
  },
];

function resolveOfficialSeedImage(id: string, image: string) {
  if (id === "slide-1" && image === "/images/home-slider/slide-1.jpg") {
    return "/images/official/hero/besat-main.jpg";
  }
  if (id === "slide-2" && image === "/images/home-slider/slide-2.png") {
    return "/images/official/hero/besat-hs-banner-03.jpg";
  }
  return image;
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="m9 7 8 5-8 5V7Z" />
    </svg>
  );
}

export function HomeSliderSection() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleSlides = slides.length > 0 ? slides : fallbackSlides;

  useEffect(() => {
    let mounted = true;

    homeSlidesRepository
      .list()
      .then((all) => {
        if (!mounted) return;
        const mapped = all
          .filter((slide) => slide.is_active && slide.image)
          .sort((a, b) => a.order - b.order)
          .map((slide) => ({
            id: slide.id,
            imageSrc: resolveOfficialSeedImage(slide.id, slide.image),
            imageAlt: slide.title ?? "اسلاید صفحه اصلی مجتمع آموزشی بعثت",
            href: slide.href ?? undefined,
            title: slide.title ?? undefined,
            subtitle: slide.subtitle ?? undefined,
          }));
        setSlides(mapped);
        setActiveIndex(0);
      })
      .catch(() => setSlides([]));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (visibleSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleSlides.length);
    }, slideDuration);
    return () => window.clearInterval(timer);
  }, [visibleSlides.length]);

  return (
    <section dir="rtl" className="relative min-h-[660px] overflow-hidden bg-[#071b31] text-white sm:min-h-[700px] lg:min-h-[720px]">
      <div className="absolute inset-0">
        {visibleSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition duration-[1400ms] ease-out ${
              index === activeIndex ? "scale-100 opacity-100" : "scale-[1.035] opacity-0"
            }`}
          >
            <img src={slide.imageSrc} alt={slide.imageAlt} className={`h-full w-full object-cover ${index === activeIndex ? "besat-hero-ken-burns" : ""}`} draggable={false} />
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
            {visibleSlides[activeIndex]?.title || "آینده‌ای روشن از مسیر آموزش و تربیت"}
          </h1>
          <p className="besat-hero-line besat-hero-line-3 mt-5 max-w-[610px] text-sm font-bold leading-8 text-white/82 sm:text-base sm:leading-9">
            {visibleSlides[activeIndex]?.subtitle ||
              "مجتمع آموزشی بعثت، با تکیه بر تجربه‌ای ماندگار و محیطی پویا، دانش‌آموزان را در مسیر رشد علمی، اخلاقی و معنوی همراهی می‌کند."}
          </p>

          <div className="besat-hero-line besat-hero-line-4 mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href="/registration"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#e2ae5b] px-6 text-sm font-black text-[#0b213c] shadow-[0_15px_35px_rgba(226,174,91,0.2)] transition hover:-translate-y-0.5 hover:bg-[#edc57f]"
            >
              <EditIcon />
              پیش‌ثبت‌نام آنلاین
            </Link>
            <Link
              href="/about"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/65 bg-white/[0.04] px-6 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/12"
            >
              <BookIcon />
              آشنایی با بعثت
            </Link>
          </div>

          <Link href="/gallery" className="besat-hero-line besat-hero-line-5 mt-10 inline-flex items-center gap-3 text-xs font-bold text-white/82 transition hover:text-[#e7b665]">
            <span className="flex size-10 items-center justify-center rounded-full border border-white/55 bg-white/8 text-white backdrop-blur-sm">
              <PlayIcon />
            </span>
            ویدئوی معرفی مجتمع بعثت
          </Link>
        </div>
      </div>

      {visibleSlides.length > 1 ? (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#06182b]/42 px-3 py-2 backdrop-blur-md">
          {visibleSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`نمایش اسلاید ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                index === activeIndex ? "w-8 bg-[#e2ae5b]" : "w-2 bg-white/55 hover:bg-white"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
