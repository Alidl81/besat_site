import Link from "next/link";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { DashboardSectionContent } from "@/components/dashboard/dashboard-section-content";
import { PanelLogoutButton } from "@/components/auth/panel-logout-button";
import type { DashboardPageData, DashboardPageKey } from "@/components/dashboard/dashboard-data";

type DashboardShellProps = {
  data: DashboardPageData;
  activeKey?: DashboardPageKey;
  /** نام پنل برای نگاشت محتوای CRUD */
  panel: "admin" | "unitManager" | "media" | "parents";
};

function Sidebar({ data, activeKey }: { data: DashboardPageData; activeKey: string }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-[#062452] px-4 py-5 text-white">
        <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
          <div className="text-right">
            <p className="text-xl font-black text-white">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-white/65">سیستم مدیریت مدرسه</p>
          </div>
          <BesatLogoMark size="sm" className="!h-14 !w-14 shrink-0" />
        </div>

        <div className="mb-4 shrink-0 rounded-[1.4rem] border border-white/10 bg-white/10 p-3">
          <p className="text-xs font-bold text-white/65">نقش کاربری</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-base font-black text-white">{data.roleTitle}</p>
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-xl text-white">
              ▾
            </span>
          </div>
        </div>

        <nav className="besat-panel-menu-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pl-1">
          {data.menu.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-black transition duration-500 ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-xl shadow-emerald-900/20"
                    : "text-white/82 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-xl">{item.icon}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 shrink-0 space-y-2">
          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-white transition duration-500 hover:bg-white hover:text-[#062452]"
          >
            <span>بازگشت به سایت</span>
            <span>←</span>
          </Link>
          <PanelLogoutButton />
          <p className="pt-2 text-center text-xs font-bold text-white/45">تمامی حقوق محفوظ است.</p>
        </div>
      </div>
    </aside>
  );
}

function MobileMenuDropdown({ data, activeKey }: { data: DashboardPageData; activeKey: string }) {
  return (
    <details className="xl:hidden">
      <summary className="list-none cursor-pointer rounded-2xl bg-[#062452] px-5 py-3 text-sm font-black text-white">
        منو
      </summary>
      <nav className="absolute right-4 top-20 z-50 grid max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] gap-2 overflow-y-auto rounded-[1.8rem] border border-slate-200 bg-white p-3 shadow-2xl">
        {data.menu.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-2xl px-4 py-3 text-center text-sm font-black transition duration-500 ${
              item.key === activeKey ? "besat-navy-button" : "besat-tab-link"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/" className="besat-navy-button rounded-2xl px-4 py-3 text-center text-sm font-black">
          بازگشت به سایت
        </Link>
      </nav>
    </details>
  );
}

function TopBar({ data, activeKey }: { data: DashboardPageData; activeKey: string }) {
  const profileItem = data.menu.find((item) => item.key === "profile");
  const profileHref = profileItem?.href ?? data.currentPath;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <MobileMenuDropdown data={data} activeKey={activeKey} />

        <div className="hidden min-w-0 flex-1 lg:flex">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-500">
            {data.accent}
          </div>
        </div>

        <Link
          href={profileHref}
          className="mr-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-[#062452] transition hover:bg-emerald-50 hover:text-emerald-700"
          aria-label="پروفایل"
        >
          ب
        </Link>
      </div>
    </header>
  );
}

/**
 * نمای کلی (overview) — فقط آمار و دسترسی‌های سریع.
 * بخش‌های پنل تکرار نمی‌شوند چون در sidebar موجودند.
 */
function OverviewContent({ data }: { data: DashboardPageData }) {
  const quickActions = data.menu.filter((item) => item.key !== "overview").slice(0, 6);

  return (
    <>
      <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {data.cards.map((card) => (
          <article
            key={card.title}
            className="group rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-500">{card.title}</p>
                <div className="mt-4 text-4xl font-black text-[#062452]">
                  {card.value === null ? "—" : card.value}
                </div>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700 transition duration-500 group-hover:scale-105">
                {card.icon}
              </div>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm leading-7 text-slate-600">{card.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm sm:p-6">
        <h2 className="mb-5 text-xl font-black text-[#062452]">دسترسی سریع</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-2xl text-[#062452] shadow-sm transition duration-500 group-hover:text-emerald-700">
                {action.icon}
              </div>
              <p className="text-sm font-black text-[#062452]">{action.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function DashboardShell({ data, activeKey = "overview", panel }: DashboardShellProps) {
  const activeItem = data.menu.find((item) => item.key === activeKey) ?? data.menu[0];
  const quickActions = data.menu.filter((item) => item.key !== "overview").slice(0, 3);
  const isOverview = activeItem.key === "overview";

  return (
    <main className="min-h-screen bg-[#f3f7f9] text-slate-900" dir="rtl">
      <div className="grid min-h-screen xl:grid-cols-[17.5rem_1fr]">
        <Sidebar data={data} activeKey={activeItem.key} />

        <section className="min-w-0">
          <TopBar data={data} activeKey={activeItem.key} />

          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-[2rem] bg-[#062452] p-6 text-white shadow-2xl shadow-slate-300/70 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(52,211,153,0.28),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.12),transparent_32%)]" />
              <div className="absolute bottom-0 left-0 h-28 w-56 rounded-tr-[5rem] bg-white/10" />

              <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_22rem] lg:items-center">
                <div className="text-right">
                  <p className="mb-4 text-sm font-black text-emerald-300">{data.accent}</p>
                  <h1 className="text-3xl font-black leading-[1.45] text-white md:text-5xl">
                    {isOverview ? data.title : activeItem.label}
                  </h1>
                  <p className="mt-5 max-w-3xl text-sm leading-8 text-white/80 md:text-base">
                    {isOverview ? data.description : activeItem.description}
                  </p>
                </div>

                {isOverview ? (
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <p className="text-sm font-black text-white">دسترسی‌های سریع</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      {quickActions.map((action) => (
                        <Link
                          key={action.key}
                          href={action.href}
                          className="dashboard-quick-link flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition duration-500"
                        >
                          <span>{action.label}</span>
                          <span>{action.icon}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {isOverview ? (
              <OverviewContent data={data} />
            ) : (
              <DashboardSectionContent
                panel={panel}
                sectionKey={activeItem.key}
                roleTitle={data.roleTitle}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
