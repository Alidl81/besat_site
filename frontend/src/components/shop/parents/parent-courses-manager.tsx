"use client";

import { CrudSection, EmptyState, StatusBadge } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getMyCourses } from "@/services/shop-account-service";

export function ParentCoursesManager() {
  const { data, loading, error } = usePanelRequest(() => getMyCourses(), []);
  const enrollments = data ?? [];

  return (
    <CrudSection title="دوره‌های من" description="دوره‌های آنلاین و حضوری خریداری‌شده و وضعیت دسترسی به آن‌ها">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : enrollments.length === 0 ? (
        <EmptyState text="تاکنون در دوره‌ای ثبت‌نام نکرده‌اید." />
      ) : (
        <ul className="grid gap-3">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="panel-card flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-black text-[#062452]">{enrollment.product_title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {enrollment.product_type === "online_course" ? "دوره آنلاین" : "دوره حضوری"} — تاریخ اعطای دسترسی:{" "}
                  {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(enrollment.granted_at))}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={enrollment.status} />
                {enrollment.status === "active" && !enrollment.is_confirmed ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                    در انتظار تأیید مدرسه
                  </span>
                ) : null}
                {enrollment.status === "active" && enrollment.is_confirmed && enrollment.access_url ? (
                  <a
                    href={enrollment.access_url}
                    target="_blank"
                    rel="noreferrer"
                    className="panel-primary-button inline-flex items-center gap-1.5 text-xs"
                  >
                    ورود به کلاس
                    <PanelIcon name="link" className="size-3.5" />
                  </a>
                ) : null}
                {enrollment.status === "active" && enrollment.is_confirmed && !enrollment.access_url && enrollment.access_notes ? (
                  <p className="max-w-xs text-xs font-bold text-slate-600">{enrollment.access_notes}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CrudSection>
  );
}
