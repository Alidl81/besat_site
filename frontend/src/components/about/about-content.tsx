"use client";

import {
  Flag,
  History,
  ImageIcon,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CleanEmptyPanel } from "@/components/simple-pages/clean-empty-panel";
import { getApiErrorMessage } from "@/lib/api/client";
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { getAboutInfo } from "@/services/public-content-service";
import type { AboutInfo, AboutPerson } from "@/types/public-content";

function RichText({ value }: { value: string }) {
  return (
    <div
      className="besat-rich-content text-right text-base leading-9 text-slate-700"
      dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(value) }}
    />
  );
}

function PeopleSection({
  title,
  people,
}: {
  title: string;
  people: AboutPerson[];
}) {
  if (!people.length) return null;
  return (
    <section>
      <h2 className="mb-6 text-2xl font-black text-[#0f2f4a]">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person, index) => {
          const image = safePublicMediaUrl(person.image_url);
          return (
            <article
              key={`${person.name}-${index}`}
              className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-500 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70"
            >
              {image ? (
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <img src={image} alt={person.name} loading="lazy" className="size-full object-cover" />
                </div>
              ) : null}
              <div className="p-5 text-right">
                <h3 className="text-lg font-black text-[#0f2f4a]">{person.name}</h3>
                {person.title ? <p className="mt-1 text-sm font-bold text-blue-700">{person.title}</p> : null}
                {person.description ? (
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
                    {person.description}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AboutContent() {
  const [content, setContent] = useState<AboutInfo | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAboutInfo()
      .then((response) => {
        if (!cancelled) {
          setError("");
          setContent(response);
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
        <h2 className="text-xl font-black text-[#0f2f4a]">دریافت محتوای درباره ما انجام نشد</h2>
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setContent(null);
            setError("");
            setVersion((value) => value + 1);
          }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <div role="status" aria-busy="true" aria-live="polite" aria-label="در حال دریافت محتوای درباره ما" className="space-y-5">
        <div className="h-48 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
        <div className="h-72 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
      </div>
    );
  }

  const heroImage = safePublicMediaUrl(content.image);
  const videoUrl = safePublicMediaUrl(content.video_url);
  const poster = safePublicMediaUrl(content.video_poster_url);
  const hasContent =
    content.description ||
    heroImage ||
    content.history ||
    content.founders.length ||
    content.key_people.length ||
    content.mission ||
    content.values.length ||
    content.goals.length ||
    content.images.length ||
    videoUrl;

  if (!hasContent) {
    return (
      <CleanEmptyPanel
        icon="◌"
        title="محتوای این صفحه هنوز منتشر نشده است"
        description="پس از ثبت معرفی، تاریخچه یا سایر بخش‌های درباره ما، اطلاعات در همین صفحه نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="space-y-14">
      {content.description || heroImage ? (
        <section className="grid items-center gap-8 lg:grid-cols-[1fr_0.8fr]">
          {content.description ? <RichText value={content.description} /> : <div />}
          {heroImage ? (
            <div className="aspect-[4/3] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm">
              <img src={heroImage} alt="" loading="eager" className="size-full object-cover" />
            </div>
          ) : null}
        </section>
      ) : null}

      {content.history ? (
        <section className="rounded-[2rem] border border-slate-200 border-r-4 border-r-[#b87522] bg-white p-6 text-right shadow-sm sm:p-8">
          <h2 className="flex items-center gap-3 text-2xl font-black text-[#0f2f4a]">
            <History aria-hidden="true" className="size-6 text-[#9a5b14]" />
            تاریخچه
          </h2>
          <div className="mt-4"><RichText value={content.history} /></div>
        </section>
      ) : null}

      <PeopleSection title="بنیان‌گذاران" people={content.founders} />
      <PeopleSection title="افراد کلیدی" people={content.key_people} />

      {content.mission || content.values.length || content.goals.length ? (
        <section className="grid gap-5 lg:grid-cols-3">
          {content.mission ? (
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 text-right shadow-sm sm:p-8">
              <Flag aria-hidden="true" className="size-6 text-blue-700" />
              <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">ماموریت</h2>
              <div className="mt-3"><RichText value={content.mission} /></div>
            </article>
          ) : null}
          {content.values.length ? (
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 text-right shadow-sm sm:p-8">
              <Users aria-hidden="true" className="size-6 text-blue-700" />
              <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">ارزش‌ها</h2>
              <ul className="mt-4 space-y-3 text-sm font-bold leading-7 text-slate-600">
                {content.values.map((value) => <li key={value}>• {value}</li>)}
              </ul>
            </article>
          ) : null}
          {content.goals.length ? (
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 text-right shadow-sm sm:p-8">
              <Target aria-hidden="true" className="size-6 text-blue-700" />
              <h2 className="mt-4 text-xl font-black text-[#0f2f4a]">اهداف</h2>
              <ul className="mt-4 space-y-3 text-sm font-bold leading-7 text-slate-600">
                {content.goals.map((goal) => <li key={goal}>• {goal}</li>)}
              </ul>
            </article>
          ) : null}
        </section>
      ) : null}

      {content.images.length ? (
        <section>
          <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#0f2f4a]">
            <ImageIcon aria-hidden="true" className="size-6 text-blue-700" />
            تصاویر
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.images.map((item, index) => {
              const image = safePublicMediaUrl(item.url);
              if (!image) return null;
              return (
                <figure
                  key={`${item.url}-${index}`}
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-500 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <img src={image} alt={item.alt || ""} loading="lazy" className="size-full object-cover" />
                  </div>
                  {item.caption ? <figcaption className="p-4 text-sm font-bold text-slate-600">{item.caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      {videoUrl ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {content.video_title ? <h2 className="text-2xl font-black text-[#0f2f4a]">{content.video_title}</h2> : null}
          {content.video_description ? <p className="mt-3 text-sm font-bold leading-8 text-slate-600">{content.video_description}</p> : null}
          <video
            controls
            preload="metadata"
            poster={poster ?? undefined}
            aria-label={content.video_title || "ویدیوی معرفی مجتمع بعثت"}
            className="mt-5 aspect-video w-full rounded-[1.4rem] bg-black"
          >
            <source src={videoUrl} />
            مرورگر شما امکان پخش این ویدیو را ندارد.
          </video>
          {content.video_caption ? <p className="mt-3 text-sm font-bold text-slate-500">{content.video_caption}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
