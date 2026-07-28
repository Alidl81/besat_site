"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { panelService } from "@/services/panel-service";
import type { ParentChildDetail } from "@/types/panel-api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ParentChildrenWorkspace() {
  const searchParams = useSearchParams();
  const academicYear = searchParams.get("academic_year");
  const [selectedId, setSelectedId] = useState<string | number | null>(
    searchParams.get("child"),
  );
  const childrenRequest = usePanelRequest(
    () => panelService.parentChildren(),
    [],
  );
  const [detail, setDetail] = useState<ParentChildDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);

  const items = childrenRequest.data ?? [];
  const effectiveSelectedId = items.some(
    (item) => String(item.id) === String(selectedId),
  )
    ? selectedId
    : items[0]?.id ?? null;

  useEffect(() => {
    if (effectiveSelectedId === null) return;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) {
          setDetailLoading(true);
          setDetailError(null);
        }
        return panelService.parentChild(effectiveSelectedId, {
          academic_year: academicYear,
        });
      })
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setDetailError(
            reason instanceof Error ? reason.message : "دریافت پرونده فرزند انجام نشد.",
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [academicYear, detailVersion, effectiveSelectedId]);

  if (childrenRequest.loading) return <PanelLoading label="در حال دریافت فرزندان..." />;
  if (childrenRequest.error) return <PanelError message={childrenRequest.error} onRetry={childrenRequest.reload} />;

  const children = items;
  if (!children.length) {
    return <PanelEmpty title="فرزندی به این حساب متصل نشده است." detail="اتصال فرزند باید توسط واحد آموزشی یا از فرایند ثبت‌نام انجام شود." />;
  }

  return (
    <div className="space-y-5">
      <section className="panel-split-layout grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <article className="panel-card">
          <h2 className="mb-4 text-sm font-black text-[#173652]">انتخاب فرزند</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {children.map((child) => (
              <button key={child.id} type="button" onClick={() => setSelectedId(child.id)} className={`rounded-lg border p-4 text-center transition-colors ${String(child.id) === String(effectiveSelectedId) ? "border-[#dda34a] bg-[#fffaf2]" : "border-slate-200 hover:bg-slate-50"}`}>
                {child.avatar_url ? (
                  <Image src={child.avatar_url} alt="" width={56} height={56} className="mx-auto size-14 rounded-full object-cover" />
                ) : (
                  <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#eaf0f5] text-lg font-black text-[#0c3a66]">{child.full_name.slice(0, 1)}</span>
                )}
                <b className="mt-3 block text-sm text-[#172b43]">{child.full_name}</b>
                <span className="mt-1 block text-xs font-bold text-slate-500">{child.grade_title ?? "پایه ثبت نشده"}</span>
                <i className={`mx-auto mt-3 block size-2 rounded-full ${child.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
              </button>
            ))}
          </div>
        </article>

        <article className="panel-card">
          {detailLoading ? <PanelLoading label="در حال دریافت پرونده تحصیلی..." /> : detailError ? <PanelError message={detailError} onRetry={() => setDetailVersion((value) => value + 1)} /> : detail && String(detail.id) === String(effectiveSelectedId) ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {detail.avatar_url ? (
                  <Image src={detail.avatar_url} alt="" width={96} height={96} className="size-24 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex size-24 shrink-0 items-center justify-center rounded-full bg-[#eaf0f5] text-3xl font-black text-[#0c3a66]">{detail.full_name.slice(0, 1)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-[#172b43]">{detail.full_name}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">{[detail.grade_title, detail.major].filter(Boolean).join(" — ") || "اطلاعات تحصیلی ثبت نشده"}</p>
                  <p className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-600"><PanelIcon name="units" className="size-4" />{detail.unit_title ?? "واحد آموزشی ثبت نشده"}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 rounded-lg border border-slate-200 p-4 text-center">
                <div><span className="text-xs font-bold text-slate-500">معدل کل</span><b className="mt-2 block text-xl text-emerald-600">{detail.average ?? "—"}</b></div>
                <div><span className="text-xs font-bold text-slate-500">رتبه در کلاس</span><b className="mt-2 block text-xl text-[#1c65b6]">{detail.class_rank ?? "—"}</b></div>
                <div><span className="text-xs font-bold text-slate-500">رتبه در پایه</span><b className="mt-2 block text-xl text-[#7f48a8]">{detail.grade_rank ?? "—"}</b></div>
              </div>
            </>
          ) : <PanelEmpty title="فرزندی انتخاب نشده است." />}
        </article>
      </section>

      {detail && String(detail.id) === String(effectiveSelectedId) ? (
        <>
          <section className="grid gap-5 xl:grid-cols-3">
            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="students" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">دبیران</h2></header>
              {detail.teachers.length ? <div className="divide-y divide-slate-100">{detail.teachers.map((teacher) => <div key={teacher.id} className="flex items-center gap-3 py-2.5">{teacher.avatar_url ? <Image src={teacher.avatar_url} alt="" width={32} height={32} className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-[#edf2f5] text-[10px] font-black">{teacher.full_name.slice(0, 1)}</span>}<b className="min-w-0 flex-1 text-xs text-[#172b43]">{teacher.full_name}<small className="mt-1 block font-bold text-slate-500">{teacher.subject}</small></b></div>)}</div> : <PanelEmpty title="دبیری ثبت نشده است." />}
            </article>

            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="calendar" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">وضعیت حضور و غیاب</h2></header>
              {detail.attendance ? (
                <div className="flex items-center justify-center gap-5 py-6">
                  <div className="flex size-36 items-center justify-center rounded-full bg-[conic-gradient(#219653_var(--attendance),#eef1f4_0)]" style={{ "--attendance": `${detail.attendance.attendance_percent}%` } as React.CSSProperties}><div className="flex size-24 flex-col items-center justify-center rounded-full bg-white"><b className="text-3xl text-[#172b43]">{detail.attendance.attendance_percent}%</b><span className="text-xs text-slate-500">حضور</span></div></div>
                  <ul className="space-y-3 text-xs font-bold text-slate-600"><li>حضور {detail.attendance.present_days} روز</li><li>غیبت موجه {detail.attendance.excused_absence_days} روز</li><li>غیبت غیرموجه {detail.attendance.unexcused_absence_days} روز</li><li>تأخیر {detail.attendance.late_days} روز</li></ul>
                </div>
              ) : <PanelEmpty title="گزارش حضور و غیاب ثبت نشده است." />}
            </article>

            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="chart" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">آخرین نمرات</h2></header>
              {detail.latest_grades.length ? <div className="overflow-hidden rounded-lg border border-slate-200"><table className="panel-table"><thead><tr><th>درس</th><th>نمره</th><th>وضعیت</th></tr></thead><tbody>{detail.latest_grades.map((grade) => <tr key={grade.id}><td className="font-black text-[#172b43]">{grade.subject}</td><td>{grade.score}</td><td>{grade.status_label ?? "—"}</td></tr>)}</tbody></table></div> : <PanelEmpty title="نمره‌ای ثبت نشده است." />}
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="services" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">دسترسی سریع</h2></header>
              {detail.quick_links.length ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{detail.quick_links.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between px-4 py-3 text-xs font-black text-[#172b43] hover:bg-[#fff8ec]"><span>{item.title}</span><PanelIcon name="chevron" className="size-4 rotate-180" /></Link>)}</div> : <PanelEmpty title="دسترسی سریعی تعریف نشده است." />}
            </article>
            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="message" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">پیام مشاور</h2></header>
              {detail.counselor_message ? <><h3 className="text-sm font-black text-[#172b43]">{detail.counselor_message.title}</h3><p className="mt-2 text-xs font-bold leading-7 text-slate-600">{detail.counselor_message.description}</p><time className="mt-3 block text-[11px] text-slate-400">{detail.counselor_message.timestamp ? formatDate(detail.counselor_message.timestamp) : "—"}</time></> : <PanelEmpty title="پیامی از مشاور وجود ندارد." />}
              <Link href="/dashboard/parents/messages" className="panel-primary-button mt-6">پیام‌ها</Link>
            </article>
            <article className="panel-card">
              <header className="mb-4 flex items-center gap-2"><PanelIcon name="calendar" className="size-5 text-[#0c4479]" /><h2 className="font-black text-[#173652]">امتحانات پیش رو</h2></header>
              {detail.exams.length ? <div className="space-y-3 text-xs font-bold text-slate-600">{detail.exams.map((exam) => <div key={exam.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span>{exam.title}</span><time>{formatDate(exam.starts_at)}</time></div>)}</div> : <PanelEmpty title="امتحانی ثبت نشده است." />}
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
