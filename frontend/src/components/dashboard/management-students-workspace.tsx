"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/crud/crud-ui";
import { PanelIcon, type PanelIconName } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type { StudentItem, StudentSummary } from "@/types/panel-api";

type StudentWorkspaceProps = { unitId?: string | null };

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR").format(date);
}

function SummaryCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: PanelIconName;
  tone: string;
}) {
  return (
    <article className="panel-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-600">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#101828]">{value}</p>
        </div>
        <span className={`flex size-11 items-center justify-center rounded-full ${tone}`}>
          <PanelIcon name={icon} className="size-6" />
        </span>
      </div>
    </article>
  );
}

function StudentForm({
  student,
  unitId,
  saving,
  onSubmit,
  onCancel,
}: {
  student: StudentItem | null;
  unitId: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
      <label>
        <span className="panel-field-label">نام و نام خانوادگی</span>
        <input name="full_name" defaultValue={student?.full_name} required className="panel-input" />
      </label>
      <label>
        <span className="panel-field-label">کد ملی</span>
        <input name="national_code" defaultValue={student?.national_code ?? ""} inputMode="numeric" className="panel-input" />
      </label>
      <label>
        <span className="panel-field-label">کلاس</span>
        <input name="class_title" defaultValue={student?.class_room?.title ?? ""} className="panel-input" />
      </label>
      <input type="hidden" name="unit_id" value={unitId ?? student?.unit?.id ?? ""} />
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 md:col-span-2">
        <button type="button" onClick={onCancel} className="panel-secondary-button">انصراف</button>
        <button disabled={saving} type="submit" className="panel-primary-button">
          {saving ? "در حال ذخیره..." : student ? "ذخیره تغییرات" : "ثبت دانش‌آموز"}
        </button>
      </div>
    </form>
  );
}

export function ManagementStudentsWorkspace({
  unitId = null,
}: StudentWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requestParams = {
    search: debouncedSearch,
    profile_status: profileStatus,
    unit: unitId,
    page,
  };
  const { data, loading, error, reload } = usePanelRequest(
    () => panelService.students(requestParams),
    [debouncedSearch, profileStatus, unitId, page],
  );
  const students = useMemo(() => data?.page.results ?? [], [data]);
  const summary: StudentSummary | null = data?.summary ?? null;

  const effectiveSelectedId = students.some(
    (student) => String(student.id) === String(selectedId),
  )
    ? selectedId
    : students[0]?.id ?? null;

  const selected = useMemo(
    () => students.find((student) => String(student.id) === String(effectiveSelectedId)) ?? null,
    [effectiveSelectedId, students],
  );

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") ?? ""),
      national_code: String(form.get("national_code") ?? "") || null,
      class_title: String(form.get("class_title") ?? "") || null,
      unit_id: String(form.get("unit_id") ?? "") || null,
    };
    setSaving(true);
    setActionError(null);
    try {
      if (modal === "edit" && selected) {
        await panelService.updateStudent(selected.id, payload);
        setActionMessage("اطلاعات دانش‌آموز با موفقیت به‌روزرسانی شد.");
      } else {
        await panelService.createStudent(payload);
        setActionMessage("دانش‌آموز با موفقیت ثبت شد.");
      }
      setModal(null);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function exportExcel() {
    setActionError(null);
    try {
      const result = await panelService.exportStudents(requestParams);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = decodeURIComponent(result.filename ?? "students.xlsx");
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    }
  }

  if (loading && !data) return <PanelLoading label="در حال دریافت دانش‌آموزان..." />;
  if (error && !data) return <PanelError message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      {actionError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p> : null}
      {actionMessage ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{actionMessage}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={exportExcel} className="panel-secondary-button">
          <PanelIcon name="download" className="size-4" />خروجی CSV
        </button>
        <button type="button" onClick={() => setModal("create")} className="panel-primary-button">
          <PanelIcon name="plus" className="size-5" />دانش‌آموز جدید
        </button>
      </div>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="کل دانش‌آموزان" value={summary.total} icon="students" tone="bg-[#eef4fb] text-[#1760a9]" />
          <SummaryCard title="پروفایل‌های تکمیل‌شده" value={summary.completed_profiles} icon="check" tone="bg-[#edf8ef] text-[#248749]" />
          <SummaryCard title="ثبت‌نام‌های جدید (امسال)" value={summary.new_this_year} icon="plus" tone="bg-[#f4effb] text-[#7d4aa5]" />
          <SummaryCard title="پرونده‌های ناقص" value={summary.incomplete_profiles} icon="document" tone="bg-[#fff4e7] text-[#d17d0d]" />
        </section>
      ) : null}

      <section className="panel-split-layout grid gap-5 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="panel-card h-fit 2xl:sticky 2xl:top-28">
          {selected ? (
            <>
              <div className="py-3 text-center">
                {selected.avatar_url ? (
                  <Image src={selected.avatar_url} alt="" width={80} height={80} className="mx-auto size-20 rounded-full object-cover" />
                ) : (
                  <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#eaf0f5] text-2xl font-black text-[#0c3a66]">{selected.full_name.slice(0, 1)}</span>
                )}
                <h2 className="mt-3 text-base font-black text-[#172b43]">{selected.full_name}</h2>
              </div>
              <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold leading-6 text-slate-600">
                <dt>کد ملی:</dt><dd>{selected.national_code ?? "ثبت نشده"}</dd>
                <dt>واحد:</dt><dd>{selected.unit?.title ?? "ثبت نشده"}</dd>
                <dt>کلاس:</dt><dd>{selected.class_room?.title ?? "ثبت نشده"}</dd>
                <dt>ولی:</dt><dd>{selected.guardian?.full_name ?? "ثبت نشده"}</dd>
                <dt>همراه ولی:</dt><dd dir="ltr" className="text-right">{selected.guardian?.phone ?? "ثبت نشده"}</dd>
                <dt>ثبت‌نام:</dt><dd>{formatDate(selected.enrolled_at)}</dd>
                <dt>به‌روزرسانی:</dt><dd>{formatDate(selected.updated_at)}</dd>
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setModal("edit")} className="panel-secondary-button"><PanelIcon name="edit" className="size-4" />ویرایش</button>
                {selected.guardian?.phone ? (
                  <a href={`tel:${selected.guardian.phone}`} className="panel-secondary-button"><PanelIcon name="mail" className="size-4" />ارتباط با ولی</a>
                ) : (
                  <button disabled type="button" className="panel-secondary-button opacity-50"><PanelIcon name="mail" className="size-4" />شماره ثبت نشده</button>
                )}
              </div>
            </>
          ) : <PanelEmpty title="دانش‌آموزی انتخاب نشده است." />}
        </aside>

        <section className="panel-card min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.6fr)_minmax(9rem,.7fr)_auto]">
            <label className="panel-search">
              <PanelIcon name="search" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="نام، کد ملی یا شماره دانش‌آموزی..." />
            </label>
            <select value={profileStatus} onChange={(event) => { setProfileStatus(event.target.value); setPage(1); }} className="panel-select" aria-label="وضعیت پرونده">
              <option value="">همه وضعیت‌ها</option>
              <option value="complete">پرونده کامل</option>
              <option value="incomplete">پرونده ناقص</option>
            </select>
            <button type="button" onClick={() => { setSearch(""); setProfileStatus(""); }} className="panel-secondary-button">
              <PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها
            </button>
          </div>

          {students.length ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="panel-table min-w-[48rem]">
                  <thead><tr><th>نام و نام خانوادگی</th><th>کد ملی</th><th>کلاس</th><th>وضعیت پرونده</th><th>تاریخ ثبت‌نام</th></tr></thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} onClick={() => setSelectedId(student.id)} className={String(student.id) === String(effectiveSelectedId) ? "is-selected" : ""}>
                        <td className="font-black text-[#172b43]">{student.full_name}</td>
                        <td>{student.national_code ?? "—"}</td><td>{student.class_room?.title ?? "—"}</td>
                        <td><span className={`panel-status ${student.profile_status === "complete" ? "is-success" : "is-warning"}`}>{student.profile_status === "complete" ? "تکمیل‌شده" : "ناقص"}</span></td>
                        <td>{formatDate(student.enrolled_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
                <span>صفحه {page} — مجموع {data?.page.count ?? 0} مورد</span>
                <div className="flex gap-2">
                  <button disabled={!data?.page.previous} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button" className="panel-secondary-button">صفحه قبل</button>
                  <button disabled={!data?.page.next} onClick={() => setPage((value) => value + 1)} type="button" className="panel-secondary-button">صفحه بعد</button>
                </div>
              </footer>
            </>
          ) : <PanelEmpty title="دانش‌آموزی با این فیلترها پیدا نشد." />}
        </section>
      </section>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === "edit" ? "ویرایش دانش‌آموز" : "ثبت دانش‌آموز جدید"} size="lg">
        <StudentForm student={modal === "edit" ? selected : null} unitId={unitId} saving={saving} onSubmit={saveStudent} onCancel={() => setModal(null)} />
      </Modal>
    </div>
  );
}
