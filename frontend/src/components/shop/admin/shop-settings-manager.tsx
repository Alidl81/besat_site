"use client";

import { type FormEvent, useState } from "react";
import { CrudSection, Field, PrimaryButton, TextInput } from "@/components/crud/crud-ui";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { cmsGetSettings, cmsUpdateSettings } from "@/services/shop-cms-service";

export function ShopSettingsManager() {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetSettings(), []);
  const [reservationMinutes, setReservationMinutes] = useState<number | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  if (data && !hydrated) {
    setReservationMinutes(data.reservation_hold_minutes);
    setLowStockThreshold(data.low_stock_default_threshold);
    setHydrated(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
    }
  }

  return (
    <CrudSection title="تنظیمات فروشگاه" description="تنظیمات عملیاتی فروشگاه">
      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error || !data ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid max-w-lg gap-5">
          <Field label="مدت زمان رزرو موجودی هنگام تسویه حساب (دقیقه)">
            <TextInput
              type="number"
              value={reservationMinutes ?? ""}
              onChange={(event) => setReservationMinutes(Number(event.target.value))}
            />
          </Field>
          <Field label="آستانه پیش‌فرض موجودی کم">
            <TextInput
              type="number"
              value={lowStockThreshold ?? ""}
              onChange={(event) => setLowStockThreshold(Number(event.target.value))}
            />
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
