"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PanelIcon, type PanelIconName } from "@/components/dashboard/panel-icons";
import { StatusBadge } from "@/components/crud/crud-ui";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { readBesatSession } from "@/lib/auth/auth-session";
import { panelService } from "@/services/panel-service";
import type {
  AdminDashboard,
  MediaDashboard,
  PanelFeedItem,
  PanelMetric,
  ParentDashboard,
} from "@/types/panel-api";
import type { DashboardPageData } from "@/components/dashboard/dashboard-data";

type PanelKind = "admin" | "contentManager" | "parents";

const toneClasses: Record<PanelMetric["tone"], string> = {
  blue: "bg-[#eef4fb] text-[#1c66bd]",
  amber: "bg-[#fff5e7] text-[#d17d0d]",
  green: "bg-[#edf8ef] text-[#248749]",
  purple: "bg-[#f5effb] text-[#7f48a8]",
  red: "bg-[#fff0f0] text-[#c63e3e]",
};

const knownIcons = new Set<PanelIconName>([
  "albums", "bell", "building", "calendar", "chart", "check", "children",
  "clipboard", "dashboard", "document", "download", "edit", "eye", "file",
  "filter", "globe", "heart", "image", "link", "mail", "media", "megaphone",
  "message", "news", "plus", "profile", "programs", "registration", "review",
  "search", "services", "settings", "staff", "students", "trash", "units",
  "users", "warning",
]);

function iconName(value: string): PanelIconName {
  return knownIcons.has(value as PanelIconName)
    ? (value as PanelIconName)
    : "chart";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function StatCard({ metric }: { metric: PanelMetric }) {
  return (
    <article className="panel-card min-h-36">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-600">{metric.title}</p>
          <p className="mt-4 text-3xl font-black tracking-tight text-[#101828]">
            {metric.value ?? "—"}
          </p>
          {metric.detail ? (
            <p className="mt-2 text-xs font-bold text-slate-500">{metric.detail}</p>
          ) : null}
        </div>
        <span className={`flex size-12 items-center justify-center rounded-full ${toneClasses[metric.tone]}`}>
          <PanelIcon name={iconName(metric.icon)} className="size-6" />
        </span>
      </div>
      {metric.trend ? (
        <p className="mt-4 text-xs font-bold text-emerald-600">{metric.trend}</p>
      ) : null}
    </article>
  );
}

function Feed({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: PanelIconName;
  items: PanelFeedItem[];
  empty: string;
}) {
  return (
    <section className="panel-card">
      <header className="mb-4 flex items-center gap-2">
        <PanelIcon name={icon} className="size-5 text-[#0d3d6c]" />
        <h2 className="text-base font-black text-[#102b4a]">{title}</h2>
      </header>
      {items.length ? (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const content = (
              <>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-xs text-[#172b43]">{item.title}</b>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-6 text-slate-500">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <time className="shrink-0 text-[10px] font-bold text-slate-400">
                  {formatDate(item.timestamp)}
                </time>
              </>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="flex gap-3 py-3 hover:bg-slate-50">
                {content}
              </Link>
            ) : (
              <article key={item.id} className="flex gap-3 py-3">
                {content}
              </article>
            );
          })}
        </div>
      ) : (
        <PanelEmpty title={empty} />
      )}
    </section>
  );
}

const adminQuickActions: { href: string; label: string; icon: PanelIconName }[] = [
  { href: "/dashboard/admin/content", label: "مدیریت محتوا", icon: "file" },
  { href: "/dashboard/admin/gallery", label: "رسانه و گالری", icon: "albums" },
  { href: "/dashboard/admin/virtual-tour", label: "تور مجازی", icon: "virtualTour" },
  { href: "/dashboard/admin/registrations", label: "ثبت‌نام‌ها", icon: "registration" },
  { href: "/dashboard/admin/users", label: "کاربران", icon: "users" },
];

function QuickActions({ actions }: { actions: { href: string; label: string; icon: PanelIconName }[] }) {
  return (
    <section aria-label="دسترسی سریع" className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-[#102b4a] transition hover:border-blue-300 hover:bg-blue-50"
        >
          <PanelIcon name={action.icon} className="size-4 text-[#0b599b]" />
          {action.label}
        </Link>
      ))}
    </section>
  );
}

function AdminOverview({ payload }: { payload: AdminDashboard }) {
  return (
    <div className="space-y-5">
      <QuickActions actions={adminQuickActions} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {payload.metrics.map((metric) => <StatCard key={metric.key} metric={metric} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-3">
        <Feed title="پیام‌های اخیر" icon="message" items={payload.messages} empty="پیام جدیدی وجود ندارد." />
        <Feed title="رویدادهای پیش رو" icon="calendar" items={payload.events} empty="رویدادی برنامه‌ریزی نشده است." />
        <Feed title="اطلاعیه‌های اخیر" icon="megaphone" items={payload.announcements} empty="اطلاعیه‌ای منتشر نشده است." />
      </section>
      <section className="panel-card">
        <header className="mb-4 flex items-center gap-2">
          <PanelIcon name="units" className="size-5 text-[#0d3d6c]" />
          <h2 className="text-base font-black text-[#102b4a]">واحدهای آموزشی</h2>
        </header>
        {payload.units.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {payload.units.map((unit) => (
              <article key={unit.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-black text-[#172b43]">{unit.title}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-slate-500">
                  <div><dt>دانش‌آموز</dt><dd className="mt-1 text-lg text-[#102b4a]">{unit.students_count}</dd></div>
                  <div><dt>کادر</dt><dd className="mt-1 text-lg text-[#102b4a]">{unit.staff_count}</dd></div>
                </dl>
                <span className="mt-4 inline-block">
                  <StatusBadge status={unit.is_active ? "active" : "inactive"} />
                </span>
              </article>
            ))}
          </div>
        ) : payload.accessible_units?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {payload.accessible_units.map((unit) => (
              <article key={unit.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-black text-[#172b43]">{unit.title}</h3>
                <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                  جزئیات عملکرد این واحد در پاسخ فعلی داشبورد ارائه نشده است.
                </p>
              </article>
            ))}
          </div>
        ) : <PanelEmpty title="واحد آموزشی در دسترس نیست." />}
      </section>
    </div>
  );
}

function MediaOverview({ payload }: { payload: MediaDashboard }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {payload.metrics.map((metric) => <StatCard key={metric.key} metric={metric} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <section className="panel-card">
          <header className="mb-4 flex items-center gap-2">
            <PanelIcon name="media" className="size-5 text-[#0d3d6c]" />
            <h2 className="text-base font-black text-[#102b4a]">فضای ذخیره‌سازی رسانه</h2>
          </header>
          {payload.storage ? (
            <>
              <div className="mx-auto flex size-44 items-center justify-center rounded-full bg-[conic-gradient(#2867c6_var(--storage),#edf0f3_0)]" style={{ "--storage": `${payload.storage.used_percent}%` } as React.CSSProperties}>
                <div className="flex size-28 flex-col items-center justify-center rounded-full bg-white">
                  <b className="text-3xl text-[#172b43]">{payload.storage.used_percent}%</b>
                  <span className="text-xs font-bold text-slate-500">استفاده‌شده</span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs font-bold text-slate-500">
                {new Intl.NumberFormat("fa-IR", { style: "unit", unit: "megabyte", unitDisplay: "long" }).format(payload.storage.used_bytes / 1024 / 1024)}
              </p>
            </>
          ) : <PanelEmpty title="اطلاعات فضای ذخیره‌سازی موجود نیست." />}
        </section>
        <Feed title="آخرین محتواها" icon="document" items={payload.latest_content} empty="محتوایی ثبت نشده است." />
      </section>
      <Feed title="پیام‌های اخیر" icon="message" items={payload.messages} empty="پیامی وجود ندارد." />
    </div>
  );
}

function ParentOverview({ payload }: { payload: ParentDashboard }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {payload.metrics.map((metric) => <StatCard key={metric.key} metric={metric} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-3">
        <section className="panel-card">
          <header className="mb-4 flex items-center gap-2">
            <PanelIcon name="programs" className="size-5 text-[#0d3d6c]" />
            <h2 className="text-base font-black text-[#102b4a]">برنامه امروز</h2>
          </header>
          {payload.today_schedule.length ? (
            <ol className="divide-y divide-slate-100">
              {payload.today_schedule.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 text-xs font-bold">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#fff3df] text-[#a8660b]">{item.order}</span>
                  <b className="flex-1 text-[#172b43]">{item.title}</b>
                  <time className="text-slate-500">{item.starts_at}–{item.ends_at}</time>
                </li>
              ))}
            </ol>
          ) : <PanelEmpty title="برای امروز برنامه‌ای ثبت نشده است." />}
        </section>
        <Feed title="رویدادهای مدرسه" icon="calendar" items={payload.events} empty="رویدادی وجود ندارد." />
        <Feed title="پیام‌های دبیران" icon="message" items={payload.teacher_messages} empty="پیام جدیدی وجود ندارد." />
      </section>
    </div>
  );
}

export function DashboardOverview({
  panel,
}: {
  panel: PanelKind;
  data: DashboardPageData;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const role = readBesatSession()?.role;
  const { data, loading, error, reload } = usePanelRequest(
    () =>
      panelService.dashboard(panel, {
        academic_year: searchParams.get("academic_year"),
        unit: searchParams.get("unit"),
        child: searchParams.get("child"),
        role: panel === "admin" ? role ?? null : null,
      }),
    [panel, query, role],
  );

  if (loading) return <PanelLoading label="در حال دریافت داشبورد..." />;
  if (error) return <PanelError message={error} onRetry={reload} />;
  if (!data) return <PanelEmpty title="داشبورد از بک‌اند پاسخی دریافت نکرد." />;
  if (panel === "parents") return <ParentOverview payload={data as ParentDashboard} />;
  if (panel === "contentManager") return <MediaOverview payload={data as MediaDashboard} />;
  return <AdminOverview payload={data as AdminDashboard} />;
}
