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
  panel: "admin" | "contentManager" | "parents";
  profileHref: string;
  mobileMenu: ReactNode;
};

function ContextUnavailable({
  icon,
  children,
}: {
  icon: "calendar" | "students" | "building";
  children: ReactNode;
}) {
  return (
    <p className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold leading-5 text-slate-500">
      <PanelIcon name={icon} className="size-4 shrink-0 text-slate-400" />
      <span>{children}</span>
    </p>
  );
}

function UnitContextSelect({
  context,
  selectedUnit,
  onSelect,
}: {
  context: PanelContext | null;
  selectedUnit: string;
  onSelect: (value: string) => void;
}) {
  if (!context) {
    return <ContextUnavailable icon="building">در حال دریافت واحدهای مجاز…</ContextUnavailable>;
  }

  if (context.units.length === 0) {
    return <ContextUnavailable icon="building">واحد قابل انتخابی برای این حساب ثبت نشده است.</ContextUnavailable>;
  }

  return (
    <label className="panel-top-select min-w-[16.5rem]">
      <PanelIcon name="building" className="size-5" />
      <select
        value={selectedUnit}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="انتخاب واحد آموزشی"
        className="min-w-0 flex-1 bg-transparent font-inherit outline-none"
      >
        <option value="">همه واحدهای مجاز</option>
        {context.units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardTopbar({
  panel,
  profileHref,
  mobileMenu,
}: DashboardTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [context, setContext] = useState<PanelContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReturnType<typeof readBesatSession>>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(readBesatSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(queryString);
    panelService
      .context({
        academic_year: params.get("academic_year"),
        unit: params.get("unit"),
        child: params.get("child"),
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
  }, [panel, queryString]);

  function select(name: "academic_year" | "unit" | "child", value: string) {
    const next = new URLSearchParams(queryString);
    if (value) next.set(name, value);
    else next.delete(name);
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  const displayName =
    context?.user.full_name ??
    (session ? getBesatSessionDisplayName(session) : "حساب کاربری");
  const roleTitle = context?.user.role_display ?? "";
  const selectedUnit = String(
    searchParams.get("unit") ?? context?.selected_unit_id ?? "",
  );
  const hasAcademicYearFilters = Boolean(context?.academic_years.length);
  // The academic-year filter has no real data yet for any non-parent panel,
  // so its slot is left out entirely (rather than permanently showing a
  // "not supported" message) until hasAcademicYearFilters actually has
  // something to show.
  const showAcademicYearZone = panel !== "parents" && hasAcademicYearFilters;
  const messagesHref =
    panel === "parents"
      ? "/dashboard/parents/messages"
      : panel === "contentManager"
        ? "/dashboard/content-manager/messages"
        : "/dashboard/admin/messages";
  const parentFiltersUnavailable = context && !hasAcademicYearFilters;

  return (
    <header className="sticky top-0 z-30 border-b border-[#e7e9ec] bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-[5.35rem] items-center gap-3 px-4 sm:px-6 lg:px-7">
        <div className="lg:hidden">{mobileMenu}</div>

        <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
          {panel === "parents" ? (
            context ? (
              hasAcademicYearFilters ? (
                <ContextUnavailable icon="calendar">فیلتر سال تحصیلی هنوز برای پنل والدین پشتیبانی نمی‌شود.</ContextUnavailable>
              ) : (
                <ContextUnavailable icon="calendar">سال تحصیلی قابل انتخابی ثبت نشده است.</ContextUnavailable>
              )
            ) : (
              <ContextUnavailable icon="calendar">در حال دریافت محدوده حساب…</ContextUnavailable>
            )
          ) : (
            <UnitContextSelect
              context={context}
              selectedUnit={selectedUnit}
              onSelect={(value) => select("unit", value)}
            />
          )}
        </div>

        {panel === "parents" ? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            {context ? (
              <ContextUnavailable icon="students">انتخاب فرزند از بخش «فرزندان من» انجام می‌شود.</ContextUnavailable>
            ) : (
              <ContextUnavailable icon="students">در حال دریافت محدوده حساب…</ContextUnavailable>
            )}
          </div>
        ) : showAcademicYearZone ? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <ContextUnavailable icon="calendar">فیلتر سال تحصیلی هنوز برای این پنل پشتیبانی نمی‌شود.</ContextUnavailable>
          </div>
        ) : null}

        <div className="mr-auto flex items-center gap-1 sm:gap-2">
          <Link
            href={messagesHref}
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

      {error ? (
        <p role="status" className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-bold leading-5 text-rose-700 sm:px-6">
          دریافت محدوده پنل ناموفق بود: {error}
        </p>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-2 md:hidden sm:px-6">
        {panel === "parents" ? (
          <ContextUnavailable icon="students">
            {parentFiltersUnavailable
              ? "سال تحصیلی تا زمان پشتیبانی API در دسترس نیست؛ انتخاب فرزند در بخش «فرزندان من» انجام می‌شود."
              : "در حال دریافت محدوده حساب…"}
          </ContextUnavailable>
        ) : (
          <UnitContextSelect
            context={context}
            selectedUnit={selectedUnit}
            onSelect={(value) => select("unit", value)}
          />
        )}
      </div>
    </header>
  );
}
