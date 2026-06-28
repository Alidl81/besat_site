import Link from "next/link";
import { homeIntroContent } from "@/lib/home/home-intro-data";

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
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

export function HomeIntroSection() {
  const content = homeIntroContent;

  if (!content.title || !content.body || !content.imageSrc) {
    return null;
  }

  return (
    <section dir="rtl" className="bg-[#f8fafc] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="order-2 text-right lg:order-1">
          {content.eyebrow ? (
            <p className="mb-3 text-sm font-black text-emerald-600">
              {content.eyebrow}
            </p>
          ) : null}

          <h2 className="text-3xl font-black leading-[1.7] text-[#062452] sm:text-4xl">
            {content.title}
          </h2>

          <p className="mt-5 max-w-3xl text-base font-bold leading-9 text-slate-600">
            {content.body}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={content.primaryLink.href}
              className="besat-navy-button inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#12395b] px-6 text-sm font-black transition duration-500 hover:bg-[#0d2f4d]"
            >
              <span>{content.primaryLink.label}</span>
              <ArrowIcon />
            </Link>

            <Link
              href={content.secondaryLink.href}
              className="inline-flex h-13 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition duration-500 hover:border-emerald-300 hover:text-emerald-700"
            >
              {content.secondaryLink.label}
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <div className="absolute -right-8 -top-8 size-28 rounded-full bg-emerald-300/25 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 size-32 rounded-full bg-[#12395b]/15 blur-2xl" />

            <img
              src={content.imageSrc}
              alt={content.imageAlt || content.title}
              className="relative aspect-[4/3] w-full rounded-[1.5rem] object-cover"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
