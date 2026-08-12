"use client";

import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Address } from "@/types/shop";

export type AddressFormValues = Omit<Address, "id" | "created_at">;

const EMPTY_VALUES: AddressFormValues = {
  recipient_full_name: "",
  phone: "",
  province: "",
  city: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  is_default: false,
};

export function AddressForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "ذخیره آدرس",
}: {
  initialValues?: Partial<AddressFormValues>;
  onSubmit: (values: AddressFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<AddressFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" dir="rtl">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">نام گیرنده</span>
          <input
            required
            value={values.recipient_full_name}
            onChange={(event) => update("recipient_full_name", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">شماره تماس</span>
          <input
            required
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-right text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">استان</span>
          <input
            required
            value={values.province}
            onChange={(event) => update("province", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">شهر</span>
          <input
            required
            value={values.city}
            onChange={(event) => update("city", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">آدرس</span>
        <input
          required
          value={values.address_line1}
          onChange={(event) => update("address_line1", event.target.value)}
          className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">آدرس تکمیلی (اختیاری)</span>
          <input
            value={values.address_line2 ?? ""}
            onChange={(event) => update("address_line2", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">کد پستی (اختیاری)</span>
          <input
            inputMode="numeric"
            dir="ltr"
            value={values.postal_code ?? ""}
            onChange={(event) => update("postal_code", event.target.value)}
            className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-right text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-[#0a2848]">
        <input
          type="checkbox"
          checked={values.is_default}
          onChange={(event) => update("is_default", event.target.checked)}
          className="size-4 rounded border-[#e5e7eb]"
        />
        این آدرس، آدرس پیش‌فرض من باشد
      </label>

      {error ? (
        <p role="alert" className="text-sm font-bold text-rose-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="besat-navy-button rounded-xl px-6 py-2.5 text-sm font-black disabled:opacity-60"
        >
          {submitting ? "در حال ذخیره…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#e5e7eb] px-5 py-2.5 text-sm font-black text-[#0a2848]"
          >
            انصراف
          </button>
        ) : null}
      </div>
    </form>
  );
}
