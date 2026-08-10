"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RegistrationGradeSelector } from "@/components/registration/registration-grade-selector";
import { RegistrationUnitSelector } from "@/components/registration/registration-unit-selector";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import {
  getPublicUnits,
  getRegistrationInfo,
} from "@/services/public-content-service";
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

type FormState = "idle" | "submitting" | "success" | "error";

const inputClass =
  "min-h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-[#0f2f4a] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 motion-reduce:transition-none";

export function PreregistrationCard({
  initialUnitSlug,
}: {
  initialUnitSlug?: string;
}) {
  const [units, setUnits] = useState<PublicSchoolUnit[] | null>(null);
  const [registration, setRegistration] = useState<RegistrationInfo | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [version, setVersion] = useState(0);
  const pendingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getPublicUnits(), getRegistrationInfo()])
      .then(([allUnits, info]) => {
        if (cancelled) {
          return;
        }

        const availableUnits = allUnits.filter(
          (unit) => unit.accepts_registration,
        );
        const scopedUnit = initialUnitSlug
          ? allUnits.find((unit) => unit.slug === initialUnitSlug)
          : null;

        setLoadError("");
        setUnits(allUnits);
        setRegistration(info);
        setSelectedGrade("");
        setSelectedUnitId(
          scopedUnit?.accepts_registration
            ? String(scopedUnit.id)
            : String(availableUnits[0]?.id ?? ""),
        );
      })
      .catch((reason) => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialUnitSlug, version]);

  const scopedUnit = useMemo(
    () => units?.find((unit) => unit.slug === initialUnitSlug) ?? null,
    [initialUnitSlug, units],
  );
  const availableUnits = useMemo(
    () => units?.filter((unit) => unit.accepts_registration) ?? [],
    [units],
  );
  const selectedUnit = useMemo(
    () =>
      units?.find((unit) => String(unit.id) === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );
  const lockedToUnit = Boolean(scopedUnit);
  const isOpen =
    Boolean(registration?.is_open) &&
    Boolean(selectedUnit?.accepts_registration);
  const unavailableReason = !registration?.is_open
    ? registration?.closed_message ||
      "زمان بعدی پیش‌ثبت‌نام از همین صفحه اعلام می‌شود."
    : lockedToUnit && !scopedUnit?.accepts_registration
      ? `پیش‌ثبت‌نام ${scopedUnit?.title ?? "این واحد"} فعال نیست.`
      : availableUnits.length === 0
        ? "در حال حاضر هیچ واحد آموزشی برای پیش‌ثبت‌نام فعال نیست."
        : null;

  function focusFirstError(nextErrors: Errors) {
    const first = Object.keys(nextErrors)[0];

    if (!first) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (first === "requested_grade") {
        document.getElementById("requested-grade-control")?.focus();
        return;
      }

      formRef.current
        ?.querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingRef.current || !isOpen) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const numericUnitId = Number(selectedUnitId);
    const payload = {
      student_full_name: String(data.get("student_full_name") ?? "").trim(),
      parent_full_name:
        String(data.get("parent_full_name") ?? "").trim() || null,
      parent_phone: String(data.get("parent_phone") ?? "").trim(),
      parent_email: String(data.get("parent_email") ?? "").trim() || null,
      // Production unit identifiers are numeric. Preserve a string fixture ID
      // only when a non-production mock explicitly supplies one.
      requested_unit: Number.isFinite(numericUnitId)
        ? numericUnitId
        : selectedUnitId,
      requested_grade: selectedGrade,
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
      nextErrors.requested_grade = "پایه درخواستی را انتخاب کنید.";
    }
    if (!selectedUnit || !selectedUnit.accepts_registration) {
      nextErrors.requested_unit =
        "واحد انتخاب‌شده پیش‌ثبت‌نام فعال ندارد.";
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
      const response = await apiRequest<{ message?: string; id?: number }>(
        apiEndpoints.registrationRequests,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setState("success");
      setMessage(response.message || "درخواست پیش‌ثبت‌نام ثبت شد.");
      form.reset();
      setSelectedGrade("");
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

  if (loadError) {
    return (
      <main
        className="mx-auto w-full max-w-3xl rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-sm"
        role="alert"
      >
        <h1 className="text-2xl font-black text-[#0f2f4a]">
          دریافت اطلاعات پیش‌ثبت‌نام انجام نشد
        </h1>
        <p className="mt-3 text-sm font-bold text-rose-700">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setUnits(null);
            setRegistration(null);
            setLoadError("");
            setVersion((value) => value + 1);
          }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </main>
    );
  }

  if (!units || !registration) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="در حال دریافت اطلاعات پیش‌ثبت‌نام"
        className="mx-auto h-[36rem] w-full max-w-7xl animate-pulse rounded-[2rem] bg-slate-200 motion-reduce:animate-none"
      />
    );
  }

  return (
    <div
      dir="rtl"
      className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.08fr_0.92fr]"
    >
      <aside className="relative hidden min-h-[48rem] overflow-hidden bg-[#062452] px-6 py-8 text-white lg:flex lg:flex-col">
        <div className="absolute -right-16 -top-16 size-44 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="absolute -bottom-20 -left-20 size-52 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-center gap-4">
            <BesatLogoMark size="lg" tone="light" />

            <div>
              <p className="text-sm font-black text-blue-300">مجتمع آموزشی بعثت</p>
              <h1 className="mt-1 text-2xl font-black">
                {registration.title || "پیش‌ثبت‌نام آنلاین"}
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm font-bold leading-8 text-white/75">
            {registration.description ||
              "واحد مورد نظر را از گردونه انتخاب کنید و سپس اطلاعات دانش‌آموز و ولی را وارد کنید."}
          </p>

          {registration.open_message ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-xs font-black leading-7 text-blue-200">
              {registration.open_message}
            </p>
          ) : null}

          <div className="mt-6 flex-1">
            <RegistrationUnitSelector
              units={availableUnits}
              selectedUnitId={selectedUnitId}
              onSelect={(unitId) => {
                setSelectedUnitId(unitId);
                setSelectedGrade("");
              }}
              display="desktop"
            />
          </div>
        </div>
      </aside>

      <section className="p-5 sm:p-8">
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <BesatLogoMark size="md" />
          <div>
            <p className="text-sm font-black text-blue-600">پیش‌ثبت‌نام</p>
            <h1 className="text-xl font-black text-[#062452]">
              {registration.title || "پیش‌ثبت‌نام آنلاین"}
            </h1>
          </div>
        </div>

        {unavailableReason ? (
          <div
            role="status"
            className="rounded-[1.7rem] border border-amber-300 bg-amber-50 p-6 text-right"
          >
            <h2 className="text-xl font-black text-amber-900">
              پیش‌ثبت‌نام در حال حاضر بسته است
            </h2>
            <p className="mt-3 text-sm font-bold leading-7 text-amber-900">
              {unavailableReason}
            </p>
          </div>
        ) : state === "success" ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50 p-8 text-center"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mx-auto size-10 text-emerald-700"
            />
            <h2 className="mt-4 text-2xl font-black text-emerald-900">
              درخواست ثبت شد
            </h2>
            <p className="mt-3 text-sm font-bold text-emerald-800">{message}</p>
            <button
              type="button"
              onClick={() => {
                setState("idle");
                setMessage("");
                setErrors({});
              }}
              className="mt-5 min-h-11 rounded-xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
            >
              ثبت درخواست دیگر
            </button>
          </div>
        ) : (
          <form
            ref={formRef}
            noValidate
            onSubmit={handleSubmit}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <p className="text-sm font-black text-blue-600">پیش‌ثبت‌نام</p>
              <h2 className="mt-2 text-2xl font-black text-[#062452]">
                ثبت درخواست پیش‌ثبت‌نام
              </h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
                واحد و پایه مورد نظر را انتخاب کنید و اطلاعات خواسته‌شده را با دقت وارد کنید.
              </p>
            </div>

            {lockedToUnit ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
                <p className="text-xs font-black text-blue-700">واحد آموزشی</p>
                <p className="mt-1 text-base font-black text-[#0f2f4a]">
                  {scopedUnit?.title}
                </p>
              </div>
            ) : (
              <div className="md:col-span-2">
                <RegistrationUnitSelector
                  units={availableUnits}
                  selectedUnitId={selectedUnitId}
                  onSelect={(unitId) => {
                    setSelectedUnitId(unitId);
                    setSelectedGrade("");
                    setErrors((current) => ({
                      ...current,
                      requested_unit: undefined,
                      requested_grade: undefined,
                    }));
                  }}
                  display="mobile"
                />
                {errors.requested_unit ? (
                  <p className="mt-2 text-sm font-bold text-rose-700">
                    {errors.requested_unit}
                  </p>
                ) : null}
              </div>
            )}

            <label>
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
                نام و نام خانوادگی دانش‌آموز <span className="text-rose-700">*</span>
              </span>
              <input
                id="student-full-name"
                name="student_full_name"
                autoComplete="name"
                required
                aria-invalid={Boolean(errors.student_full_name)}
                aria-describedby={
                  errors.student_full_name ? "student-full-name-error" : undefined
                }
                className={inputClass}
              />
              {errors.student_full_name ? (
                <p id="student-full-name-error" className="mt-2 text-sm font-bold text-rose-700">
                  {errors.student_full_name}
                </p>
              ) : null}
            </label>

            <label>
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
                نام و نام خانوادگی ولی
              </span>
              <input
                id="parent-full-name"
                name="parent_full_name"
                autoComplete="name"
                aria-invalid={Boolean(errors.parent_full_name)}
                aria-describedby={
                  errors.parent_full_name ? "parent-full-name-error" : undefined
                }
                className={inputClass}
              />
              {errors.parent_full_name ? (
                <p id="parent-full-name-error" className="mt-2 text-sm font-bold text-rose-700">
                  {errors.parent_full_name}
                </p>
              ) : null}
            </label>

            <label>
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
                شماره تماس ولی <span className="text-rose-700">*</span>
              </span>
              <input
                id="parent-phone"
                type="tel"
                name="parent_phone"
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                required
                aria-invalid={Boolean(errors.parent_phone)}
                aria-describedby={
                  errors.parent_phone ? "parent-phone-error" : undefined
                }
                className={`${inputClass} text-left`}
              />
              {errors.parent_phone ? (
                <p id="parent-phone-error" className="mt-2 text-sm font-bold text-rose-700">
                  {errors.parent_phone}
                </p>
              ) : null}
            </label>

            <label>
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
                ایمیل ولی
              </span>
              <input
                id="parent-email"
                type="email"
                name="parent_email"
                autoComplete="email"
                inputMode="email"
                dir="ltr"
                aria-invalid={Boolean(errors.parent_email)}
                aria-describedby={
                  errors.parent_email ? "parent-email-error" : undefined
                }
                className={`${inputClass} text-left`}
              />
              {errors.parent_email ? (
                <p id="parent-email-error" className="mt-2 text-sm font-bold text-rose-700">
                  {errors.parent_email}
                </p>
              ) : null}
            </label>

            <div className="md:col-span-2">
              <RegistrationGradeSelector
                units={units}
                selectedUnitId={selectedUnitId}
                error={errors.requested_grade}
                onChange={(grade) => {
                  setSelectedGrade(grade);
                  if (grade) {
                    setErrors((current) => ({
                      ...current,
                      requested_grade: undefined,
                    }));
                  }
                }}
              />
              {selectedUnit?.grade_range ? (
                <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                  پایه‌های این واحد: {selectedUnit.grade_range}
                </p>
              ) : null}
            </div>

            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-black text-[#0f2f4a]">
                توضیحات تکمیلی
              </span>
              <textarea
                id="registration-description"
                name="description"
                rows={4}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? "registration-description-error" : undefined
                }
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-[#0f2f4a] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 motion-reduce:transition-none"
              />
              {errors.description ? (
                <p id="registration-description-error" className="mt-2 text-sm font-bold text-rose-700">
                  {errors.description}
                </p>
              ) : null}
            </label>

            {message ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-800 md:col-span-2"
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={state === "submitting" || !isOpen}
              className="besat-navy-button inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:col-span-2"
            >
              <Send aria-hidden="true" className="size-4" />
              {state === "submitting"
                ? "در حال ثبت"
                : "ثبت درخواست پیش‌ثبت‌نام"}
            </button>
          </form>
        )}

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-[#0f2f4a] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
          >
            بازگشت به سایت
          </Link>
        </div>
      </section>
    </div>
  );
}
