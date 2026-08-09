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
      {data.menu.map((item) => {
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
    <aside className="hidden xl:block">
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
  const activeItem = visibleData.menu.find((item) => item.key === activeKey) ?? visibleData.menu[0];
  const profileItem = visibleData.menu.find((item) => item.key === "profile");
  const isOverview = activeItem.key === "overview";

  return (
    <main className="besat-dashboard min-h-screen bg-[#fbfaf7] text-slate-900" dir="rtl">
      <a href="#dashboard-content" className="sr-only z-50 rounded-md bg-white px-4 py-3 text-sm font-black text-[#102b4a] focus:not-sr-only focus:fixed focus:right-4 focus:top-4">
        رفتن به محتوای اصلی
      </a>
      <div className="grid min-h-screen xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Sidebar data={visibleData} activeKey={activeItem.key} />

        <section className="min-w-0">
          <DashboardTopbar
            panel={panel}
            profileHref={profileItem?.href ?? visibleData.currentPath}
            mobileMenu={<DashboardMobileMenu data={visibleData} activeKey={activeItem.key} />}
          />

          <div id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[112rem] px-4 py-6 sm:px-6 lg:px-7 lg:py-7">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4 text-right">
              <div>
                <div className="flex items-center gap-2">
                  {!isOverview ? <PanelIcon name={activeItem.icon} className="size-6 text-[#0c4479]" /> : null}
                  <h1 className="text-2xl font-black tracking-tight text-[#102b4a] sm:text-[1.65rem]">
                    {isOverview ? visibleData.title : activeItem.label}
                  </h1>
                </div>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
                  {isOverview ? visibleData.description : activeItem.description}
                </p>
              </div>
            </header>

            {isOverview ? (
              <DashboardOverview panel={panel} data={visibleData} />
            ) : (
              <DashboardSectionContent
                panel={panel}
                sectionKey={activeItem.key}
                roleTitle={visibleData.roleTitle}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
