"use client";

import { CrudSection, EmptyState, StatusBadge } from "@/components/crud/crud-ui";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { cmsGetCourseEnrollments } from "@/services/shop-cms-service";

export function ShopEnrollmentsManager() {
  const { data, loading, error } = usePanelRequest(() => cmsGetCourseEnrollments(), []);
  const enrollments = data?.results ?? [];

  return (
    <CrudSection title="ثبت‌نام دوره‌ها" description="ثبت‌نام‌های دوره‌های آنلاین و حضوری (فقط پس از پرداخت تأییدشده ایجاد می‌شوند)">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : enrollments.length === 0 ? (
        <EmptyState text="ثبت‌نامی وجود ندارد." />
      ) : (
        <div className="overflow-x-auto">
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
        </div>
      )}
    </CrudSection>
  );
}
