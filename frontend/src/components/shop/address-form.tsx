"use client";

import { type FormEvent, useId, useRef, useState } from "react";
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
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"recipient_full_name" | "phone" | "province" | "city" | "address_line1", string>>
  >({});
  const recipientNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const recipientNameErrorId = useId();
  const phoneErrorId = useId();
  const provinceErrorId = useId();
  const cityErrorId = useId();
  const addressLine1ErrorId = useId();
  // FE-SHOP-ADDRESS-DOUBLE-SUBMIT-001: same fix/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={submitting}`
  // only takes effect after React re-renders, so two submit events
  // dispatched before that render both invoke the supplied `onSubmit`. A
  // synchronously read/written ref blocks the re-entrant call immediately.
  const submittingRef = useRef(false);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAndClearError<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    update(key, value);
    if (key in fieldErrors) {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    setFieldErrors({});

    const nextFieldErrors: typeof fieldErrors = {};
    if (!values.recipient_full_name.trim()) nextFieldErrors.recipient_full_name = "نام گیرنده الزامی است.";
    if (!values.phone.trim()) nextFieldErrors.phone = "شماره تماس الزامی است.";
    if (!values.province.trim()) nextFieldErrors.province = "استان الزامی است.";
    if (!values.city.trim()) nextFieldErrors.city = "شهر الزامی است.";
    if (!values.address_line1.trim()) nextFieldErrors.address_line1 = "آدرس الزامی است.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      const target = (
        nextFieldErrors.recipient_full_name
          ? recipientNameRef
          : nextFieldErrors.phone
            ? phoneRef
            : nextFieldErrors.province
              ? provinceRef
              : nextFieldErrors.city
                ? cityRef
                : addressLine1Ref
      ).current;
      // .focus() alone only scrolls the minimum distance needed to make
      // the element nearest-visible, which isn't reliable across this
      // form's sm:grid-cols-2 layout at every breakpoint (see
      // FE-CONTACT-STICKY-FOCUS-001's round-2 fix in contact-form.tsx for
      // the same shape). An explicit scrollIntoView with block: "center"
      // is deterministic regardless of the field's prior position/column.
      target?.focus();
      target?.scrollIntoView({ block: "center" });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4" dir="rtl">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">نام گیرنده</span>
          <input
            ref={recipientNameRef}
            required
            value={values.recipient_full_name}
            onChange={(event) => updateAndClearError("recipient_full_name", event.target.value)}
            aria-invalid={Boolean(fieldErrors.recipient_full_name)}
            aria-describedby={fieldErrors.recipient_full_name ? recipientNameErrorId : undefined}
            className="besat-focus-scroll-offset w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
          {fieldErrors.recipient_full_name ? (
            <p id={recipientNameErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.recipient_full_name}
            </p>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">شماره تماس</span>
          <input
            ref={phoneRef}
            required
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={values.phone}
            onChange={(event) => updateAndClearError("phone", event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? phoneErrorId : undefined}
            className="besat-focus-scroll-offset w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-right text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
          {fieldErrors.phone ? (
            <p id={phoneErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.phone}
            </p>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">استان</span>
          <input
            ref={provinceRef}
            required
            value={values.province}
            onChange={(event) => updateAndClearError("province", event.target.value)}
            aria-invalid={Boolean(fieldErrors.province)}
            aria-describedby={fieldErrors.province ? provinceErrorId : undefined}
            className="besat-focus-scroll-offset w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
          {fieldErrors.province ? (
            <p id={provinceErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.province}
            </p>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">شهر</span>
          <input
            ref={cityRef}
            required
            value={values.city}
            onChange={(event) => updateAndClearError("city", event.target.value)}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={fieldErrors.city ? cityErrorId : undefined}
            className="besat-focus-scroll-offset w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
          />
          {fieldErrors.city ? (
            <p id={cityErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.city}
            </p>
          ) : null}
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-[#0a2848]/70">آدرس</span>
        <input
          ref={addressLine1Ref}
          required
          value={values.address_line1}
          onChange={(event) => updateAndClearError("address_line1", event.target.value)}
          aria-invalid={Boolean(fieldErrors.address_line1)}
          aria-describedby={fieldErrors.address_line1 ? addressLine1ErrorId : undefined}
          className="besat-focus-scroll-offset w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm font-bold text-[#0a2848] focus:border-[#c98c3d] focus:outline-none focus:ring-4 focus:ring-[#c98c3d]/20"
        />
        {fieldErrors.address_line1 ? (
          <p id={addressLine1ErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
            {fieldErrors.address_line1}
          </p>
        ) : null}
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
