import Link from "next/link";
import type { DashboardMenuItem, DashboardPageData, DashboardPageKey } from "@/components/dashboard/dashboard-data";

type DashboardShellProps = {
  data: DashboardPageData;
  activeKey?: DashboardPageKey;
};

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/80 p-7 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white text-xl text-emerald-700 shadow-sm">
        ◌
      </div>
      <p className="text-sm font-bold leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function Sidebar({ data, activeKey }: Required<DashboardShellProps>) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden bg-[#062452] px-5 py-6 text-white">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-3xl bg-white text-2xl font-black text-[#062452] shadow-xl shadow-black/10">
            ب
          </div>
          <div>
            <p className="text-lg font-black text-white">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-white/70">{data.accent}</p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.6rem] border border-white/10 bg-white/10 p-4">
          <p className="text-xs font-bold text-white/60">دسترسی</p>
          <p className="mt-2 text-sm font-black text-white">{data.eyebrow}</p>
        </div>

        <nav className="space-y-2">
          {data.menu.map((item) => {
            const isActive = item.key === activeKey;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`dashboard-sidebar-text flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition duration-500 ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-xl shadow-emerald-900/20"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl text-base ${
                    isActive ? "bg-white text-emerald-700" : "bg-white/10 text-white"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[1.6rem] border border-white/10 bg-white/10 p-4">
          <Link
            href="/"
            className="flex items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition duration-500 hover:bg-white hover:text-[#062452]"
          >
            بازگشت به سایت
          </Link>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ data, activeKey }: Required<DashboardShellProps>) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <details className="xl:hidden">
          <summary className="list-none cursor-pointer rounded-2xl bg-[#062452] px-5 py-3 text-sm font-black text-white">
            منو
          </summary>

          <nav className="absolute right-4 top-20 grid w-[min(24rem,calc(100vw-2rem))] gap-2 rounded-[1.8rem] border border-slate-200 bg-white p-3 shadow-2xl">
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

            <Link
              href="/"
              className="besat-navy-button rounded-2xl px-4 py-3 text-center text-sm font-black"
            >
              بازگشت به سایت
            </Link>
          </nav>
        </details>

        <div className="hidden min-w-0 flex-1 lg:flex">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-500">
            {data.accent}
          </div>
        </div>

        <div className="mr-auto flex items-center gap-3">
          <div className="hidden text-left sm:block">
            <p className="text-sm font-black text-[#062452]">{data.eyebrow}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{data.accent}</p>
          </div>

          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-[#062452]">
            ب
          </div>
        </div>
      </div>
    </header>
  );
}

function OverviewContent({ data }: { data: DashboardPageData }) {
  const quickActions = data.menu.filter((item) => item.key !== "overview").slice(0, 4);

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

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] 2xl:grid-cols-[0.8fr_1.2fr_1fr]">
        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black text-[#062452]">اقدامات سریع</h2>
            <span className="text-lg text-emerald-700">×</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50"
              >
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-xl text-[#062452] shadow-sm transition duration-500 group-hover:text-emerald-700">
                  {action.icon}
                </div>
                <p className="text-sm font-black text-[#062452]">{action.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {quickActions.slice(0, 2).map((section) => (
          <section
            key={section.key}
            className="rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-[#062452]">{section.label}</h2>
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                {section.icon}
              </span>
            </div>

            <EmptyPanel text={section.emptyText} />
          </section>
        ))}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        {quickActions.slice(2).map((section) => (
          <section
            key={section.key}
            className="rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-[#062452]">{section.label}</h2>
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                {section.icon}
              </span>
            </div>

            <EmptyPanel text={section.emptyText} />
          </section>
        ))}

        <aside className="rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
          <h2 className="text-xl font-black text-[#062452]">بخش‌های پنل</h2>
          <div className="mt-5 space-y-3">
            {data.menu.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="besat-tab-link flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black"
              >
                <span>{item.label}</span>
                <span>{item.icon}</span>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}

function SectionContent({ item }: { item: DashboardMenuItem }) {
  return (
    <section className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#062452]">{item.label}</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">{item.description}</p>
        </div>

        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
          {item.icon}
        </span>
      </div>

      <EmptyPanel text={item.emptyText} />
    </section>
  );
}

export function DashboardShell({ data, activeKey = "overview" }: DashboardShellProps) {
  const activeItem = data.menu.find((item) => item.key === activeKey) ?? data.menu[0];
  const quickActions = data.menu.filter((item) => item.key !== "overview").slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f3f7f9] text-slate-900" dir="rtl">
      <div className="grid min-h-screen xl:grid-cols-[18rem_1fr]">
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
                    {activeItem.key === "overview" ? data.title : activeItem.label}
                  </h1>
                  <p className="mt-5 max-w-3xl text-sm leading-8 text-white/80 md:text-base">
                    {activeItem.key === "overview" ? data.description : activeItem.description}
                  </p>
                </div>

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
              </div>
            </section>

            {activeItem.key === "overview" ? (
              <OverviewContent data={data} />
            ) : (
              <SectionContent item={activeItem} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
