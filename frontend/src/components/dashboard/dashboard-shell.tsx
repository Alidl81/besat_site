"use client";

import Link from "next/link";
import { useState } from "react";
import {
  dashboardPanels,
  type DashboardPanelKey,
} from "@/components/dashboard/dashboard-data";

const toneClasses = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-violet-50 text-violet-700 border-violet-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  red: "bg-rose-50 text-rose-700 border-rose-100",
};

type DashboardShellProps = {
  panel: DashboardPanelKey;
};

export function DashboardShell({ panel }: DashboardShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const data = dashboardPanels[panel];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950" dir="rtl">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-4 top-4 z-50 inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a] shadow-lg lg:hidden"
        aria-label="باز کردن منوی پنل"
      >
        ☰
      </button>

      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[290px] flex-col bg-[#062452] px-5 py-6 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-xl font-black text-emerald-300">
            ب
          </div>

          <div>
            <p className="text-lg font-black">مدرسه بعثت</p>
            <p className="mt-1 text-xs text-slate-300">سیستم مدیریت مدرسه</p>
          </div>
        </div>

        <div className="mb-5 rounded-3xl border border-white/10 bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-right">
              <p className="font-black">{data.roleTitle}</p>
              <p className="mt-1 text-xs leading-6 text-slate-300">{data.roleDescription}</p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-xl">
              ◌
            </span>
          </div>
        </div>

        <nav className="grid flex-1 gap-2 overflow-y-auto pr-1">
          {data.navItems.map((item, index) => {
            const active = index === 0;

            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/25"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-lg">{item.icon}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <span>خروج از سیستم</span>
            <span>↢</span>
          </button>

          <p className="mt-6 text-center text-xs text-slate-400">تمامی حقوق محفوظ است.</p>
        </div>
      </aside>

      <section className="lg:pr-[290px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 lg:px-8">
            <div className="hidden items-center gap-4 lg:flex">
              <div className="size-11 rounded-full bg-slate-200" />
              <div>
                <p className="text-sm font-black">{data.roleTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{data.roleDescription}</p>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl lg:mx-0">
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <span className="text-slate-400">⌕</span>
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  aria-label="جستجو در پنل"
                  type="search"
                />
              </div>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <button className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a]">
                ؟
              </button>
              <button className="relative flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a]">
                ✉
                <span className="absolute -right-1 -top-1 size-3 rounded-full bg-emerald-500" />
              </button>
              <button className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f2f4a]">
                ◌
              </button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 lg:px-8">
          <section className="relative overflow-hidden rounded-[2rem] bg-[#062452] p-6 text-white shadow-xl shadow-slate-200 lg:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.22),transparent_28%),linear-gradient(90deg,rgba(6,36,82,0.98),rgba(6,36,82,0.82))]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="mb-4 text-3xl">👋</p>
                <h1 className="text-2xl font-black leading-10 lg:text-3xl">{data.welcomeTitle}</h1>
                <p className="mt-4 max-w-3xl leading-8 text-slate-200">{data.welcomeText}</p>

                {data.badge ? (
                  <span className="mt-5 inline-flex rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-black text-white">
                    {data.badge}
                  </span>
                ) : null}
              </div>

              <div className="hidden h-32 w-56 rounded-3xl border border-white/10 bg-white/10 lg:block" />
            </div>
          </section>

          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((item) => (
              <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-[#0f2f4a]">{item.title}</p>
                    <p className="mt-4 text-3xl font-black text-[#0f2f4a]">{item.value ?? "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                  </div>

                  <span className={`flex size-14 items-center justify-center rounded-3xl border text-2xl ${toneClasses[item.tone]}`}>
                    {item.icon}
                  </span>
                </div>

                <Link href="#" className="mt-5 inline-flex text-xs font-black text-[#0f2f4a]">
                  مشاهده
                </Link>
              </article>
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1fr_1.1fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-5 text-lg font-black text-[#0f2f4a]">دسترسی سریع</h2>

              <div className="grid grid-cols-2 gap-3">
                {data.actions.map((item) => (
                  <button
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-bold text-[#0f2f4a] transition hover:border-emerald-200 hover:bg-emerald-50"
                    type="button"
                  >
                    <span className="mb-3 block text-2xl">{item.icon}</span>
                    {item.title}
                  </button>
                ))}
              </div>

              <button className="mt-4 h-11 w-full rounded-2xl border border-emerald-300 text-sm font-black text-emerald-700" type="button">
                مشاهده امکانات
              </button>
            </article>

            <DashboardList title={data.mainTitle} rows={data.mainRows} />

            <DashboardList title={data.sideTitle} rows={data.sideRows} />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <DashboardList title={data.bottomTitle} rows={data.bottomRows} />

            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#0f2f4a]">وضعیت نمایش اطلاعات</h2>
                <span className="text-emerald-600">✓</span>
              </div>

              <div className="grid gap-3 text-sm leading-7 text-slate-600">
                <p>اطلاعات هر پنل فقط بر اساس نقش کاربر و واحد مرتبط نمایش داده می‌شود.</p>
                <p>هر واحد آموزشی، اخبار، اطلاعیه‌ها، گالری، برنامه‌ها و پیام‌های مربوط به خودش را دارد.</p>
                <p>در این نما هیچ عدد، نام یا گزارش ساختگی نمایش داده نشده است.</p>
              </div>

              <Link
                href="/"
                className="mt-5 inline-flex rounded-2xl border border-emerald-300 px-5 py-3 text-sm font-black text-emerald-700"
              >
                بازگشت به سایت
              </Link>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

function DashboardList({
  title,
  rows,
}: {
  title: string;
  rows: { title: string; meta: string; status?: string; tone?: keyof typeof toneClasses }[];
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black text-[#0f2f4a]">{title}</h2>
        <Link href="#" className="text-xs font-black text-[#0f2f4a]">
          مشاهده
        </Link>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div
              key={`${row.title}-${index}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-black text-[#0f2f4a]">{row.title}</p>
                <p className="mt-1 text-xs text-slate-500">{row.meta}</p>
              </div>

              {row.status ? (
                <span className={`shrink-0 rounded-xl border px-3 py-1 text-xs font-black ${toneClasses[row.tone ?? "blue"]}`}>
                  {row.status}
                </span>
              ) : (
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[row.tone ?? "blue"]}`}>
                  ◌
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-bold text-slate-500">موردی برای نمایش وجود ندارد.</p>
        </div>
      )}

      <button className="mt-4 h-11 w-full rounded-2xl border border-emerald-300 text-sm font-black text-emerald-700" type="button">
        مشاهده
      </button>
    </article>
  );
}
