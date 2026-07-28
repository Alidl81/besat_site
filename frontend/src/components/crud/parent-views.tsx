"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { panelService } from "@/services/panel-service";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ParentChildrenView() {
  const request = usePanelRequest(() => panelService.parentChildren(), []);
  if (request.loading) return <PanelLoading label="در حال دریافت فرزندان..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data?.length) return <PanelEmpty title="فرزندی به حساب شما متصل نشده است." />;

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {request.data.map((child) => (
        <article key={child.id} className="panel-card">
          {child.avatar_url ? <Image src={child.avatar_url} alt="" width={48} height={48} className="size-12 rounded-full object-cover" /> : <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 font-black text-blue-700">{child.full_name.slice(0, 1)}</span>}
          <h2 className="mt-3 text-base font-black text-[#062452]">{child.full_name}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{[child.grade_title, child.class_title].filter(Boolean).join(" · ") || "اطلاعات کلاس ثبت نشده"}</p>
        </article>
      ))}
    </section>
  );
}

export function ParentProgramsView() {
  const searchParams = useSearchParams();
  const child = searchParams.get("child");
  const academicYear = searchParams.get("academic_year");
  const request = usePanelRequest(
    () => panelService.parentPrograms({ child, academic_year: academicYear }),
    [child, academicYear],
  );
  if (request.loading) return <PanelLoading label="در حال دریافت برنامه‌ها..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data?.results.length) return <PanelEmpty title="برنامه‌ای برای این فرزند و سال تحصیلی ثبت نشده است." />;

  return (
    <section className="panel-card">
      <div className="space-y-3">
        {request.data.results.map((program) => (
          <article key={program.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-5">
            <div>
              <h2 className="text-base font-black text-[#062452]">{program.title}</h2>
              {program.description ? <p className="mt-1 text-sm font-bold text-slate-500">{program.description}</p> : null}
              {program.location ? <p className="mt-2 text-xs font-bold text-slate-400">{program.location}</p> : null}
            </div>
            <time className="shrink-0 text-xs font-black text-blue-700">{formatDate(program.starts_at)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
