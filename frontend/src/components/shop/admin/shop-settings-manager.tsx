"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { CrudSection, Field, PrimaryButton, TextInput } from "@/components/crud/crud-ui";
import { PanelError } from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { cmsGetSettings, cmsUpdateSettings } from "@/services/shop-cms-service";

function isNonNegativeInteger(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 0;
}

export function ShopSettingsManager() {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetSettings(), []);
  const [reservationMinutes, setReservationMinutes] = useState<number | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // FE-SHOP-ADMIN-SETTINGS-DOUBLE-SUBMIT-001: `submitting` is state-backed,
  // so two same-tick submits both read it as `false` before either update
  // commits -- a synchronous ref guard closes that race.
  const submittingRef = useRef(false);

  // FE-PANEL-SHOP-SETTINGS-NUMERIC-VALIDATION-001: both fields are backend
  // PositiveIntegerFields (min 0) but had no client-side bound, so an
  // out-of-range value (e.g. -1) round-tripped to a rejected PATCH with the
  // input left showing the invalid value and focus dropped to <body>.
  const [reservationError, setReservationError] = useState("");
  const [lowStockError, setLowStockError] = useState("");
  const reservationRef = useRef<HTMLInputElement>(null);
  const lowStockRef = useRef<HTMLInputElement>(null);
  const reservationErrorId = useId();
  const lowStockErrorId = useId();

  if (data && !hydrated) {
    setReservationMinutes(data.reservation_hold_minutes);
    setLowStockThreshold(data.low_stock_default_threshold);
    setHydrated(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setReservationError("");
    setLowStockError("");

    if (!isNonNegativeInteger(reservationMinutes)) {
      setReservationError("مدت زمان رزرو باید عددی صحیح و صفر یا بزرگ‌تر باشد.");
      reservationRef.current?.focus();
      return;
    }
    if (!isNonNegativeInteger(lowStockThreshold)) {
      setLowStockError("آستانه موجودی کم باید عددی صحیح و صفر یا بزرگ‌تر باشد.");
      lowStockRef.current?.focus();
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    setSaved(false);
    try {
      await cmsUpdateSettings({
        reservation_hold_minutes: reservationMinutes ?? undefined,
        low_stock_default_threshold: lowStockThreshold ?? undefined,
      });
      setSaved(true);
      reload();
    } catch (reason) {
      setSaveError(getApiErrorMessage(reason));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <CrudSection title="تنظیمات فروشگاه" description="تنظیمات عملیاتی فروشگاه">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error || !data ? (
        // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: see shop-categories-manager.tsx
        // -- identical no-retry defect, same shared PanelError fix. `!data`
        // with no error string can't happen in practice (usePanelRequest
        // always sets error on a failed load), but the fallback message
        // keeps this branch's type correct without assuming that.
        <PanelError message={error ?? "دریافت تنظیمات ناموفق بود."} onRetry={reload} />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="grid max-w-lg gap-5">
          <Field label="مدت زمان رزرو موجودی هنگام تسویه حساب (دقیقه)">
            <TextInput
              ref={reservationRef}
              type="number"
              min={0}
              step={1}
              value={reservationMinutes ?? ""}
              onChange={(event) => {
                setReservationMinutes(Number(event.target.value));
                setReservationError("");
              }}
              aria-invalid={Boolean(reservationError)}
              aria-describedby={reservationError ? reservationErrorId : undefined}
            />
            {reservationError ? (
              <p id={reservationErrorId} role="alert" className="mt-1.5 text-xs font-bold text-rose-600">
                {reservationError}
              </p>
            ) : null}
          </Field>
          <Field label="آستانه پیش‌فرض موجودی کم">
            <TextInput
              ref={lowStockRef}
              type="number"
              min={0}
              step={1}
              value={lowStockThreshold ?? ""}
              onChange={(event) => {
                setLowStockThreshold(Number(event.target.value));
                setLowStockError("");
              }}
              aria-invalid={Boolean(lowStockError)}
              aria-describedby={lowStockError ? lowStockErrorId : undefined}
            />
            {lowStockError ? (
              <p id={lowStockErrorId} role="alert" className="mt-1.5 text-xs font-bold text-rose-600">
                {lowStockError}
              </p>
            ) : null}
          </Field>

          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-700">
            درگاه پرداخت فعلی «آزمایشی» است. تا انتخاب درگاه پرداخت واقعی، این وضعیت تغییر نمی‌کند.
          </p>

          {saveError ? <p role="alert" className="text-sm font-black text-rose-600">{saveError}</p> : null}
          {saved ? <p role="status" className="text-sm font-black text-emerald-600">تنظیمات ذخیره شد.</p> : null}

          <PrimaryButton type="submit" disabled={submitting} className="w-fit">
            {submitting ? "در حال ذخیره…" : "ذخیره تنظیمات"}
          </PrimaryButton>
        </form>
      )}
    </CrudSection>
  );
}
