"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { EventFormModal } from "@/components/dashboard/event-form-modal";
import { ConfirmDialog, StatusBadge } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { readBesatSession } from "@/lib/auth/auth-session";
import {
  JALALI_WEEKDAY_NAMES,
  addJalaaliMonths,
  buildJalaaliMonthGrid,
  formatClockTime,
  formatJalaaliLong,
  jalaaliKey,
  jalaaliKeyFromIso,
  jalaaliMonthLabel,
  jalaaliMonthLength,
  jalaaliToDateTimeLocalValue,
  todayJalaali,
  toPersianDigits,
  type CalendarDayCell,
} from "@/lib/date/jalali";
import { panelService } from "@/services/panel-service";
import type { CalendarEventItem } from "@/types/panel-api";
import type { ApiId } from "@/types/api";
import type { QueryValue } from "@/lib/api/query";

type EventAction = "submit-review" | "approve" | "reject" | "publish" | "archive" | "restore";

const ACTION_LABELS: Record<EventAction, string> = {
  "submit-review": "ارسال برای بررسی",
  approve: "تأیید",
  reject: "رد",
  publish: "انتشار",
  archive: "آرشیو",
  restore: "بازگردانی",
};

const ACTION_SUCCESS_MESSAGES: Record<EventAction, string> = {
  "submit-review": "رویداد برای بررسی ارسال شد.",
  approve: "رویداد تأیید شد.",
  reject: "رویداد رد شد.",
  publish: "رویداد منتشر شد.",
  archive: "رویداد آرشیو شد.",
  restore: "رویداد بازگردانی شد.",
};

function availableActions(
  event: CalendarEventItem,
  isGeneralManager: boolean,
  isUnitManagerRole: boolean,
  fixedUnitId: string | null,
): EventAction[] {
  const hasUnitAccess =
    isGeneralManager ||
    (event.scope === "unit" &&
      event.unit_id != null &&
      fixedUnitId != null &&
      String(event.unit_id) === fixedUnitId);
  const canModerate = isGeneralManager || (isUnitManagerRole && hasUnitAccess);
  const actions: EventAction[] = [];

  if ((event.status === "draft" || event.status === "rejected") && hasUnitAccess) {
    actions.push("submit-review");
  }
  if (event.status === "waiting_review" && canModerate) {
    actions.push("approve", "reject");
  }
  if (event.status === "approved") {
    if (isGeneralManager) actions.push("publish");
    if (canModerate) actions.push("reject");
  }
  if (event.status === "archived") {
    if (canModerate) actions.push("restore");
  } else if (canModerate) {
    actions.push("archive");
  }

  return actions;
}

function canEditEvent(event: CalendarEventItem, isGeneralManager: boolean, fixedUnitId: string | null) {
  if (isGeneralManager) return true;
  return (
    event.scope === "unit" &&
    event.unit_id != null &&
    fixedUnitId != null &&
    String(event.unit_id) === fixedUnitId
  );
}

function formatFieldErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && Object.keys(reason.fieldErrors).length) {
    return Object.values(reason.fieldErrors).flat().join(" ");
  }
  return getApiErrorMessage(reason);
}

async function fetchAllCalendarEvents(params: Record<string, QueryValue>) {
  const results: CalendarEventItem[] = [];
  let page = 1;

  // Follow pagination defensively so a busy month never silently drops events.
  for (let guard = 0; guard < 50; guard += 1) {
    const response = await panelService.calendarEvents({ ...params, page, page_size: 100 });
    results.push(...response.results);
    if (!response.next) break;
    page += 1;
  }

  return results;
}

function EventAgendaRow({
  event,
  isGeneralManager,
  isUnitManagerRole,
  fixedUnitId,
  onEdit,
  onDelete,
  onAction,
}: {
  event: CalendarEventItem;
  isGeneralManager: boolean;
  isUnitManagerRole: boolean;
  fixedUnitId: string | null;
  onEdit: (event: CalendarEventItem) => void;
  onDelete: (event: CalendarEventItem) => void;
  onAction: (event: CalendarEventItem, action: EventAction) => void;
}) {
  const canEdit = canEditEvent(event, isGeneralManager, fixedUnitId);
  const actions = availableActions(event, isGeneralManager, isUnitManagerRole, fixedUnitId);
  // Publishing requires summary + description server-side
  // (apps/events/models.py's clean(), only enforced at the published
  // transition -- draft/review/approved stages intentionally allow
  // saving without them). Disabling the button here instead of letting
  // the click 400 surfaces the real prerequisite up front.
  const missingPublishFields = !event.summary || !event.description;
  const publishHintId = useId();

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#fff4e3] text-[#a8660b]">
          <PanelIcon name="calendar" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-[#172b43]">{event.title}</h3>
            <StatusBadge status={event.status} />
            {event.is_featured ? <span className="panel-status is-warning">ویژه</span> : null}
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {[event.location, event.unit?.title ?? (event.scope === "school" ? "کل مجموعه" : null)]
              .filter(Boolean)
              .join(" · ") || "بدون مکان"}
          </p>
        </div>
        <time className="shrink-0 text-[11px] font-bold text-slate-500" dir="ltr">
          {formatClockTime(event.event_start_at)}
          {event.event_end_at ? ` – ${formatClockTime(event.event_end_at)}` : ""}
        </time>
      </div>

      {canEdit ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(event)} className="panel-text-link">
              <PanelIcon name="edit" className="ml-1 inline size-3.5" />
              ویرایش
            </button>
            <button type="button" onClick={() => onDelete(event)} className="panel-text-link !text-rose-600 hover:!text-rose-700">
              <PanelIcon name="trash" className="ml-1 inline size-3.5" />
              حذف
            </button>
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={action === "publish" && missingPublishFields}
                onClick={() => onAction(event, action)}
                aria-describedby={action === "publish" && missingPublishFields ? publishHintId : undefined}
                className={`panel-text-link disabled:cursor-not-allowed disabled:opacity-50 ${action === "reject" ? "!text-rose-600 hover:!text-rose-700" : ""}`}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
          {actions.includes("publish") && missingPublishFields ? (
            // A disabled button's own title/aria-describedby is invisible to
            // touch and keyboard users -- browsers exclude disabled elements
            // from the tab order entirely, so there's no way to focus or
            // hover it to reveal a tooltip. This has to be a persistently
            // visible line instead, not a hover-only hint.
            <p id={publishHintId} role="alert" className="mt-2 text-xs font-bold text-amber-700">
              برای انتشار، افزودن خلاصه و توضیحات الزامی است — از دکمهٔ «ویرایش» بالا استفاده کنید.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function EventsCalendar() {
  const session = readBesatSession();
  const role = session?.role;
  const isGeneralManager = role === "general_manager";
  const isUnitManagerRole = role === "unit_manager";
  const isUnitScoped = role === "unit_manager" || role === "unit_media";
  const fixedUnitId = isUnitScoped ? session?.unitId ?? null : null;

  const today = useMemo(() => todayJalaali(), []);
  const [viewJy, setViewJy] = useState(today.jy);
  const [viewJm, setViewJm] = useState(today.jm);
  const [selectedKey, setSelectedKey] = useState(jalaaliKey(today.jy, today.jm, today.jd));
  const [agendaMode, setAgendaMode] = useState<"day" | "month">("day");
  const [unitFilter, setUnitFilter] = useState("all");
  const [modalState, setModalState] = useState<{ open: boolean; event: CalendarEventItem | null }>({
    open: false,
    event: null,
  });
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CalendarEventItem | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingMonthFocus = useRef(false);
  const deletingEventIdsRef = useRef<Set<ApiId>>(new Set());
  const actingEventIdsRef = useRef<Set<ApiId>>(new Set());

  const cells = useMemo(() => buildJalaaliMonthGrid(viewJy, viewJm), [viewJy, viewJm]);
  const weeks = useMemo(() => {
    const chunks: CalendarDayCell[][] = [];
    for (let index = 0; index < cells.length; index += 7) chunks.push(cells.slice(index, index + 7));
    return chunks;
  }, [cells]);

  const contextRequest = usePanelRequest(
    () => (isGeneralManager ? panelService.context({}) : Promise.resolve(null)),
    [isGeneralManager],
  );
  const units = contextRequest.data?.units ?? [];

  const eventsRequest = usePanelRequest(() => {
    const params: Record<string, QueryValue> = {
      date_from: cells[0].isoDate,
      date_to: cells[cells.length - 1].isoDate,
      ordering: "event_start_at",
    };
    if (isGeneralManager && unitFilter === "school") params.scope = "school";
    if (isGeneralManager && unitFilter.startsWith("unit:")) params.unit_id = unitFilter.slice(5);
    return fetchAllCalendarEvents(params);
  }, [viewJy, viewJm, unitFilter, isGeneralManager]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of eventsRequest.data ?? []) {
      const key = jalaaliKeyFromIso(event.event_start_at);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(event);
    }
    return map;
  }, [eventsRequest.data]);

  // REOPEN history on this exact interaction (FE-A11Y-EVENTS-DAY-FOCUS-001,
  // 4 rounds): selecting an inactive day changes viewJy/viewJm, which
  // re-keys eventsRequest and swaps the ENTIRE grid (every day button, not
  // just the changed ones) for a <PanelLoading> skeleton while it
  // refetches, then remounts a brand-new button for the same key once the
  // fetch resolves. Three different attempts to restore focus onto that
  // *recreated* button all failed specifically for Enter (letting Enter
  // fall through to native activation; guarding the restore effect on
  // eventsRequest.loading; defensively re-asserting focus across multiple
  // animation frames) even after confirming Enter and Space run through
  // byte-identical code -- Codex's own conclusion was that this is a
  // Chrome-internal behavior around Enter-activation on an element being
  // replaced, not something interceptable from outside, and that the fix
  // needs to target a stable element instead of fighting to refocus a
  // node that's being torn down and rebuilt.
  //
  // This redesigns the target rather than the retry mechanism: the
  // month/year heading below (h2, tabIndex=-1) is rendered in the
  // calendar's <header>, entirely OUTSIDE the loading-gated grid section,
  // so it is never unmounted by the eventsRequest loading swap regardless
  // of which key or pointer path triggered the month change. Whenever
  // selecting an inactive day moves the visible month, focus goes there
  // instead of trying to land back on the specific (recreated) day
  // button -- trading exact-cell focus retention for a target that is
  // structurally guaranteed to still exist by the time this effect runs.
  useEffect(() => {
    if (!pendingMonthFocus.current) return;
    pendingMonthFocus.current = false;
    monthHeadingRef.current?.focus();
  }, [viewJy, viewJm]);

  const selectedCell = useMemo(
    () => cells.find((cell) => cell.key === selectedKey) ?? cells.find((cell) => cell.isToday) ?? cells[0],
    [cells, selectedKey],
  );

  const tabbableKey = selectedCell.key;

  function goToMonth(delta: number) {
    const next = addJalaaliMonths(viewJy, viewJm, delta);
    setViewJy(next.jy);
    setViewJm(next.jm);
  }

  function goToToday() {
    setViewJy(today.jy);
    setViewJm(today.jm);
    setSelectedKey(jalaaliKey(today.jy, today.jm, today.jd));
  }

  function selectCell(cell: CalendarDayCell) {
    setSelectedKey(cell.key);
    if (!cell.isCurrentMonth) {
      pendingMonthFocus.current = true;
      setViewJy(cell.jy);
      setViewJm(cell.jm);
    }
  }

  function handleGridKeyDown(keyboardEvent: KeyboardEvent<HTMLButtonElement>, index: number) {
    const key = keyboardEvent.key;

    // REOPEN history on this exact interaction (FE-A11Y-EVENTS-DAY-FOCUS-001):
    // a first attempt removed Enter from manual interception, betting the
    // defect was in how Enter was handled here -- fresh evidence showed
    // that made no difference (still lost focus) and additionally surfaced
    // a transient full-grid loading-state replacement during Enter. The
    // real mechanism was elsewhere: selecting an inactive day changes the
    // viewed month, which re-keys eventsRequest and swaps the ENTIRE grid
    // for a <PanelLoading> skeleton while it refetches -- the focus-
    // restoration effect below now accounts for that (see its own
    // comment). Restored Enter to the same manual-interception branch as
    // Space, since the original difference wasn't the real cause.
    if (key === "Enter" || key === " ") {
      keyboardEvent.preventDefault();
      selectCell(cells[index]);
      return;
    }

    if (key === "PageUp" || key === "PageDown") {
      keyboardEvent.preventDefault();
      const delta = key === "PageUp" ? -1 : 1;
      const next = addJalaaliMonths(viewJy, viewJm, delta);
      const clampedDay = Math.min(selectedCell.jd, jalaaliMonthLength(next.jy, next.jm));
      const nextKey = jalaaliKey(next.jy, next.jm, clampedDay);
      pendingMonthFocus.current = true;
      setSelectedKey(nextKey);
      setViewJy(next.jy);
      setViewJm(next.jm);
      return;
    }

    let nextIndex: number | null = null;
    // RTL grid: physical right = previous DOM sibling.
    if (key === "ArrowRight") nextIndex = index - 1;
    else if (key === "ArrowLeft") nextIndex = index + 1;
    else if (key === "ArrowUp") nextIndex = index - 7;
    else if (key === "ArrowDown") nextIndex = index + 7;
    else if (key === "Home") nextIndex = index - (index % 7);
    else if (key === "End") nextIndex = index - (index % 7) + 6;

    if (nextIndex === null || nextIndex < 0 || nextIndex >= cells.length) return;

    keyboardEvent.preventDefault();
    const nextCell = cells[nextIndex];
    setSelectedKey(nextCell.key);
    gridRef.current?.querySelector<HTMLElement>(`[data-key="${nextCell.key}"]`)?.focus();
  }

  function openCreateModal() {
    setModalState({ open: true, event: null });
  }

  function openEditModal(event: CalendarEventItem) {
    setModalState({ open: true, event });
  }

  function handleSaved() {
    setModalState({ open: false, event: null });
    setActionMessage(modalState.event ? "رویداد ذخیره شد." : "رویداد ثبت شد.");
    setActionError("");
    eventsRequest.reload();
  }

  async function handleDelete(event: CalendarEventItem) {
    // FE-DASH-EVENT-DELETE-DOUBLE-SUBMIT-001: two same-tick confirmations
    // on the shared ConfirmDialog both reached removeCalendarEvent since
    // this had no synchronous in-flight guard. A Set keyed by event id
    // (not one boolean) so a delete in flight for one event doesn't block
    // a delete/action on a different event.
    if (deletingEventIdsRef.current.has(event.id)) return;
    deletingEventIdsRef.current.add(event.id);
    setPendingDelete(null);
    setActionError("");
    setActionMessage("");
    try {
      await panelService.removeCalendarEvent(event.id);
      setActionMessage("رویداد حذف شد.");
      eventsRequest.setData((current) => current?.filter((item) => item.id !== event.id) ?? current);
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      deletingEventIdsRef.current.delete(event.id);
    }
  }

  async function handleAction(event: CalendarEventItem, action: EventAction) {
    // FE-DASH-EVENT-ACTION-DOUBLE-SUBMIT-001: same rationale as
    // handleDelete's guard above -- a Set keyed by event id.
    if (actingEventIdsRef.current.has(event.id)) return;
    actingEventIdsRef.current.add(event.id);
    setActionError("");
    setActionMessage("");
    try {
      const updated = await panelService.calendarEventAction(event.id, action);
      setActionMessage(ACTION_SUCCESS_MESSAGES[action]);
      eventsRequest.setData(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? current,
      );
    } catch (reason) {
      setActionError(formatFieldErrorMessage(reason));
    } finally {
      actingEventIdsRef.current.delete(event.id);
    }
  }

  const dayEvents = eventsByDay.get(selectedKey) ?? [];
  const monthEvents = eventsRequest.data ?? [];
  const agendaEvents = agendaMode === "day" ? dayEvents : monthEvents;

  return (
    <div className="space-y-5">
      {actionError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
          {actionMessage}
        </p>
      ) : null}

      <section className="panel-card">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={goToToday} className="panel-secondary-button">
              امروز
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                aria-label="ماه قبل"
                className="panel-icon-button border border-slate-200"
              >
                <PanelIcon name="chevron" className="size-4" />
              </button>
              <h2
                ref={monthHeadingRef}
                tabIndex={-1}
                className="min-w-[9rem] text-center text-base font-black text-[#172b43] outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {jalaaliMonthLabel(viewJy, viewJm)}
              </h2>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                aria-label="ماه بعد"
                className="panel-icon-button border border-slate-200"
              >
                <PanelIcon name="chevron" className="size-4 rotate-180" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isGeneralManager ? (
              <select
                aria-label="دامنه نمایش رویدادها"
                value={unitFilter}
                onChange={(changeEvent) => setUnitFilter(changeEvent.target.value)}
                className="panel-select !w-auto"
              >
                <option value="all">همه رویدادها</option>
                <option value="school">رویدادهای عمومی مجموعه</option>
                {units.map((unit) => (
                  <option key={unit.id} value={`unit:${unit.id}`}>
                    {unit.title}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={openCreateModal} className="panel-primary-button">
              <PanelIcon name="plus" className="size-4" />
              رویداد جدید
            </button>
          </div>
        </header>

        {eventsRequest.loading ? (
          <PanelLoading label="در حال دریافت رویدادها..." />
        ) : eventsRequest.error ? (
          <PanelError message={eventsRequest.error} onRetry={eventsRequest.reload} />
        ) : (
          <>
            <div
              role="grid"
              aria-label={`تقویم ${jalaaliMonthLabel(viewJy, viewJm)}`}
              ref={gridRef}
              className="overflow-hidden rounded-lg border border-slate-200"
            >
              <div role="row" className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {JALALI_WEEKDAY_NAMES.map((name) => (
                  <div
                    key={name}
                    role="columnheader"
                    className="p-2 text-center text-[11px] font-black text-slate-500"
                  >
                    {name}
                  </div>
                ))}
              </div>

              <div>
                {weeks.map((week, weekIndex) => (
                  <div key={week[0].key} role="row" className="grid grid-cols-7">
                    {week.map((cell, dayIndex) => {
                      const index = weekIndex * 7 + dayIndex;
                      const dayEventsForCell = eventsByDay.get(cell.key) ?? [];
                      const isSelected = cell.key === selectedKey;
                      const isTabbable = cell.key === tabbableKey;
                      const dayLabel = formatJalaaliLong(cell.jy, cell.jm, cell.jd);
                      const eventLabel = dayEventsForCell.length
                        ? `، ${toPersianDigits(dayEventsForCell.length)} رویداد`
                        : "، بدون رویداد";

                      return (
                        <div key={cell.key} role="gridcell" aria-selected={isSelected}>
                          <button
                            type="button"
                            data-key={cell.key}
                            tabIndex={isTabbable ? 0 : -1}
                            aria-label={`${dayLabel}${eventLabel}${cell.isToday ? "، امروز" : ""}`}
                            aria-current={cell.isToday ? "date" : undefined}
                            onClick={() => selectCell(cell)}
                            onKeyDown={(keyboardEvent) => handleGridKeyDown(keyboardEvent, index)}
                            className={`flex h-20 w-full flex-col items-center justify-start gap-1.5 border-b border-l border-slate-100 p-1.5 text-center transition last:border-l-0 hover:bg-[#fff8ec] focus-visible:relative focus-visible:z-10 sm:h-24 ${
                              !cell.isCurrentMonth ? "bg-slate-50/70 text-slate-500" : "text-[#172b43]"
                            } ${isSelected ? "!bg-[#fdecc8]" : ""}`}
                          >
                            <span
                              className={`flex size-6 items-center justify-center rounded-full text-xs font-black ${
                                cell.isToday ? "bg-[#12395b] text-white" : ""
                              }`}
                            >
                              {toPersianDigits(cell.jd)}
                            </span>
                            {dayEventsForCell.length ? (
                              <span aria-hidden="true" className="flex flex-wrap items-center justify-center gap-0.5">
                                {dayEventsForCell.slice(0, 3).map((event) => (
                                  <span key={event.id} className="size-1.5 rounded-full bg-[#d98a12]" />
                                ))}
                                {dayEventsForCell.length > 3 ? (
                                  <span className="text-[9px] font-black text-[#a8660b]">
                                    +{toPersianDigits(dayEventsForCell.length - 3)}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#172b43]">
                  {agendaMode === "day" ? `رویدادهای ${formatJalaaliLong(selectedCell.jy, selectedCell.jm, selectedCell.jd)}` : `همه رویدادهای ${jalaaliMonthLabel(viewJy, viewJm)}`}
                </h3>
                <div role="group" aria-label="نمای فهرست رویدادها" className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    aria-pressed={agendaMode === "day"}
                    onClick={() => setAgendaMode("day")}
                    className={`rounded-md px-3 py-1.5 text-xs font-black ${agendaMode === "day" ? "bg-[#12395b] text-white" : "text-[#172b43]"}`}
                  >
                    روز انتخاب‌شده
                  </button>
                  <button
                    type="button"
                    aria-pressed={agendaMode === "month"}
                    onClick={() => setAgendaMode("month")}
                    className={`rounded-md px-3 py-1.5 text-xs font-black ${agendaMode === "month" ? "bg-[#12395b] text-white" : "text-[#172b43]"}`}
                  >
                    کل ماه
                  </button>
                </div>
              </div>

              {agendaEvents.length ? (
                <div className="space-y-3">
                  {agendaEvents.map((event) => (
                    <EventAgendaRow
                      key={event.id}
                      event={event}
                      isGeneralManager={isGeneralManager}
                      isUnitManagerRole={isUnitManagerRole}
                      fixedUnitId={fixedUnitId}
                      onEdit={openEditModal}
                      onDelete={setPendingDelete}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              ) : (
                <PanelEmpty
                  title={agendaMode === "day" ? "رویدادی برای این روز ثبت نشده است." : "رویدادی برای این ماه ثبت نشده است."}
                />
              )}
            </div>
          </>
        )}
      </section>

      <EventFormModal
        open={modalState.open}
        onClose={() => setModalState({ open: false, event: null })}
        onSaved={handleSaved}
        event={modalState.event}
        isGeneralManager={isGeneralManager}
        fixedUnitId={fixedUnitId}
        units={units}
        defaultStart={jalaaliToDateTimeLocalValue(selectedCell.jy, selectedCell.jm, selectedCell.jd, 9, 0)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف رویداد"
        description={pendingDelete ? `آیا از حذف رویداد «${pendingDelete.title}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.` : ""}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
