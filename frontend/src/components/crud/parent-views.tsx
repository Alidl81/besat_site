"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();
  const child = searchParams.get("child");
  const academicYear = searchParams.get("academic_year");
  const childrenRequest = usePanelRequest(() => panelService.parentChildren(), []);
  const selectedChild = childrenRequest.data?.find(
    (item) => String(item.id) === child,
  );
  const programsRequest = usePanelRequest(
    () =>
      selectedChild
        ? panelService.parentPrograms({
            child: String(selectedChild.id),
            academic_year: academicYear,
          })
        : Promise.resolve(null),
    [selectedChild?.id, academicYear],
  );

  function selectChild(id: string | number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("child", String(id));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (childrenRequest.loading) return <PanelLoading label="در حال دریافت فرزندان..." />;
  if (childrenRequest.error) return <PanelError message={childrenRequest.error} onRetry={childrenRequest.reload} />;
  if (!childrenRequest.data?.length) return <PanelEmpty title="برای مشاهده برنامه‌ها ابتدا باید فرزندی به این حساب متصل شود." />;

  return (
    <div className="space-y-5">
      <section className="panel-card">
        <label className="block max-w-md text-right">
          <span className="panel-field-label">انتخاب فرزند</span>
          <select
            value={selectedChild ? String(selectedChild.id) : ""}
            onChange={(event) => {
              if (event.target.value) selectChild(event.target.value);
            }}
            className="panel-select mt-2"
            aria-label="انتخاب فرزند برای مشاهده برنامه‌ها"
          >
            <option value="">فرزند را انتخاب کنید</option>
            {childrenRequest.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-xs font-bold leading-6 text-slate-500">
          {academicYear
            ? "سال تحصیلی انتخاب‌شده در این پاسخ پشتیبانی نمی‌شود؛ برنامه‌ها برای فرزند انتخاب‌شده نمایش داده می‌شوند."
            : "برای مشاهده برنامه‌ها، یکی از فرزندان متصل به حساب را انتخاب کنید."}
        </p>
      </section>

      {!selectedChild ? (
        <PanelEmpty title="برای مشاهده برنامه‌ها یک فرزند انتخاب کنید." />
      ) : programsRequest.loading ? (
        <PanelLoading label="در حال دریافت برنامه‌ها..." />
      ) : programsRequest.error ? (
        <PanelError message={programsRequest.error} onRetry={programsRequest.reload} />
      ) : !programsRequest.data?.results.length ? (
        <PanelEmpty title="برنامه‌ای برای این فرزند ثبت نشده است." />
      ) : (
        <section className="panel-card">
          <div className="space-y-3">
            {programsRequest.data.results.map((program) => (
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
      )}
    </div>
  );
}
