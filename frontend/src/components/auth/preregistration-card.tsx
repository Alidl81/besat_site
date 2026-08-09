"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import {
  getPublicUnits,
  getRegistrationInfo,
} from "@/services/public-content-service";
import { apiRequest } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  PublicSchoolUnit,
  RegistrationInfo,
} from "@/types/public-content";

type Errors = Partial<
  Record<
    | "student_full_name"
    | "parent_full_name"
    | "parent_phone"
    | "parent_email"
    | "requested_unit"
    | "requested_grade"
    | "description"
    | "registration",
    string
  >
>;

export function PreregistrationCard({
  initialUnitSlug,
}: {
  initialUnitSlug?: string;
}) {
  const [units, setUnits] = useState<PublicSchoolUnit[] | null>(null);
  const [registration, setRegistration] = useState<RegistrationInfo | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [version, setVersion] = useState(0);
  const pendingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPublicUnits(), getRegistrationInfo()])
      .then(([allUnits, info]) => {
        if (cancelled) return;
        setLoadError("");
        const available = allUnits.filter((unit) => unit.accepts_registration);
        setUnits(allUnits);
        setRegistration(info);
        const scoped = initialUnitSlug
          ? allUnits.find((unit) => unit.slug === initialUnitSlug)
          : null;
        setSelectedUnitId(
          scoped && scoped.accepts_registration
            ? String(scoped.id)
            : String(available[0]?.id ?? ""),
        );
      })
      .catch((reason) => {
        if (!cancelled) setLoadError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [initialUnitSlug, version]);

  const scopedUnit = useMemo(
    () => units?.find((unit) => unit.slug === initialUnitSlug) ?? null,
    [initialUnitSlug, units],
  );
  const selectedUnit = useMemo(
    () => units?.find((unit) => String(unit.id) === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );
  const lockedToUnit = Boolean(scopedUnit);
  const isOpen =
    Boolean(registration?.is_open) &&
    Boolean(selectedUnit?.accepts_registration);

  function focusFirstError(nextErrors: Errors) {
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
    if (pendingRef.current || !isOpen) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      student_full_name: String(data.get("student_full_name") ?? "").trim(),
      parent_full_name: String(data.get("parent_full_name") ?? "").trim() || null,
      parent_phone: String(data.get("parent_phone") ?? "").trim(),
      parent_email: String(data.get("parent_email") ?? "").trim() || null,
      requested_unit: Number(selectedUnitId),
      requested_grade: String(data.get("requested_grade") ?? "").trim(),
      description: String(data.get("description") ?? "").trim() || null,
    };
    const nextErrors: Errors = {};
    if (payload.student_full_name.length < 2) {
      nextErrors.student_full_name = "نام دانش‌آموز را کامل وارد کنید.";
    }
    if (!payload.parent_phone) {
      nextErrors.parent_phone = "شماره تماس ولی الزامی است.";
    }
    if (!payload.requested_grade) {
      nextErrors.requested_grade = "پایه درخواستی را وارد کنید.";
    }
    if (!selectedUnit || !selectedUnit.accepts_registration) {
      nextErrors.requested_unit = "واحد انتخاب‌شده پیش‌ثبت‌نام فعال ندارد.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setState("error");
      setMessage("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      focusFirstError(nextErrors);
      return;
    }

    pendingRef.current = true;
    setErrors({});
    setMessage("");
    setState("submitting");
    try {
      const response = await apiRequest<{ message: string; id?: number }>(
        apiEndpoints.registrationRequests,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setState("success");
      setMessage(response.message || "درخواست پیش‌ثبت‌نام ثبت شد.");
      form.reset();
    } catch (reason) {
      const serverErrors: Errors = {};
      if (reason instanceof ApiError) {
        for (const [field, values] of Object.entries(reason.fieldErrors)) {
          if (field in payload || field === "registration") {
            serverErrors[field as keyof Errors] = values[0];
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
    "h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-[#0f2f4a] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100";

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-3xl border border-rose-200 bg-white p-8 text-center" role="alert">
        <h1 className="text-2xl font-black text-[#0f2f4a]">دریافت اطلاعات پیش‌ثبت‌نام انجام نشد</h1>
        <p className="mt-3 text-sm font-bold text-rose-700">{loadError}</p>
        <button type="button" onClick={() => {
          setUnits(null);
          setRegistration(null);
          setLoadError("");
          setVersion((value) => value + 1);
        }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white">
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </main>
    );
  }

  if (!units || !registration) {
    return <div role="status" aria-busy="true" aria-live="polite" aria-label="در حال دریافت اطلاعات پیش‌ثبت‌نام" className="mx-auto h-[36rem] w-full max-w-4xl animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />;
  }

  return (
    <div dir="rtl" className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[0.92fr_1.08fr]">
      <header className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-[#062452] p-7 text-white sm:p-10 lg:min-h-[48rem]">
        <div className="absolute -right-16 -top-16 size-52 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <BesatLogoMark size="lg" tone="light" />
          <div>
            <p className="text-sm font-black text-blue-300">مجتمع آموزشی بعثت</p>
            <h1 className="mt-1 text-2xl font-black text-white">
            {registration.title || "پیش‌ثبت‌نام آنلاین"}
            </h1>
          </div>
        </div>
        <div className="relative z-10 mt-8 rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
          <p className="text-sm font-bold leading-8 text-white/75">
            {registration.description || "واحد آموزشی و پایه مورد نظر را انتخاب کنید و اطلاعات دانش‌آموز و ولی را با دقت وارد کنید."}
          </p>
          {registration.open_message ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-xs font-black leading-7 text-blue-200">{registration.open_message}</p>
          ) : null}
        </div>
      </header>

      <div className="p-6 sm:p-8 lg:p-10">
        <div className="mb-7 lg:hidden">
          <p className="text-sm font-black text-blue-700">فرم درخواست</p>
          <h2 className="mt-1 text-xl font-black text-[#0f2f4a]">اطلاعات پیش‌ثبت‌نام</h2>
        </div>

        {!registration.is_open || (lockedToUnit && !scopedUnit?.accepts_registration) ? (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-right">
            <h2 className="text-xl font-black text-amber-900">پیش‌ثبت‌نام در حال حاضر بسته است</h2>
            <p className="mt-3 text-sm font-bold leading-7 text-amber-900">
              {lockedToUnit && !scopedUnit?.accepts_registration
                ? `پیش‌ثبت‌نام ${scopedUnit?.title ?? "این واحد"} فعال نیست.`
                : registration.closed_message || "زمان بعدی پیش‌ثبت‌نام از همین صفحه اعلام می‌شود."}
            </p>
          </div>
        ) : state === "success" ? (
          <div role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-emerald-700" />
            <h2 className="mt-4 text-2xl font-black text-emerald-900">درخواست ثبت شد</h2>
            <p className="mt-3 text-sm font-bold text-emerald-800">{message}</p>
            <button type="button" onClick={() => setState("idle")} className="mt-5 min-h-11 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white">
              ثبت درخواست دیگر
            </button>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            {lockedToUnit ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
                <p className="text-xs font-black text-blue-700">واحد آموزشی</p>
                <p className="mt-1 text-base font-black text-[#0f2f4a]">{scopedUnit?.title}</p>
                <input type="hidden" name="requested_unit" value={selectedUnitId} />
              </div>
            ) : (
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-black text-[#0f2f4a]">واحد آموزشی *</span>
                <select name="requested_unit" value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)} required aria-invalid={Boolean(errors.requested_unit)} aria-describedby={errors.requested_unit ? "requested-unit-error" : undefined} className={inputClass}>
                  <option value="">انتخاب واحد</option>
                  {units.filter((unit) => unit.accepts_registration).map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.title}</option>
                  ))}
                </select>
                {errors.requested_unit ? <p id="requested-unit-error" className="mt-2 text-sm font-bold text-rose-700">{errors.requested_unit}</p> : null}
              </label>
            )}

            {[
              ["student_full_name", "نام و نام خانوادگی دانش‌آموز", "name", true],
              ["parent_full_name", "نام و نام خانوادگی ولی", "name", false],
              ["parent_phone", "شماره تماس ولی", "tel", true],
              ["parent_email", "ایمیل ولی", "email", false],
            ].map(([name, label, type, required]) => (
              <label key={String(name)}>
                <span className="mb-2 block text-sm font-black text-[#0f2f4a]">{label}{required ? " *" : ""}</span>
                <input name={String(name)} type={String(type)} required={Boolean(required)} dir={type === "tel" || type === "email" ? "ltr" : undefined} aria-invalid={Boolean(errors[name as keyof Errors])} aria-describedby={errors[name as keyof Errors] ? `${name}-error` : undefined} className={`${inputClass} ${type === "tel" || type === "email" ? "text-left" : ""}`} />
                {errors[name as keyof Errors] ? <p id={`${name}-error`} className="mt-2 text-sm font-bold text-rose-700">{errors[name as keyof Errors]}</p> : null}
              </label>
            ))}

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">پایه درخواستی *</span>
              <input name="requested_grade" required aria-invalid={Boolean(errors.requested_grade)} aria-describedby={errors.requested_grade ? "requested-grade-error" : "grade-help"} className={inputClass} />
              <p id="grade-help" className="mt-2 text-xs font-bold text-slate-500">
                {selectedUnit?.grade_range ? `پایه‌های این واحد: ${selectedUnit.grade_range}` : "پایه تحصیلی مورد نظر را وارد کنید."}
              </p>
              {errors.requested_grade ? <p id="requested-grade-error" className="mt-2 text-sm font-bold text-rose-700">{errors.requested_grade}</p> : null}
            </label>

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">توضیحات تکمیلی</span>
              <textarea name="description" rows={4} className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-[#0f2f4a] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>

            {message ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-800 md:col-span-2">{message}</div> : null}

            <button type="submit" disabled={state === "submitting" || !isOpen} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#12395b] px-6 text-sm font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">
              <Send aria-hidden="true" className="size-4" />
              {state === "submitting" ? "در حال ثبت" : "ثبت درخواست پیش‌ثبت‌نام"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-[#0f2f4a] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
            بازگشت به سایت
          </Link>
        </div>
      </div>
    </div>
  );
}
