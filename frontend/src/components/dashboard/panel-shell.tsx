import Link from "next/link";
import { PanelMenu } from "@/components/dashboard/panel-menu";
import type { PanelData, PanelSectionKey } from "@/components/dashboard/panel-data";

type PanelShellProps = {
  data: PanelData;
  activeKey?: PanelSectionKey;
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-white text-lg text-emerald-700 shadow-sm">
        ◌
      </div>
      <p className="text-sm font-bold leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function PanelSidebar({ data, activeKey }: { data: PanelData; activeKey: string }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-[#062452] px-4 py-5 text-white">
        <div className="mb-5 flex shrink-0 items-center justify-between gap-4">
          <div className="text-right">
            <p className="text-xl font-black text-white">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-white/65">سیستم مدیریت مدرسه</p>
          </div>

          <div className="flex size-14 items-center justify-center rounded-[1.4rem] bg-white text-2xl font-black text-[#062452] shadow-xl">
            ب
          </div>
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

        <div className="mt-4 shrink-0">
          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-white transition duration-500 hover:bg-white hover:text-[#062452]"
          >
            <span>بازگشت به سایت</span>
            <span>←</span>
          </Link>

          <p className="mt-4 text-center text-xs font-bold text-white/45">
            تمامی حقوق محفوظ است.
          </p>
        </div>
      </div>
    </aside>
  );
}

function PanelTopBar({ data, activeKey }: { data: PanelData; activeKey: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="xl:hidden">
          <PanelMenu data={data} activeKey={activeKey} />
        </div>

        <div className="hidden items-center gap-4 xl:flex">
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-[#062452]">
            ب
          </div>
          <div>
            <p className="text-sm font-black text-[#062452]">{data.roleTitle}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">پنل مدرسه</p>
          </div>
        </div>

        <div className="hidden h-9 w-px bg-slate-200 lg:block" />

        <div className="hidden items-center gap-4 text-[#062452] lg:flex">
          <span className="text-xl">♧</span>
          <span className="text-xl">✉</span>
          <span className="text-xl">؟</span>
        </div>

        <div className="mx-auto hidden w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 lg:flex">
          <span className="text-slate-400">⌕</span>
          <span className="text-sm font-bold text-slate-400">جستجو در پنل...</span>
        </div>

        <div className="mr-auto flex items-center gap-3 xl:hidden">
          <div className="text-left">
            <p className="text-sm font-black text-[#062452]">حساب کاربری</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{data.roleTitle}</p>
          </div>

          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-[#062452]">
            ب
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero({ data, activeKey }: { data: PanelData; activeKey: string }) {
  const activeItem = data.menu.find((item) => item.key === activeKey) ?? data.menu[0];

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#062452] shadow-xl shadow-slate-200">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(90deg,rgba(6,36,82,0.15),rgba(6,36,82,0.95)),radial-gradient(circle_at_20%_30%,rgba(52,211,153,0.25),transparent_30%)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,rgba(6,36,82,0.95),rgba(6,36,82,1))]" />
      <div className="absolute bottom-0 left-0 h-24 w-48 rounded-tr-[5rem] bg-white/10" />

      <div className="relative z-10 grid min-h-48 gap-6 p-6 md:p-8 lg:grid-cols-[18rem_1fr] lg:items-center">
        <div className="hidden h-40 overflow-hidden rounded-2xl bg-white/10 lg:block">
          <div className="size-full bg-[linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.03))]" />
        </div>

        <div className="text-right text-white">
          <h1 className="text-3xl font-black leading-[1.45] md:text-5xl">
            {activeKey === "overview" ? data.title : activeItem.label}
          </h1>
          <p className="mt-5 max-w-3xl text-sm font-bold leading-8 text-white/82 md:text-base">
            {activeKey === "overview" ? data.subtitle : activeItem.emptyText}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatCards({ data }: { data: PanelData }) {
  return (
    <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {data.cards.map((card) => (
        <article
          key={card.title}
          className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[#062452]">{card.title}</p>
              <div className="mt-4 text-4xl font-black text-[#062452]">
                {card.value === null ? "—" : card.value}
              </div>
            </div>

            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
              {card.icon}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs font-black text-[#062452]">مشاهده همه</span>
            <span className="text-lg text-[#062452]">‹</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function QuickAccess({ data }: { data: PanelData }) {
  const items = data.menu.filter((item) => item.key !== "overview").slice(0, 6);

  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
      <h2 className="text-xl font-black text-[#062452]">دسترسی سریع</h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-center transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50"
          >
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl text-[#062452] transition duration-500 group-hover:text-emerald-700">
              {item.icon}
            </div>
            <p className="text-sm font-black text-[#062452]">{item.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <Link
          href={data.basePath}
          className="flex items-center justify-center rounded-2xl border border-emerald-300 px-4 py-3 text-sm font-black text-emerald-700 transition duration-500 hover:bg-emerald-50"
        >
          مشاهده امکانات
        </Link>
      </div>
    </section>
  );
}

function ListPanel({ title, icon, text }: { title: string; icon: string; text: string }) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-black text-[#062452]">{title}</h2>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">
          {icon}
        </span>
      </div>

      <EmptyState text={text} />

      <div className="mt-5">
        <span className="flex items-center justify-center rounded-2xl border border-emerald-300 px-4 py-3 text-sm font-black text-emerald-700">
          مشاهده همه
        </span>
      </div>
    </section>
  );
}

function OverviewContent({ data }: { data: PanelData }) {
  const sections = data.menu.filter((item) => item.key !== "overview");

  return (
    <>
      <StatCards data={data} />

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1fr_1fr]">
        <QuickAccess data={data} />
        {sections.slice(0, 2).map((item) => (
          <ListPanel key={item.key} title={item.label} icon={item.icon} text={item.emptyText} />
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        {sections.slice(2, 5).map((item) => (
          <ListPanel key={item.key} title={item.label} icon={item.icon} text={item.emptyText} />
        ))}
      </section>
    </>
  );
}

function SectionContent({ data, activeKey }: { data: PanelData; activeKey: string }) {
  const activeItem = data.menu.find((item) => item.key === activeKey) ?? data.menu[0];

  return (
    <section className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#062452]">{activeItem.label}</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">{activeItem.emptyText}</p>
        </div>

        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
          {activeItem.icon}
        </span>
      </div>

      <EmptyState text={activeItem.emptyText} />
    </section>
  );
}

export function PanelShell({ data, activeKey = "overview" }: PanelShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f9fb] text-slate-900" dir="rtl">
      <div className="grid min-h-screen xl:grid-cols-[17.5rem_1fr]">
        <PanelSidebar data={data} activeKey={activeKey} />

        <section className="min-w-0">
          <PanelTopBar data={data} activeKey={activeKey} />

          <section className="mx-auto w-full max-w-[112rem] px-4 py-5 sm:px-6 lg:px-8">
            <Hero data={data} activeKey={activeKey} />

            {activeKey === "overview" ? (
              <OverviewContent data={data} />
            ) : (
              <SectionContent data={data} activeKey={activeKey} />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

