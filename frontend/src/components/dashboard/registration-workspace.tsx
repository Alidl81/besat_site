"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PanelIcon, type PanelIconName } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { handleSelectableRowKeyDown } from "@/lib/dashboard/selectable-table-row";
import { panelService } from "@/services/panel-service";
import type {
  RegistrationItem,
  RegistrationStatus,
} from "@/types/panel-api";

type RegistrationWorkspaceProps = { unitId?: string | null };

// FE-REGISTRATION-CONTRACT-001: RegistrationRequest.Status
// (backend/apps/registration/models.py) has two members this map
// previously had no entry for -- "contacted" and "archived" -- so any
// request in either status crashed this component (`statusMeta[status]`
// was `undefined`, then `.label`/`.className` threw).
const statusMeta: Record<RegistrationStatus, { label: string; className: string }> = {
  new: { label: "درخواست جدید", className: "is-info" },
  reviewing: { label: "در انتظار بررسی", className: "is-warning" },
  needs_documents: { label: "نیاز به تکمیل مدارک", className: "is-warning" },
  contacted: { label: "تماس گرفته‌شده", className: "is-info" },
  accepted: { label: "تأییدشده", className: "is-success" },
  rejected: { label: "ردشده", className: "is-danger" },
  archived: { label: "آرشیوشده", className: "is-warning" },
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
  const [noteError, setNoteError] = useState("");
  // FE-PANEL-REGISTRATION-ACTION-ERROR-RETRY-001 (P2 residual): the in-dialog
  // alert and focus already made a failed mutation visible, but the submit
  // button still read the generic "ثبت" -- a manager had to infer that
  // resubmitting the same, still-open form was the retry action. This
  // switches the button's own label to the codebase's established
  // "تلاش دوباره" wording specifically after a mutation failure (not after a
  // blank-note validation error, which is a distinct, not-yet-attempted
  // state), giving an explicit, named retry affordance without introducing
  // a second control or changing the single-flight submit handler itself.
  const [noteMutationFailed, setNoteMutationFailed] = useState(false);
  const noteDialogRef = useRef<HTMLFormElement>(null);
  const noteTextRef = useRef<HTMLTextAreaElement>(null);
  const noteErrorId = useId();
  // FE-REGISTRATION-NOTE-DOUBLE-SUBMIT-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={working}`
  // only takes effect after React re-renders, so two submits/clicks
  // dispatched before that render (the note form, or the direct approve/
  // contact buttons) both reach runAction's actual mutation call.
  const workingRef = useRef(false);

  // FE-REGISTRATION-NOTE-MODAL-A11Y-001: this dialog rendered role="dialog"
  // but had no focus trap, body scroll lock, Escape handling, or opener-
  // focus restoration at all -- only a backdrop mousedown and a Cancel
  // button could close it, and the background page could still scroll
  // behind it. useFocusTrap provides all four in one call, matching every
  // other modal in this codebase. Declining to close while `working` is
  // true (a submission is in flight) matches the existing Cancel button's
  // and backdrop-click handler's own `!working` guard.
  useFocusTrap(noteDialogRef, noteAction !== null, () => {
    if (!working) setNoteAction(null);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // FE-REGISTRATION-CONTRACT-001: CMSRegistrationRequestViewSet.get_queryset()
  // (backend/apps/registration/views.py) only ever reads `status` and
  // `unit_id` from the query string -- there is no dedicated grade filter, so
  // a previous `grade` param here was silently ignored server-side. Grade text
  // is already covered by the free-text `search` param instead (`requested_grade`
  // is in the view's `search_fields`), so there's no separate grade filter to
  // send at all; `unit` was also the wrong key -- the view reads `unit_id`.
  const params = {
    search: debouncedSearch,
    status,
    unit_id: unitId,
    page,
  };
  const { data, loading, error, reload } = usePanelRequest(
    () => panelService.registrations(params),
    [debouncedSearch, status, unitId, page],
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
        setNoteError("");
        setNoteMutationFailed(false);
        setNoteAction(action);
        return false;
      }
      if (!note.trim()) {
        // FE-PANEL-REGISTRATION-NOTE-VALIDATION-I18N-001: this Persian
        // message never had anywhere to render inside the dialog itself
        // (the dialog is a fixed full-viewport overlay, so the exterior
        // actionError banner rendered behind it, invisible) -- and with
        // the textarea's plain `required` + no `noValidate` on the form,
        // the browser's own native English constraint-validation tooltip
        // intercepted the submit before this handler even ran.
        const message =
          action === "reject"
            ? "ثبت دلیل رد درخواست الزامی است."
            : "شرح مدارک موردنیاز یا توضیحات را وارد کنید.";
        setNoteError(message);
        setActionError(message);
        setNoteMutationFailed(false);
        noteTextRef.current?.focus();
        return false;
      }
      setNoteError("");
      payload = { admin_note: note.trim() };
    }
    if (workingRef.current) return false;
    workingRef.current = true;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await panelService.registrationAction(detail.id, action, payload);
      setDetail(updated);
      reload();
      return true;
    } catch (reason) {
      const message = getApiErrorMessage(reason);
      setActionError(message);
      // FE-PANEL-REGISTRATION-ACTION-ERROR-RETRY-001: reject/request-documents
      // mutations only ever fire from inside the open note dialog (the
      // direct buttons for these actions just open it), so a failure here
      // must also surface where the dialog itself can be seen -- mirroring
      // it into the same in-dialog `noteError` role="alert" this dialog
      // already renders for the blank-note case (which also clears on edit
      // and gets focused), instead of only the exterior banner hidden
      // behind the dialog's own `fixed inset-0 z-[90]` overlay.
      if (action === "reject" || action === "request-documents") {
        setNoteError(message);
        setNoteMutationFailed(true);
        noteTextRef.current?.focus();
      }
      return false;
    } finally {
      setWorking(false);
      workingRef.current = false;
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
      {/* FE-PANEL-REGISTRATION-ACTION-ERROR-RETRY-001: while the note dialog
          is open, its failure is already surfaced via the in-dialog
          `noteError` alert -- rendering this exterior banner too would add
          a second, visually-hidden role="alert" with the same text,
          risking a duplicate screen-reader announcement. */}
      {actionError && !noteAction ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p> : null}
      {noteAction ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !working) setNoteAction(null);
          }}
        >
          <form
            ref={noteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-note-title"
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl"
            noValidate
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
                ref={noteTextRef}
                autoFocus
                required
                aria-invalid={Boolean(noteError)}
                aria-describedby={noteError ? noteErrorId : undefined}
                value={noteText}
                onChange={(event) => {
                  setNoteText(event.target.value);
                  setNoteError("");
                  setNoteMutationFailed(false);
                }}
                className="panel-input mt-2 min-h-28 w-full resize-y"
              />
            </label>
            {noteError ? (
              <p id={noteErrorId} role="alert" className="mt-1.5 text-xs font-bold text-rose-600">
                {noteError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={working} onClick={() => setNoteAction(null)} className="panel-secondary-button">انصراف</button>
              <button disabled={working} type="submit" className="panel-primary-button">{working ? "در حال ثبت..." : noteMutationFailed ? "تلاش دوباره" : "ثبت"}</button>
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
                <span className="flex size-20 items-center justify-center rounded-xl bg-[#eaf0f5] text-2xl font-black text-[#0c3a66]">{activeDetail.student_full_name.slice(0, 1)}</span>
                <div>
                  <h3 className="text-lg font-black text-[#172b43]">{activeDetail.student_full_name}</h3>
                  <p className="mt-2 text-xs font-bold text-slate-500">پایه: {activeDetail.requested_grade ?? "ثبت نشده"}</p>
                </div>
              </div>
              <div className="space-y-5 py-5 text-xs font-bold text-slate-600">
                <div>
                  <h4 className="panel-divider-title">اطلاعات والدین</h4>
                  <dl className="mt-3 grid grid-cols-[5rem_1fr] gap-y-2 leading-6">
                    <dt>نام:</dt><dd>{activeDetail.parent_full_name ?? "ثبت نشده"}</dd>
                    <dt>همراه:</dt><dd>{activeDetail.parent_phone}</dd>
                    <dt>ایمیل:</dt><dd className="truncate" dir="ltr">{activeDetail.parent_email ?? "ثبت نشده"}</dd>
                  </dl>
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
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.5fr)_minmax(9rem,.7fr)_auto]">
            {/* FE-REGISTRATION-CONTRACT-001: a separate grade filter used to
                sit here sending a `grade` param the backend never reads;
                grade text is already covered by this search box, since
                `requested_grade` is one of the backend's search_fields. */}
            <label className="panel-search"><PanelIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="نام دانش‌آموز، والد، یا پایه..." /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="panel-select" aria-label="فیلتر وضعیت">
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
            <button type="button" onClick={() => { setSearch(""); setStatus(""); }} className="panel-secondary-button"><PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها</button>
          </div>

          {items.length ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="panel-table min-w-[58rem]">
                  <thead><tr><th>وضعیت</th><th>نام دانش‌آموز</th><th>پایه درخواستی</th><th>واحد درخواستی</th><th>تاریخ ثبت‌نام</th><th>آخرین به‌روزرسانی</th></tr></thead>
                  <tbody>
                    {items.map((item) => {
                      const isSelected = String(effectiveSelectedId) === String(item.id);
                      return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        onKeyDown={(event) => handleSelectableRowKeyDown(event, () => setSelectedId(item.id))}
                        tabIndex={0}
                        aria-selected={isSelected}
                        className={isSelected ? "is-selected" : ""}
                      >
                        <td><span className={`panel-status ${statusMeta[item.status].className}`}>{statusMeta[item.status].label}</span></td>
                        <td className="font-black text-[#172b43]">{item.student_full_name}</td>
                        <td>{item.requested_grade ?? "—"}</td><td>{item.requested_unit?.title ?? "—"}</td>
                        <td>{formatDate(item.created_at)}</td><td>{formatDate(item.updated_at)}</td>
                      </tr>
                      );
                    })}
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
