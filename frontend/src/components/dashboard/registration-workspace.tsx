"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PanelIcon, type PanelIconName } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type {
  RegistrationItem,
  RegistrationStatus,
} from "@/types/panel-api";

type RegistrationWorkspaceProps = { unitId?: string | null };

const statusMeta: Record<RegistrationStatus, { label: string; className: string }> = {
  new: { label: "درخواست جدید", className: "is-info" },
  reviewing: { label: "در انتظار بررسی", className: "is-warning" },
  needs_documents: { label: "نیاز به تکمیل مدارک", className: "is-warning" },
  accepted: { label: "تأییدشده", className: "is-success" },
  rejected: { label: "ردشده", className: "is-danger" },
};

const documentStatus = {
  pending: { label: "در حال بررسی", className: "text-amber-600", icon: "calendar" as const },
  approved: { label: "تأییدشده", className: "text-emerald-600", icon: "check" as const },
  rejected: { label: "ردشده", className: "text-rose-600", icon: "warning" as const },
  missing: { label: "بارگذاری نشده", className: "text-amber-600", icon: "warning" as const },
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export function RegistrationWorkspace({
  unitId = null,
}: RegistrationWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [detail, setDetail] = useState<RegistrationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [noteAction, setNoteAction] = useState<
    "reject" | "request-documents" | null
  >(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = {
    search: debouncedSearch,
    status,
    grade,
    unit: unitId,
    page,
  };
  const { data, loading, error, reload } = usePanelRequest(
    () => panelService.registrations(params),
    [debouncedSearch, status, grade, unitId, page],
  );
  const items = useMemo(() => data?.page.results ?? [], [data]);
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
        if (active) setDetailLoading(true);
        return panelService.registration(effectiveSelectedId);
      })
      .then((result) => {
        if (active) {
          setDetail(result);
          setActionError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setActionError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveSelectedId]);

  async function runAction(
    action: "approve" | "reject" | "request-documents" | "contact",
    note?: string,
  ): Promise<boolean> {
    if (!detail) return false;
    let payload: Record<string, unknown> = {};
    if (action === "reject" || action === "request-documents") {
      if (note === undefined) {
        setNoteText("");
        setNoteAction(action);
        return false;
      }
      if (!note.trim()) {
        setActionError(
          action === "reject"
            ? "ثبت دلیل رد درخواست الزامی است."
            : "شرح مدارک موردنیاز یا توضیحات را وارد کنید.",
        );
        return false;
      }
      payload = { admin_note: note.trim() };
    }
    setWorking(true);
    setActionError(null);
    try {
      const updated = await panelService.registrationAction(detail.id, action, payload);
      setDetail(updated);
      reload();
      return true;
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
      return false;
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) return <PanelLoading label="در حال دریافت درخواست‌های ثبت‌نام..." />;
  if (error && !data) return <PanelError message={error} onRetry={reload} />;

  const summary = data?.summary;
  const activeDetail =
    detail && String(detail.id) === String(effectiveSelectedId) ? detail : null;
  const summaryCards: Array<[string, number, PanelIconName, string]> = summary
    ? [
        ["کل درخواست‌ها", summary.total, "students", "bg-[#eef4fb] text-[#1760a9]"],
        ["در انتظار بررسی", summary.reviewing, "calendar", "bg-[#fff5e7] text-[#d17d0d]"],
        ["تأییدشده", summary.accepted, "check", "bg-[#edf8ef] text-[#248749]"],
        ["ردشده", summary.rejected, "trash", "bg-[#fff0f0] text-[#c63e3e]"],
        ["نیاز به تکمیل مدارک", summary.needs_documents, "document", "bg-[#eef4fb] text-[#1760a9]"],
      ]
    : [];

  return (
    <div className="space-y-5">
      {actionError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p> : null}
      {noteAction ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !working) setNoteAction(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-note-title"
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              const action = noteAction;
              void runAction(action, noteText).then((completed) => {
                if (completed) setNoteAction(null);
              });
            }}
          >
            <h2 id="registration-note-title" className="text-base font-black text-[#173652]">
              {noteAction === "reject" ? "دلیل رد درخواست" : "درخواست تکمیل مدارک"}
            </h2>
            <label className="mt-4 block text-xs font-black text-slate-600">
              <span>{noteAction === "reject" ? "دلیل" : "مدارک موردنیاز یا توضیحات"}</span>
              <textarea
                autoFocus
                required
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                className="panel-input mt-2 min-h-28 w-full resize-y"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={working} onClick={() => setNoteAction(null)} className="panel-secondary-button">انصراف</button>
              <button disabled={working} type="submit" className="panel-primary-button">{working ? "در حال ثبت..." : "ثبت"}</button>
            </div>
          </form>
        </div>
      ) : null}
      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(([title, value, icon, tone]) => (
            <article key={title} className="panel-card">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black text-slate-600">{title}</p><p className="mt-3 text-3xl font-black text-[#101828]">{value}</p></div>
                <span className={`flex size-10 items-center justify-center rounded-full ${tone}`}><PanelIcon name={icon} className="size-5" /></span>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="panel-split-layout grid gap-5 2xl:grid-cols-[29rem_minmax(0,1fr)]">
        <aside className="panel-card h-fit 2xl:sticky 2xl:top-28">
          {detailLoading ? <PanelLoading label="در حال دریافت جزئیات..." /> : activeDetail ? (
            <>
              <header className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-black text-[#183a5b]">جزئیات درخواست</h2>
                <span className={`panel-status ${statusMeta[activeDetail.status].className}`}>{statusMeta[activeDetail.status].label}</span>
              </header>
              <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                {activeDetail.student_avatar_url ? (
                  <Image src={activeDetail.student_avatar_url} alt="" width={80} height={80} className="size-20 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-20 items-center justify-center rounded-xl bg-[#eaf0f5] text-2xl font-black text-[#0c3a66]">{activeDetail.student_full_name.slice(0, 1)}</span>
                )}
                <div>
                  <h3 className="text-lg font-black text-[#172b43]">{activeDetail.student_full_name}</h3>
                  <p className="mt-2 text-xs font-bold text-slate-500">کد درخواست: {activeDetail.request_code}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">کد ملی: {activeDetail.student_national_code ?? "ثبت نشده"}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">پایه: {activeDetail.requested_grade?.title ?? "ثبت نشده"}</p>
                </div>
              </div>
              <div className="space-y-5 py-5 text-xs font-bold text-slate-600">
                <div>
                  <h4 className="panel-divider-title">اطلاعات والدین</h4>
                  <dl className="mt-3 grid grid-cols-[5rem_1fr] gap-y-2 leading-6">
                    <dt>نام:</dt><dd>{activeDetail.parent.full_name}</dd>
                    <dt>همراه:</dt><dd>{activeDetail.parent.phone ?? "ثبت نشده"}</dd>
                    <dt>ایمیل:</dt><dd className="truncate" dir="ltr">{activeDetail.parent.email ?? "ثبت نشده"}</dd>
                  </dl>
                </div>
                <div>
                  <h4 className="panel-divider-title">مدارک و مستندات</h4>
                  {activeDetail.documents.length ? (
                    <ul className="mt-3 space-y-2">
                      {activeDetail.documents.map((document) => {
                        const meta = documentStatus[document.status];
                        return (
                          <li key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                            {document.file_url ? <a href={document.file_url} target="_blank" rel="noreferrer" className="truncate hover:text-[#0b599b]">{document.title}</a> : <span>{document.title}</span>}
                            <span className={`flex shrink-0 items-center gap-1 ${meta.className}`}><PanelIcon name={meta.icon} className="size-3.5" />{meta.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <PanelEmpty title="مدرکی بارگذاری نشده است." />}
                </div>
                <div>
                  <h4 className="panel-divider-title">تاریخچه وضعیت</h4>
                  {activeDetail.timeline.length ? (
                    <ol className="mt-3 space-y-3 border-r border-slate-200 pr-4">
                      {activeDetail.timeline.map((item) => (
                        <li key={item.id}><b className="text-[#173652]">{item.title}</b><span className="mt-1 block text-[10px] text-slate-400">{formatDate(item.created_at)}{item.actor_name ? ` · ${item.actor_name}` : ""}</span></li>
                      ))}
                    </ol>
                  ) : <PanelEmpty title="تاریخچه‌ای ثبت نشده است." />}
                </div>
              </div>
              <footer className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <button disabled={working} type="button" onClick={() => void runAction("contact")} className="panel-secondary-button"><PanelIcon name="mail" className="size-4" />تماس با والدین</button>
                <button disabled={working} type="button" onClick={() => void runAction("request-documents")} className="panel-secondary-button"><PanelIcon name="document" className="size-4" />درخواست تکمیل مدارک</button>
                <button disabled={working} type="button" onClick={() => void runAction("reject")} className="panel-secondary-button !border-rose-300 !text-rose-600"><PanelIcon name="trash" className="size-4" />رد درخواست</button>
                <button disabled={working} type="button" onClick={() => void runAction("approve")} className="panel-primary-button !border-emerald-600 !bg-emerald-600"><PanelIcon name="check" className="size-4" />تأیید درخواست</button>
              </footer>
            </>
          ) : <PanelEmpty title="درخواستی را انتخاب کنید." />}
        </aside>

        <section className="panel-card min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.5fr)_repeat(2,minmax(9rem,.7fr))_auto]">
            <label className="panel-search"><PanelIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="نام دانش‌آموز یا کد درخواست..." /></label>
            <input value={grade} onChange={(event) => { setGrade(event.target.value); setPage(1); }} className="panel-input" placeholder="شناسه پایه" aria-label="فیلتر پایه" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="panel-select" aria-label="فیلتر وضعیت">
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
            <button type="button" onClick={() => { setSearch(""); setGrade(""); setStatus(""); }} className="panel-secondary-button"><PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها</button>
          </div>

          {items.length ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="panel-table min-w-[58rem]">
                  <thead><tr><th>وضعیت</th><th>کد درخواست</th><th>نام دانش‌آموز</th><th>پایه درخواستی</th><th>واحد درخواستی</th><th>تاریخ ثبت‌نام</th><th>آخرین به‌روزرسانی</th></tr></thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={String(effectiveSelectedId) === String(item.id) ? "is-selected" : ""}>
                        <td><span className={`panel-status ${statusMeta[item.status].className}`}>{statusMeta[item.status].label}</span></td>
                        <td>{item.request_code}</td><td className="font-black text-[#172b43]">{item.student_full_name}</td>
                        <td>{item.requested_grade?.title ?? "—"}</td><td>{item.requested_unit?.title ?? "—"}</td>
                        <td>{formatDate(item.created_at)}</td><td>{formatDate(item.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
                <span>صفحه {page} — مجموع {data?.page.count ?? 0} مورد</span>
                <div className="flex gap-2"><button disabled={!data?.page.previous} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button" className="panel-secondary-button">صفحه قبل</button><button disabled={!data?.page.next} onClick={() => setPage((value) => value + 1)} type="button" className="panel-secondary-button">صفحه بعد</button></div>
              </footer>
            </>
          ) : <PanelEmpty title="درخواستی با این فیلترها پیدا نشد." />}
        </section>
      </section>
    </div>
  );
}
