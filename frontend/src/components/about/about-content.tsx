"use client";
/* eslint-disable @next/next/no-img-element -- these are stable, local Besat editorial images. */

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  HeartHandshake,
  Lightbulb,
  Microscope,
} from "lucide-react";
import { DepartmentNetwork } from "@/components/departments/department-network";
import { Container } from "@/components/shared/container";

const timeline = [
  {
    date: "۱۳۷۰",
    title: "آغاز بعثت",
    description: "مجتمع آموزشی بعثت با همراهی محمدرضا صدیق‌پور و سیدجواد اسدیان شکل گرفت.",
  },
  {
    date: "اوایل دهه ۱۳۸۰",
    title: "رایانه در متن آموزش",
    description: "فناوری و رایانه وارد مسیر یادگیری و تجربه دانش‌آموزان شد.",
  },
  {
    date: "در ادامه مسیر",
    title: "زبان و تجربه‌های تازه",
    description: "یادگیری زبان، پژوهش و تجربه‌های عملی به هویت آموزشی بعثت اضافه شد.",
  },
  {
    date: "امروز",
    title: "اکوسیستم رشد",
    description: "رباتیک، ورزش، فرهنگ، مهارت و مرکز نوآوری شتاب در کنار آموزش علمی و تربیت دینی قرار دارند.",
  },
];

const pillars = [
  {
    number: "۰۱",
    icon: BookOpen,
    title: "آموزش علمی در کنار تربیت دینی",
    description: "بعثت یادگیری را با هویت آموزشی، علمی و دینی خود به یک مسیر پیوسته تبدیل می‌کند.",
  },
  {
    number: "۰۲",
    icon: Cpu,
    title: "مهارت و فناوری",
    description: "از تجربه‌های رایانه‌ای تا رباتیک و مهارت‌های کاربردی، یادگیری به عمل نزدیک می‌شود.",
  },
  {
    number: "۰۳",
    icon: Microscope,
    title: "پژوهش و تجربه عملی",
    description: "پرسش، ساختن و آزمودن بخشی از تجربه دانش‌آموز در مدرسه است.",
  },
  {
    number: "۰۴",
    icon: HeartHandshake,
    title: "همراهی با خانواده",
    description: "رشد دانش‌آموز در ارتباط با مدرسه، خانواده و جامعه معنا پیدا می‌کند.",
  },
];

const networkItems = [
  { id: "language", title: "زبان" },
  { id: "research", title: "پژوهش" },
  { id: "robotics", title: "رباتیک" },
  { id: "sports", title: "ورزش" },
  { id: "culture", title: "فرهنگ" },
  { id: "skills", title: "مهارت" },
];

export function AboutContent() {
  return (
    <main dir="rtl" className="overflow-hidden bg-[#fbfaf7] text-[#0a2848]">
      <section className="border-b border-[#e5e2dc] bg-[linear-gradient(135deg,#f8fbfd_0%,#fbfaf7_58%,#fff6e8_100%)]">
        <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="mb-4 flex items-center gap-3 text-xs font-black tracking-[0.16em] text-[#8a641f]">
              <span className="h-px w-8 bg-[#c98c3d]" />
              درباره مجتمع آموزشی بعثت
            </p>
            <h1 className="max-w-xl text-[clamp(2.15rem,5vw,4.25rem)] font-black leading-[1.28] [text-wrap:balance]">
              از ۱۳۷۰؛ آموزش برای ساختن آینده
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-8 text-slate-600 sm:text-lg">
              بعثت یک مسیر آموزشی، علمی و تربیتی است؛ جایی که یادگیری، مهارت و هویت دینی در کنار هم رشد می‌کنند.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/units"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0a2848] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(10,40,72,0.16)] transition hover:-translate-y-0.5 hover:bg-[#12395b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
              >
                واحدهای آموزشی
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-black text-[#8a5a18] underline decoration-[#d9aa62] decoration-2 underline-offset-8 transition hover:text-[#0a2848] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 motion-reduce:transition-none"
              >
                ارتباط با ما
              </Link>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-3 rounded-[2rem] border border-[#d9aa62]/35 sm:-inset-5" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-white/80 bg-slate-100 shadow-[0_20px_55px_rgba(8,30,55,0.14)] sm:rounded-[2rem]">
              <img
                src="/images/official/hero/besat-main.jpg"
                alt="نمایی از مجتمع آموزشی بعثت"
                className="size-full object-cover"
                fetchPriority="high"
              />
            </div>
            <figcaption className="mt-3 text-xs font-bold text-slate-500">یادگیری، تجربه و همراهی در یک مسیر</figcaption>
          </figure>
        </Container>
      </section>

      <section className="bg-white">
        <Container className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:py-24">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">داستان بعثت</p>
            <h2 className="mt-3 max-w-sm text-3xl font-black leading-[1.45] [text-wrap:balance] sm:text-4xl">یک ریشه، چندین مسیر رشد</h2>
          </div>
          <div className="max-w-3xl text-base font-bold leading-9 text-slate-600">
            <p>
              مجتمع آموزشی بعثت در سال ۱۳۷۰ با نگاه محمدرضا صدیق‌پور و سیدجواد اسدیان آغاز شد؛ نگاهی که آموزش را از حفظ‌کردن جدا و آن را به ساختن، پرسیدن و مسئولیت‌پذیری پیوند می‌دهد.
            </p>
            <p className="mt-5">
              هویت بعثت هم‌زمان آموزشی، علمی و دینی است. این نگاه در طول سال‌ها با زبان، پژوهش، رباتیک، ورزش، فرهنگ و مهارت‌های کاربردی گسترده‌تر شده و امروز در واحدهای دخترانه و پسرانه و مرکز نوآوری شتاب ادامه دارد.
            </p>
            <figure className="mt-7 overflow-hidden rounded-[1.25rem] border border-[#e4e6e5] bg-slate-100">
              <img src="/images/official/hero/besat-hs-banner-03.jpg" alt="فضای آموزشی مجتمع بعثت" loading="lazy" className="aspect-[16/7] w-full object-cover" />
            </figure>
          </div>
        </Container>
      </section>

      <section className="border-y border-[#e5e2dc] bg-[#fbfaf7]">
        <Container className="py-14 sm:py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">روایت کوتاه</p>
              <h2 className="mt-3 text-3xl font-black leading-[1.45] sm:text-4xl">چهار ایستگاه از این مسیر</h2>
            </div>
            <Lightbulb aria-hidden="true" className="size-8 text-[#c98c3d]" />
          </div>
          <ol className="mt-10 grid gap-0 lg:grid-cols-4">
            {timeline.map((item, index) => (
              <li key={item.date} className="relative border-t border-[#d8d9d5] py-6 lg:border-r lg:border-t-0 lg:px-6 lg:first:pr-0 lg:last:border-r-0">
                <span className="absolute -top-2 right-0 size-4 rounded-full border-4 border-[#fbfaf7] bg-[#c98c3d] lg:-right-2 lg:top-0 lg:first:right-0" />
                <p className="text-xs font-black text-[#8a641f]">{item.date}</p>
                <h3 className="mt-3 break-words text-lg font-black leading-7 text-[#0a2848]">{item.title}</h3>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{item.description}</p>
                <span className="mt-4 block text-xs font-black text-slate-400">۰{index + 1}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-white">
        <Container className="py-14 sm:py-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">آنچه مهم است</p>
            <h2 className="mt-3 text-3xl font-black leading-[1.45] sm:text-4xl">پایه‌های تجربه بعثت</h2>
          </div>
          <div className="mt-10 divide-y divide-[#e4e6e5] border-y border-[#e4e6e5]">
            {pillars.map(({ number, icon: Icon, title, description }) => (
              <article key={number} className="grid gap-4 py-6 sm:grid-cols-[4rem_2rem_1fr] sm:items-start sm:gap-5">
                <span className="text-sm font-black text-[#c0802f]">{number}</span>
                <Icon aria-hidden="true" className="size-5 text-[#0b4b7a]" />
                <div>
                  <h3 className="break-words text-lg font-black leading-7 text-[#0a2848]">{title}</h3>
                  <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-600">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-[#e5e2dc] bg-[#f8fbfd]">
        <Container className="py-14 sm:py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.6fr_1.4fr] lg:items-center">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">اکوسیستم یادگیری</p>
              <h2 className="mt-3 text-3xl font-black leading-[1.45] sm:text-4xl">هر علاقه، یک راه برای رشد</h2>
              <p className="mt-4 max-w-md text-sm font-bold leading-8 text-slate-600">
                حوزه‌های مختلف بعثت کنار هم قرار می‌گیرند تا دانش‌آموز نه فقط یک درس، بلکه یک تجربه کامل از یادگیری داشته باشد.
              </p>
            </div>
            <DepartmentNetwork items={networkItems} centerLabel="مجتمع بعثت" centerDescription="یک مسیر، چندین حوزه رشد" />
          </div>
        </Container>
      </section>

      <section className="bg-white">
        <Container className="grid gap-8 py-14 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">برای خانواده‌ها</p>
            <h2 className="mt-3 text-3xl font-black leading-[1.45] sm:text-4xl">مسیر مناسب فرزندتان را پیدا کنید</h2>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-8 text-slate-600">
              واحدهای دخترانه و پسرانه بعثت در مقاطع مختلف آموزشی، ادامه همین نگاه مشترک‌اند؛ با جزئیات هر واحد آشنا شوید.
            </p>
          </div>
          <Link
            href="/units"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c98c3d] px-6 text-sm font-black text-white shadow-[0_10px_24px_rgba(201,140,61,0.18)] transition hover:-translate-y-0.5 hover:bg-[#b97827] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 motion-reduce:transition-none"
          >
            دیدن واحدهای آموزشی
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
        </Container>
      </section>

      <section className="border-t border-[#e5e2dc] bg-[#0a2848] text-white">
        <Container className="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[#f1ca83]">قدم بعدی</p>
            <h2 className="mt-3 text-2xl font-black leading-[1.5] sm:text-3xl">بعثت را از نزدیک‌تر بشناسید</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-[#0a2848] transition hover:bg-[#fff4de] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 motion-reduce:transition-none">
              ارتباط با ما
            </Link>
            <Link href="/news" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-black text-white transition hover:border-[#f1ca83] hover:text-[#f1ca83] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 motion-reduce:transition-none">
              تازه‌های بعثت
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
