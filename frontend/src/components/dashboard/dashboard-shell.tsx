"use client";

import Link from "next/link";
import { PanelLogoutButton } from "@/components/auth/panel-logout-button";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { DashboardOverview } from "@/components/dashboard/panel-overviews";
import { DashboardSectionContent } from "@/components/dashboard/dashboard-section-content";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { DashboardMobileMenu } from "@/components/dashboard/dashboard-mobile-menu";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import type { DashboardPageData, DashboardPageKey, DashboardMenuRole } from "@/components/dashboard/dashboard-data";
import { readBesatSession } from "@/lib/auth/auth-session";

type DashboardShellProps = {
  data: DashboardPageData;
  activeKey?: DashboardPageKey;
  panel: "admin" | "contentManager" | "parents";
};

function SidebarMenu({
  data,
  activeKey,
  mobile = false,
}: {
  data: DashboardPageData;
  activeKey: string;
  mobile?: boolean;
}) {
  return (
    <nav
      className={
        mobile
          ? "grid max-h-[65vh] gap-1 overflow-y-auto p-3"
          : "besat-panel-menu-scroll min-h-0 flex-1 space-y-1 overflow-y-visible px-3 pb-3"
      }
      aria-label="منوی پنل"
    >
      {data.menu.filter((item) => !item.hidden).map((item) => {
        const isActive = item.key === activeKey;
        return (
          <div key={item.key} className={`dashboard-menu-item ${item.dividerBefore ? "has-divider border-t border-white/16 pt-3" : ""}`}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`dashboard-sidebar-link ${isActive ? "is-active" : ""} ${
                mobile ? "!text-[#0a2b50] hover:!bg-[#f6f0e7]" : ""
              }`}
            >
              <PanelIcon name={item.icon} className="size-[1.35rem] shrink-0" />
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function Sidebar({ data, activeKey }: { data: DashboardPageData; activeKey: string }) {
  return (
    <aside className="hidden lg:block">
      <div className="besat-dashboard-sidebar sticky top-0 flex h-dvh min-h-0 flex-col overflow-hidden text-white">
        <Link href="/" className="besat-dashboard-brand mx-3 mb-2 mt-3 flex shrink-0 items-center gap-2 border-b border-white/18 pb-3 text-right">
          <BesatLogoMark size="sm" tone="light" className="!h-11 !w-11" />
          <span className="text-sm font-black text-white">مجتمع آموزشی بعثت</span>
        </Link>

        <SidebarMenu data={data} activeKey={activeKey} />

        <div className="besat-dashboard-sidebar-footer shrink-0 border-t border-white/16 p-3">
          <Link href="/" className="dashboard-sidebar-link">
            <PanelIcon name="globe" className="size-[1.35rem]" />
            <span>بازگشت به سایت</span>
          </Link>
          <div className="mt-1">
            <PanelLogoutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DashboardShell({ data, activeKey = "overview", panel }: DashboardShellProps) {
  const role = readBesatSession()?.role as DashboardMenuRole | undefined;
  const visibleData = {
    ...data,
    menu: data.menu.filter(
      (item) => !item.roles || item.roles.includes(role ?? "parent"),
    ),
  };
  const requestedItem = data.menu.find((item) => item.key === activeKey);
  const activeItem = visibleData.menu.find((item) => item.key === activeKey);
  const fallbackItem = visibleData.menu[0];
  const isForbidden = Boolean(requestedItem) && !activeItem;
  const isUnknown = !requestedItem;
  const isUnavailable = isForbidden || isUnknown;
  const displayedItem = activeItem ?? fallbackItem;
  const profileItem = visibleData.menu.find((item) => item.key === "profile");
  const isOverview = displayedItem.key === "overview";

  return (
    <main className="besat-dashboard min-h-screen bg-[#fbfaf7] text-slate-900" dir="rtl">
      <a href="#dashboard-content" className="sr-only z-50 rounded-md bg-white px-4 py-3 text-sm font-black text-[#102b4a] focus:not-sr-only focus:fixed focus:right-4 focus:top-4">
        رفتن به محتوای اصلی
      </a>
      <div className="grid min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Sidebar data={visibleData} activeKey={isUnavailable ? "" : displayedItem.key} />

        <section className="min-w-0">
          <DashboardTopbar
            panel={panel}
            profileHref={profileItem?.href ?? visibleData.currentPath}
            mobileMenu={<DashboardMobileMenu data={visibleData} activeKey={isUnavailable ? "" : displayedItem.key} />}
          />

          <div id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[112rem] px-4 py-6 sm:px-6 lg:px-7 lg:py-7">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4 text-right">
              <div>
                <div className="flex items-center gap-2">
                  {!isOverview && !isUnavailable ? <PanelIcon name={displayedItem.icon} className="size-6 text-[#0c4479]" /> : null}
                  <h1 className="text-2xl font-black tracking-tight text-[#102b4a] sm:text-[1.65rem]">
                    {isUnknown ? "مسیر نامعتبر" : isForbidden ? "دسترسی محدود" : isOverview ? visibleData.title : displayedItem.label}
                  </h1>
                </div>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
                  {isUnknown
                    ? "این بخش در پنل وجود ندارد یا نشانی آن تغییر کرده است."
                    : isForbidden
                    ? "حساب کاربری شما اجازه دسترسی به این بخش را ندارد."
                    : isOverview
                      ? visibleData.description
                      : displayedItem.description}
                </p>
              </div>
            </header>

            {isUnavailable ? (
              <section role="alert" className="panel-card max-w-2xl border-rose-100 bg-rose-50/50 text-right">
                <PanelIcon name="warning" className="size-8 text-rose-600" />
                <h2 className="mt-4 text-lg font-black text-[#102b4a]">{isUnknown ? "این مسیر در دسترس نیست" : "این مسیر برای نقش شما در دسترس نیست"}</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
                  {isUnknown ? "از یکی از بخش‌های منوی پنل استفاده کنید یا نشانی را بررسی کنید." : "برای ادامه، یکی از بخش‌های قابل‌دسترسی را از منوی پنل انتخاب کنید."}
                </p>
                <Link href={fallbackItem.href} className="mt-4 inline-flex rounded-lg bg-[#12395b] px-4 py-2 text-sm font-black text-white">
                  بازگشت به پنل
                </Link>
              </section>
            ) : isOverview ? (
              <DashboardOverview panel={panel} data={visibleData} />
            ) : (
              <DashboardSectionContent
                panel={panel}
                sectionKey={displayedItem.key}
                roleTitle={visibleData.roleTitle}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
