"use client";

import { createPortal } from "react-dom";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextArea,
  TextInput,
} from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { toDateTimeLocalValue } from "@/lib/date/jalali";
import { panelService } from "@/services/panel-service";
import type { ApiFieldErrors } from "@/lib/api/client";
import type { CalendarEventItem, NamedOption } from "@/types/panel-api";

type EventFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (event: CalendarEventItem) => void;
  event: CalendarEventItem | null;
  isGeneralManager: boolean;
  fixedUnitId: string | null;
  units: NamedOption[];
  defaultStart?: string;
};

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "draft", label: "پیش‌نویس" },
  { value: "waiting_review", label: "در انتظار بررسی" },
  { value: "approved", label: "تأیید شده" },
  { value: "rejected", label: "رد شده" },
  { value: "archived", label: "آرشیو شده" },
];

type FieldName =
  | "title"
  | "scope"
  | "unit"
  | "location"
  | "event_start_at"
  | "event_end_at"
  | "summary"
  | "description"
  | "registration_url"
  | "status";

type FieldErrors = Partial<Record<FieldName, string>>;

function fieldErrorsFrom(errors: ApiFieldErrors): FieldErrors {
  const next: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (messages?.[0]) next[field as FieldName] = messages[0];
  }
  return next;
}

export function EventFormModal({
  open,
  onClose,
  onSaved,
  event,
  isGeneralManager,
  fixedUnitId,
  units,
  defaultStart,
}: EventFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const [scope, setScope] = useState<"school" | "unit">("school");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const isEdit = event !== null;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setScope(event ? event.scope : isGeneralManager ? "school" : "unit");
      setErrors({});
      setFormError("");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, event, isGeneralManager]);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button',
      );
      firstField?.focus();
    });

    function onKeyDown(nativeEvent: KeyboardEvent) {
      if (nativeEvent.key === "Escape") {
        nativeEvent.stopPropagation();
        onClose();
        return;
      }

      if (nativeEvent.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (nativeEvent.shiftKey && document.activeElement === first) {
        nativeEvent.preventDefault();
        last.focus();
      } else if (!nativeEvent.shiftKey && document.activeElement === last) {
        nativeEvent.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = previousOverflow;
      (previousActiveElement.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const eventStartAt = String(form.get("event_start_at") ?? "");
    const eventEndAt = String(form.get("event_end_at") ?? "");
    const effectiveScope = isGeneralManager ? scope : "unit";
    const unitValue = isGeneralManager
      ? effectiveScope === "unit"
        ? String(form.get("unit") ?? "") || null
        : null
      : fixedUnitId;

    const nextErrors: FieldErrors = {};
    if (!title) nextErrors.title = "عنوان رویداد الزامی است.";
    if (!eventStartAt) nextErrors.event_start_at = "زمان شروع رویداد الزامی است.";
    if (eventStartAt && eventEndAt && new Date(eventEndAt) <= new Date(eventStartAt)) {
      nextErrors.event_end_at = "زمان پایان رویداد باید بعد از زمان شروع باشد.";
    }
    if (effectiveScope === "unit" && !unitValue) {
      nextErrors.unit = "برای رویداد واحدی، انتخاب واحد الزامی است.";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      location: String(form.get("location") ?? "") || null,
      event_start_at: eventStartAt,
      event_end_at: eventEndAt || null,
      summary: String(form.get("summary") ?? "") || null,
      description: String(form.get("description") ?? "") || null,
      registration_url: String(form.get("registration_url") ?? "") || null,
      is_featured: form.get("is_featured") === "on",
      scope: effectiveScope,
      unit: unitValue,
    };

    if (isGeneralManager) {
      payload.status = String(form.get("status") ?? "draft");
    }

    setSaving(true);
    setErrors({});
    setFormError("");
    try {
      const saved = isEdit
        ? await panelService.updateCalendarEvent(event.id, payload)
        : await panelService.createCalendarEvent(payload);
      onSaved(saved);
    } catch (reason) {
      if (reason instanceof ApiError) {
        setErrors(fieldErrorsFrom(reason.fieldErrors));
      }
      setFormError(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const titleId = "event-form-modal-title";

  return createPortal(
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <h2 id={titleId} className="text-xl font-black text-[#062452]">
            {isEdit ? "ویرایش رویداد" : "ثبت رویداد جدید"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="panel-icon-button bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <PanelIcon name="close" className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6">
          {formError ? (
            <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="عنوان رویداد" required className="md:col-span-2">
              <TextInput
                name="title"
                required
                defaultValue={event?.title ?? ""}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "event-title-error" : undefined}
              />
              {errors.title ? <p id="event-title-error" className="mt-2 text-sm font-bold text-rose-700">{errors.title}</p> : null}
            </Field>

            <Field label="زمان شروع" required>
              <TextInput
                type="datetime-local"
                name="event_start_at"
                required
                defaultValue={event ? toDateTimeLocalValue(event.event_start_at) : defaultStart ?? ""}
                aria-invalid={Boolean(errors.event_start_at)}
                aria-describedby={errors.event_start_at ? "event-start-error" : undefined}
              />
              {errors.event_start_at ? <p id="event-start-error" className="mt-2 text-sm font-bold text-rose-700">{errors.event_start_at}</p> : null}
            </Field>

            <Field label="زمان پایان">
              <TextInput
                type="datetime-local"
                name="event_end_at"
                defaultValue={toDateTimeLocalValue(event?.event_end_at ?? null)}
                aria-invalid={Boolean(errors.event_end_at)}
                aria-describedby={errors.event_end_at ? "event-end-error" : undefined}
              />
              {errors.event_end_at ? <p id="event-end-error" className="mt-2 text-sm font-bold text-rose-700">{errors.event_end_at}</p> : null}
            </Field>

            <Field label="محل برگزاری">
              <TextInput name="location" defaultValue={event?.location ?? ""} />
            </Field>

            <Field label="لینک ثبت‌نام یا اطلاعات بیشتر">
              <TextInput
                dir="ltr"
                name="registration_url"
                defaultValue={event?.registration_url ?? ""}
                className="text-left"
              />
            </Field>

            {isGeneralManager ? (
              <Field label="دامنه انتشار">
                <Select
                  name="scope"
                  value={scope}
                  onChange={(changeEvent) => setScope(changeEvent.target.value as "school" | "unit")}
                >
                  <option value="school">کل مجموعه</option>
                  <option value="unit">واحد مشخص</option>
                </Select>
              </Field>
            ) : null}

            {isGeneralManager && scope === "unit" ? (
              <Field label="واحد آموزشی" required>
                <Select
                  name="unit"
                  required
                  defaultValue={event?.unit_id ? String(event.unit_id) : ""}
                  aria-invalid={Boolean(errors.unit)}
                  aria-describedby={errors.unit ? "event-unit-error" : undefined}
                >
                  <option value="">انتخاب واحد</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.title}
                    </option>
                  ))}
                </Select>
                {errors.unit ? <p id="event-unit-error" className="mt-2 text-sm font-bold text-rose-700">{errors.unit}</p> : null}
              </Field>
            ) : null}

            {isGeneralManager ? (
              <Field label="وضعیت">
                <Select name="status" defaultValue={event?.status ?? "draft"}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="خلاصه" className="md:col-span-2">
              <TextArea name="summary" rows={3} defaultValue={event?.summary ?? ""} />
            </Field>

            <Field label="توضیحات" className="md:col-span-2">
              <TextArea name="description" rows={5} defaultValue={event?.description ?? ""} />
            </Field>

            <label className="flex cursor-pointer items-center gap-3 text-sm font-black text-[#172b43] md:col-span-2">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={event?.is_featured ?? false}
                className="size-4 accent-[#d98a12]"
              />
              رویداد ویژه
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <GhostButton type="button" onClick={onClose}>
              انصراف
            </GhostButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ثبت رویداد"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
