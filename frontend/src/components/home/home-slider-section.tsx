"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { homeSlidesRepository } from "@/lib/data/repositories";

const slideDuration = 5200;

type Slide = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  title?: string;
  subtitle?: string;
};

export function HomeSliderSection() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    homeSlidesRepository.list().then((all) => {
      const mapped = all
        .filter((s) => s.is_active && s.image)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: s.id,
          imageSrc: s.image,
          imageAlt: s.title ?? "اسلاید صفحه اصلی مدرسه بعثت",
          href: s.href ?? undefined,
          title: s.title ?? undefined,
          subtitle: s.subtitle ?? undefined,
        }));
      setSlides(mapped);
    });
  }, []);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, slideDuration);

    return () => {
      window.clearInterval(timer);
    };
  }, [slides.length]);

  if (slides.length === 0) {
    return null;
  }

  return (
    <section dir="rtl" className="bg-[#f8fafc] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <div className="relative aspect-[16/7] min-h-[18rem] w-full overflow-hidden bg-slate-100">
            {slides.map((slide, index) => {
              const isActive = index === activeIndex;

              const content = (
                <>
                  <img
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />

                  {(slide.title || slide.subtitle) ? (
                    <span className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent p-5 sm:p-8 lg:p-10">
                      <span className="max-w-2xl text-right">
                        {slide.subtitle ? (
                          <span className="mb-3 block text-sm font-black text-emerald-300">
                            {slide.subtitle}
                          </span>
                        ) : null}

                        {slide.title ? (
                          <span className="block text-2xl font-black leading-[1.6] text-white sm:text-4xl">
                            {slide.title}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  ) : null}
                </>
              );

              const className = `absolute inset-0 block transition duration-1000 ease-out ${
                isActive ? "z-10 scale-100 opacity-100" : "z-0 scale-[1.03] opacity-0"
              }`;

              if (slide.href) {
                return (
                  <Link
                    key={slide.id}
                    href={slide.href}
                    aria-label={slide.imageAlt}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div key={slide.id} className={className}>
                  {content}
                </div>
              );
            })}
          </div>

          {slides.length > 1 ? (
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-slate-950/35 px-3 py-2 backdrop-blur-md">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`نمایش اسلاید ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition duration-500 ${
                    index === activeIndex
                      ? "w-8 bg-emerald-400"
                      : "w-2.5 bg-white/70 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
