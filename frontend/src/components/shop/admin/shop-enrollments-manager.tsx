"use client";

import { useState } from "react";
import { CrudSection, EmptyState, StatusBadge } from "@/components/crud/crud-ui";
import { PanelError } from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { cmsGetCourseEnrollments } from "@/services/shop-cms-service";

export function ShopEnrollmentsManager() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetCourseEnrollments({ page }), [page]);
  const enrollments = data?.results ?? [];

  return (
    <CrudSection title="ثبت‌نام دوره‌ها" description="ثبت‌نام‌های دوره‌های آنلاین و حضوری (فقط پس از پرداخت تأییدشده ایجاد می‌شوند)">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: see shop-categories-manager.tsx
        // -- identical no-retry defect, same shared PanelError fix.
        <PanelError message={error} onRetry={reload} />
      ) : enrollments.length === 0 ? (
        <EmptyState text="ثبت‌نامی وجود ندارد." />
      ) : (
        <div className="panel-table-scroll">
          {/* panel-table-scroll (globals.css) -- see
              FE-DASH-RTL-TABLE-ROOT-OVERFLOW-001 and
              FE-DASH-RTL-TABLE-MOBILE-AFFORDANCE-001 in
              shop-orders-manager.tsx: isolates this wrapper's overflowing
              RTL table content from contributing to root-level
              documentElement.scrollWidth, and fades in an edge cue when
              columns start outside the visible area. */}
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>کاربر</th>
                <th>دوره</th>
                <th>وضعیت</th>
                <th>تأیید</th>
                <th>تاریخ اعطا</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="font-black">{enrollment.user_display}</td>
                  <td>{enrollment.product_title}</td>
                  <td><StatusBadge status={enrollment.status} /></td>
                  <td>{enrollment.is_confirmed ? "تأییدشده" : "در انتظار تأیید"}</td>
                  <td>{new Intl.DateTimeFormat("fa-IR").format(new Date(enrollment.granted_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* FE-PANEL-ADMIN-COURSE-ENROLLMENTS-PAGINATION-001: the backend's
              StandardResultsSetPagination returns ten items per page, but this
              never sent a page param and never rendered any next/previous
              control -- older enrollments became permanently inaccessible past
              the first page. Reuses the established pagination nav convention
              from messaging-panel.tsx/gallery-explorer.tsx. */}
          {data?.next || data?.previous ? (
            <nav aria-label="صفحه‌بندی ثبت‌نام‌ها" className="flex items-center justify-center gap-3 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                disabled={!data?.previous}
                onClick={() => setPage((current) => current - 1)}
                className="min-h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-[#0f2f4a] disabled:opacity-45"
              >
                صفحه قبل
              </button>
              <span className="text-xs font-black text-slate-600">
                صفحه {new Intl.NumberFormat("fa-IR").format(page)}
              </span>
              <button
                type="button"
                disabled={!data?.next}
                onClick={() => setPage((current) => current + 1)}
                className="min-h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-[#0f2f4a] disabled:opacity-45"
              >
                صفحه بعد
              </button>
            </nav>
          ) : null}
        </div>
      )}
    </CrudSection>
  );
}
