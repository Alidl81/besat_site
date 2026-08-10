"use client";

import { CheckCircle2, Send } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { submitContactMessage } from "@/services/public-content-service";
import type {
  ContactMessagePayload,
  PublicSchoolUnit,
} from "@/types/public-content";

type FieldName =
  | "full_name"
  | "phone"
  | "email"
  | "related_unit"
  | "message_type"
  | "subject"
  | "message";

type FieldErrors = Partial<Record<FieldName, string>>;

const messageTypes = [
  ["general", "ارتباط عمومی"],
  ["criticism", "انتقاد"],
  ["suggestion", "پیشنهاد"],
  ["complaint", "شکایت"],
  ["feedback", "بازخورد"],
] as const;

const fieldLabels: Record<FieldName, string> = {
  full_name: "نام و نام خانوادگی",
  phone: "شماره تماس",
  email: "ایمیل",
  related_unit: "واحد مرتبط",
  message_type: "نوع پیام",
  subject: "موضوع",
  message: "متن پیام",
};

const inputClass =
  "min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none transition focus:border-[#b97827] focus:ring-4 focus:ring-amber-100 motion-reduce:transition-none";

export function validateContactMessage(
  payload: ContactMessagePayload,
  units: PublicSchoolUnit[],
) {
  const nextErrors: FieldErrors = {};

  if (payload.full_name.trim().length < 2) {
    nextErrors.full_name = "نام و نام خانوادگی را کامل وارد کنید.";
  }
  if (!payload.phone?.trim() && !payload.email?.trim()) {
    nextErrors.phone = "حداقل شماره تماس یا ایمیل را وارد کنید.";
    nextErrors.email = "حداقل شماره تماس یا ایمیل را وارد کنید.";
  }
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    nextErrors.email = "نشانی ایمیل معتبر نیست.";
  }
  if (payload.message.trim().length < 10) {
    nextErrors.message = "متن پیام باید حداقل ۱۰ کاراکتر باشد.";
  }
  if (
    payload.related_unit &&
    !units.some((unit) => String(unit.id) === String(payload.related_unit))
  ) {
    nextErrors.related_unit = "واحد آموزشی انتخاب‌شده معتبر نیست.";
  }

  return nextErrors;
}

function FieldError({
  field,
  errors,
}: {
  field: FieldName;
  errors: FieldErrors;
}) {
  return errors[field] ? (
    <p id={`${field}-error`} className="mt-2 text-sm font-bold text-rose-700">
      {errors[field]}
    </p>
  ) : null;
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError && reason.status === 429) {
    return "تعداد ارسال پیام از حد مجاز بیشتر شده است. لطفاً کمی بعد دوباره تلاش کنید.";
  }

  return getApiErrorMessage(reason);
}

export function ContactForm({
  units,
  selectedUnitId,
}: {
  units: PublicSchoolUnit[];
  selectedUnitId?: string;
}) {
  const [state, setState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [relatedUnitId, setRelatedUnitId] = useState(() =>
    selectedUnitId && units.some((unit) => String(unit.id) === selectedUnitId)
      ? selectedUnitId
      : "",
  );
  const pendingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function payloadFromForm(form: HTMLFormElement): ContactMessagePayload {
    const formData = new FormData(form);

    return {
      full_name: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      related_unit: relatedUnitId || null,
      message_type: String(
        formData.get("message_type") ?? "general",
      ) as ContactMessagePayload["message_type"],
      subject: String(formData.get("subject") ?? "").trim() || undefined,
      message: String(formData.get("message") ?? "").trim(),
    };
  }

  function focusFirstError(nextErrors: FieldErrors) {
    const first = Object.keys(nextErrors)[0] as FieldName | undefined;

    if (!first) {
      return;
    }

    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
    });
  }

  function validateFields(fields: FieldName[]) {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const nextErrors = validateContactMessage(payloadFromForm(form), units);

    setErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => {
        if (nextErrors[field]) {
          next[field] = nextErrors[field];
        } else {
          delete next[field];
        }
      });
      return next;
    });
  }

  function clearFieldErrors(fields: FieldName[]) {
    setErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });

    if (state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingRef.current) {
      return;
    }

    const form = event.currentTarget;
    const payload = payloadFromForm(form);
    const nextErrors = validateContactMessage(payload, units);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setState("error");
      setMessage("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      focusFirstError(nextErrors);
      return;
    }

    pendingRef.current = true;
    setState("submitting");
    setMessage("");

    try {
      const response = await submitContactMessage(payload);

      setState("success");
      setMessage(response.message || "پیام شما ثبت شد.");
      setErrors({});
      form.reset();
      setRelatedUnitId("");
    } catch (reason) {
      const serverErrors: FieldErrors = {};

      if (reason instanceof ApiError) {
        for (const field of Object.keys(reason.fieldErrors) as FieldName[]) {
          if (field in payload) {
            serverErrors[field] = reason.fieldErrors[field]?.[0];
          }
        }
      }

      setErrors(serverErrors);
      setState("error");
      setMessage(errorMessage(reason));
      focusFirstError(serverErrors);
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <section
      aria-labelledby="contact-form-title"
      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,35,57,0.08)]"
    >
      <div className="border-b border-slate-200 bg-[#f8fafc] p-6 sm:p-8">
        <p className="text-sm font-black text-[#b97827]">بازخورد و پیگیری</p>
        <h2 id="contact-form-title" className="mt-2 text-2xl font-black text-[#0f2f4a]">
          ارسال پیام
        </h2>
        <p className="mt-2 max-w-prose text-sm font-bold leading-7 text-slate-600">
          پیام پس از ثبت برای پیگیری در اختیار مجموعه قرار می‌گیرد. برای دریافت پاسخ، شماره تماس یا ایمیل خود را وارد کنید.
        </p>
      </div>

      {state === "success" ? (
        <div className="p-6 text-center sm:p-8" role="status" aria-live="polite">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-11 text-emerald-700" />
          <h3 className="mt-4 text-xl font-black text-emerald-900">پیام ثبت شد</h3>
          <p className="mt-2 text-sm font-bold leading-7 text-emerald-800">{message}</p>
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setMessage("");
              setErrors({});
            }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
          >
            ارسال پیام دیگر
          </button>
        </div>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          aria-busy={state === "submitting"}
          className="grid gap-5 p-6 sm:p-8 md:grid-cols-2"
        >
          {state === "error" && message ? (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-black text-rose-800 md:col-span-2"
            >
              <p>{message}</p>
              {Object.keys(errors).length ? (
                <ul className="mt-3 list-inside list-disc space-y-1 text-right font-bold">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field}>
                      <a
                        href={`#${field}`}
                        className="underline decoration-rose-400 underline-offset-4"
                      >
                        {fieldLabels[field as FieldName]}: {error}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
              نام و نام خانوادگی <span aria-hidden="true" className="text-rose-700">*</span>
            </span>
            <input
              id="full_name"
              name="full_name"
              autoComplete="name"
              required
              onBlur={() => validateFields(["full_name"])}
              onInput={() => clearFieldErrors(["full_name"])}
              aria-invalid={Boolean(errors.full_name)}
              aria-describedby={errors.full_name ? "full_name-error" : undefined}
              className={inputClass}
            />
            <FieldError field="full_name" errors={errors} />
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">واحد مرتبط</span>
            <select
              id="related_unit"
              name="related_unit"
              value={relatedUnitId}
              onChange={(event) => {
                setRelatedUnitId(event.target.value);
                clearFieldErrors(["related_unit"]);
              }}
              onBlur={() => validateFields(["related_unit"])}
              aria-invalid={Boolean(errors.related_unit)}
              aria-describedby={errors.related_unit ? "related_unit-error" : undefined}
              className={inputClass}
            >
              <option value="">ارتباط با مجموعه</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title}
                </option>
              ))}
            </select>
            <FieldError field="related_unit" errors={errors} />
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">شماره تماس</span>
            <input
              id="phone"
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              onBlur={() => validateFields(["phone", "email"])}
              onInput={() => clearFieldErrors(["phone", "email"])}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={
                errors.phone ? "phone-error contact-method-help" : "contact-method-help"
              }
              className={`${inputClass} text-left`}
            />
            <FieldError field="phone" errors={errors} />
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">ایمیل</span>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              onBlur={() => validateFields(["phone", "email"])}
              onInput={() => clearFieldErrors(["phone", "email"])}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? "email-error contact-method-help" : "contact-method-help"
              }
              className={`${inputClass} text-left`}
            />
            <FieldError field="email" errors={errors} />
          </label>

          <p id="contact-method-help" className="text-xs font-bold leading-6 text-slate-500 md:col-span-2">
            واردکردن حداقل یکی از شماره تماس یا ایمیل الزامی است.
          </p>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">نوع پیام</span>
            <select
              id="message_type"
              name="message_type"
              defaultValue="general"
              className={inputClass}
            >
              {messageTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">موضوع</span>
            <input
              id="subject"
              name="subject"
              maxLength={255}
              className={inputClass}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
              متن پیام <span aria-hidden="true" className="text-rose-700">*</span>
            </span>
            <textarea
              id="message"
              name="message"
              required
              minLength={10}
              rows={6}
              onBlur={() => validateFields(["message"])}
              onInput={() => clearFieldErrors(["message"])}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : "message-help"}
              className="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold leading-7 text-[#0f2f4a] outline-none transition focus:border-[#b97827] focus:ring-4 focus:ring-amber-100 motion-reduce:transition-none"
            />
            <p id="message-help" className="mt-2 text-xs font-bold text-slate-500">
              حداقل ۱۰ کاراکتر وارد کنید.
            </p>
            <FieldError field="message" errors={errors} />
          </label>

          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-6 text-slate-600 md:col-span-2">
            اطلاعات این فرم فقط برای رسیدگی به پیام شما استفاده می‌شود. از ارسال اطلاعات حساس یا مدارک در متن پیام خودداری کنید.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            <span className="text-xs font-bold text-slate-500">
              فیلدهای دارای ستاره الزامی هستند.
            </span>
            <button
              type="submit"
              disabled={state === "submitting"}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#12395b] px-7 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <Send aria-hidden="true" className="size-4" />
              {state === "submitting" ? "در حال ارسال" : "ارسال پیام"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
