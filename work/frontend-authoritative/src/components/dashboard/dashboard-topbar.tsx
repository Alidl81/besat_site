"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  getBesatSessionDisplayName,
  readBesatSession,
} from "@/lib/auth/auth-session";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type { PanelContext } from "@/types/panel-api";

type DashboardTopbarProps = {
  panel: "admin" | "unitManager" | "media" | "parents";
  profileHref: string;
  mobileMenu: ReactNode;
};

export function DashboardTopbar({
  panel,
  profileHref,
  mobileMenu,
}: DashboardTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [context, setContext] = useState<PanelContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReturnType<typeof readBesatSession>>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(readBesatSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    panelService
      .context({
        academic_year: searchParams.get("academic_year"),
        unit: searchParams.get("unit"),
        child: searchParams.get("child"),
      })
      .then((result) => {
        if (active) {
          setContext(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(getApiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [panel, searchParams]);

  function select(name: "academic_year" | "unit" | "child", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const displayName =
    context?.user.full_name ??
    (session ? getBesatSessionDisplayName(session) : "حساب کاربری");
  const roleTitle = context?.user.role_display ?? "";
  const selectedAcademicYear = String(
    searchParams.get("academic_year") ??
      context?.selected_academic_year_id ??
      "",
  );
  const selectedUnit = String(
    searchParams.get("unit") ?? context?.selected_unit_id ?? "",
  );
  const selectedChild = String(
    searchParams.get("child") ?? context?.selected_child_id ?? "",
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[#e7e9ec] bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-[5.35rem] items-center gap-3 px-4 sm:px-6 lg:px-7">
        <div className="xl:hidden">{mobileMenu}</div>

        <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
          {panel === "parents" ? (
            <label className="panel-top-select min-w-[16.5rem]">
              <PanelIcon name="calendar" className="size-5" />
              <select
                value={selectedAcademicYear}
                onChange={(event) => select("academic_year", event.target.value)}
                aria-label="انتخاب سال تحصیلی"
                disabled={!context}
                className="min-w-0 flex-1 bg-transparent font-inherit outline-none"
              >
                <option value="">انتخاب سال تحصیلی</option>
                {context?.academic_years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="panel-top-select min-w-[16.5rem]">
              <PanelIcon name="building" className="size-5" />
              <select
                value={selectedUnit}
                onChange={(event) => select("unit", event.target.value)}
                aria-label="انتخاب واحد آموزشی"
                disabled={!context}
                className="min-w-0 flex-1 bg-transparent font-inherit outline-none"
              >
                <option value="">همه واحدهای مجاز</option>
                {context?.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="hidden flex-1 items-center justify-center lg:flex">
          {panel === "parents" ? (
            <label className="panel-top-select min-w-[16rem]">
              <PanelIcon name="students" className="size-5" />
              <select
                value={selectedChild}
                onChange={(event) => select("child", event.target.value)}
                aria-label="انتخاب فرزند"
                disabled={!context}
                className="min-w-0 flex-1 bg-transparent font-inherit outline-none"
              >
                <option value="">انتخاب فرزند</option>
                {context?.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.title}
                    {child.subtitle ? ` — ${child.subtitle}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="panel-top-select min-w-[16rem]">
              <PanelIcon name="calendar" className="size-5" />
              <select
                value={selectedAcademicYear}
                onChange={(event) => select("academic_year", event.target.value)}
                aria-label="انتخاب سال تحصیلی"
                disabled={!context}
                className="min-w-0 flex-1 bg-transparent font-inherit outline-none"
              >
                <option value="">انتخاب سال تحصیلی</option>
                {context?.academic_years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mr-auto flex items-center gap-1 sm:gap-2">
          <button type="button" className="panel-icon-button relative" aria-label="تقویم">
            <PanelIcon name="calendar" />
          </button>
          <button
            type="button"
            className="panel-icon-button relative"
            aria-label={`اعلان‌ها${context?.unread_notifications ? `، ${context.unread_notifications} خوانده‌نشده` : ""}`}
          >
            <PanelIcon name="bell" />
            {context?.unread_notifications ? (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-[#df8d16]" />
            ) : null}
          </button>
          <Link
            href={
              panel === "parents"
                ? "/dashboard/parents/messages"
                : panel === "media"
                  ? "/dashboard/media/messages"
                  : panel === "unitManager"
                    ? "/dashboard/unit-manager/messages"
                    : "/dashboard/admin/messages"
            }
            className="panel-icon-button relative"
            aria-label={`پیام‌ها${context?.unread_messages ? `، ${context.unread_messages} خوانده‌نشده` : ""}`}
          >
            <PanelIcon name="mail" />
            {context?.unread_messages ? (
              <span className="absolute -right-0.5 top-0 flex min-w-4 items-center justify-center rounded-full bg-[#d88713] px-1 text-[9px] font-black text-white">
                {context.unread_messages}
              </span>
            ) : null}
          </Link>

          <span className="mx-1 hidden h-9 w-px bg-slate-200 sm:block" />

          <Link
            href={profileHref}
            title={error ?? undefined}
            className="flex min-w-0 items-center gap-2 rounded-xl p-1.5 text-right transition-colors hover:bg-[#f8f3eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c77f14]"
          >
            {context?.user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={context.user.avatar_url}
                alt=""
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0a2b50] text-sm font-black text-white">
                {displayName.slice(0, 1)}
              </span>
            )}
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-black text-[#102b4a]">
                {displayName}
              </span>
              <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
                {roleTitle || (context ? "—" : "در حال دریافت نقش...")}
              </span>
            </span>
            <PanelIcon name="chevron" className="hidden size-4 rotate-90 text-slate-500 sm:block" />
          </Link>
        </div>
      </div>
    </header>
  );
}
