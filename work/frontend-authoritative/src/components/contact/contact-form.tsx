"use client";

import { Send } from "lucide-react";
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

export function ContactForm({ units }: { units: PublicSchoolUnit[] }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const pendingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function focusFirstError(nextErrors: FieldErrors) {
    const first = Object.keys(nextErrors)[0];
    if (!first) return;
    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const unitValue = String(formData.get("related_unit") ?? "");
    const payload: ContactMessagePayload = {
      full_name: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      related_unit: unitValue || null,
      message_type: String(
        formData.get("message_type") ?? "general",
      ) as ContactMessagePayload["message_type"],
      subject: String(formData.get("subject") ?? "").trim() || undefined,
      message: String(formData.get("message") ?? "").trim(),
    };
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
      setMessage(response.message || "پیام شما با موفقیت ثبت شد.");
      setErrors({});
      form.reset();
    } catch (reason) {
      const serverErrors: FieldErrors = {};
      if (reason instanceof ApiError) {
        for (const field of Object.keys(reason.fieldErrors) as FieldName[]) {
          if (field in payload || field === "related_unit") {
            serverErrors[field] = reason.fieldErrors[field]?.[0];
          }
        }
      }
      setErrors(serverErrors);
      setState("error");
      setMessage(getApiErrorMessage(reason));
      focusFirstError(serverErrors);
    } finally {
      pendingRef.current = false;
    }
  }

  const inputClass =
    "h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-[#0f2f4a] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-6 sm:p-8">
        <h2 className="text-2xl font-black text-[#0f2f4a]">ارسال پیام</h2>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
          پاسخ از طریق شماره تماس یا ایمیل واردشده پیگیری می‌شود.
        </p>
      </div>

      <form ref={formRef} noValidate onSubmit={handleSubmit} className="grid gap-5 p-6 sm:p-8 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
            نام و نام خانوادگی <span aria-hidden="true" className="text-rose-700">*</span>
          </span>
          <input
            name="full_name"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            className={inputClass}
          />
          <FieldError field="full_name" errors={errors} />
        </label>

        <label>
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">واحد مرتبط</span>
          <select
            name="related_unit"
            aria-invalid={Boolean(errors.related_unit)}
            aria-describedby={errors.related_unit ? "related_unit-error" : undefined}
            className={inputClass}
          >
            <option value="">ارتباط با مجتمع</option>
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
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : "contact-method-help"}
            className={`${inputClass} text-left`}
          />
          <FieldError field="phone" errors={errors} />
        </label>

        <label>
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">ایمیل</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            dir="ltr"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "contact-method-help"}
            className={`${inputClass} text-left`}
          />
          <FieldError field="email" errors={errors} />
        </label>
        <p id="contact-method-help" className="text-xs font-bold text-slate-500 md:col-span-2">
          واردکردن حداقل یکی از شماره تماس یا ایمیل الزامی است.
        </p>

        <label>
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">نوع پیام</span>
          <select name="message_type" className={inputClass} defaultValue="general">
            {messageTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">موضوع</span>
          <input name="subject" maxLength={255} className={inputClass} />
        </label>

        <label className="md:col-span-2">
          <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
            متن پیام <span aria-hidden="true" className="text-rose-700">*</span>
          </span>
          <textarea
            name="message"
            required
            minLength={10}
            rows={6}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "message-error" : undefined}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold leading-7 text-[#0f2f4a] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
          <FieldError field="message" errors={errors} />
        </label>

        {message ? (
          <div
            role={state === "error" ? "alert" : "status"}
            aria-live={state === "error" ? "assertive" : "polite"}
            className={`rounded-lg px-4 py-4 text-sm font-black md:col-span-2 ${
              state === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="flex justify-end md:col-span-2">
          <button
            type="submit"
            disabled={state === "submitting"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#12395b] px-7 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send aria-hidden="true" className="size-4" />
            {state === "submitting" ? "در حال ارسال" : "ارسال پیام"}
          </button>
        </div>
      </form>
    </section>
  );
}
