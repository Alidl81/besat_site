"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { RegistrationUnitSelector } from "@/components/registration/registration-unit-selector";
import { RegistrationGradeSelector } from "@/components/registration/registration-grade-selector";
import { apiRequest } from "@/lib/api/client";
import { unitsRepository } from "@/lib/data/repositories";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
};

type FormState = "idle" | "submitting" | "success" | "error";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  required,
}: FieldProps) {
  return (
    <label className="block text-right">
      <span className="mb-2 block text-sm font-black text-[#062452]">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>

      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
      />
    </label>
  );
}

export function PreregistrationCard() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [units, setUnits] = useState<SchoolUnitRecord[] | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => {
    let isMounted = true;

    unitsRepository
      .list()
      .then((allUnits) => {
        if (!isMounted) {
          return;
        }

        const activeUnits = allUnits
          .filter((unit) => unit.is_active)
          .sort((a, b) => a.order - b.order);

        setUnits(activeUnits);

        if (activeUnits.length > 0) {
          setSelectedUnitId(activeUnits[0].id);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnits([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUnitId) {
      setState("error");
      setMessage("لطفاً واحد مورد نظر را انتخاب کنید.");
      return;
    }

    setState("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest("registration/", {
        method: "POST",
        body: JSON.stringify({
          full_name: String(formData.get("fullName") ?? ""),
          parent_phone: String(formData.get("parentPhone") ?? ""),
          requested_grade: String(formData.get("requestedGrade") ?? ""),
          unit_id: selectedUnitId,
          description: String(formData.get("description") ?? ""),
        }),
      });

      setState("success");
      setMessage("درخواست پیش‌ثبت‌نام شما با موفقیت ثبت شد. به زودی با شما تماس می‌گیریم.");
      event.currentTarget.reset();

      if (units && units.length > 0) {
        setSelectedUnitId(units[0].id);
      }
    } catch {
      setState("error");
      setMessage("خطا در ثبت درخواست. لطفاً دوباره تلاش کنید یا با شماره تماس مدرسه تماس بگیرید.");
    }
  }

  return (
    <div
      dir="rtl"
      className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.08fr_0.92fr]"
    >
      <aside className="relative hidden min-h-[48rem] overflow-hidden bg-[#062452] px-6 py-8 text-white lg:block">
        <div className="absolute -right-16 -top-16 size-44 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="absolute -bottom-20 -left-20 size-52 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-center gap-4">
            <BesatLogoMark size="lg" />

            <div>
              <p className="text-sm font-black text-emerald-300">مدرسه بعثت</p>
              <h1 className="mt-1 text-2xl font-black">پیش‌ثبت‌نام آنلاین</h1>
            </div>
          </div>

          <p className="mt-5 text-sm font-bold leading-8 text-white/75">
            ابتدا واحد مورد نظر را انتخاب کنید و سپس اطلاعات دانش‌آموز و والدین را وارد کنید.
          </p>

          <div className="mt-6 flex-1">
            <RegistrationUnitSelector
              units={units}
              selectedUnitId={selectedUnitId}
              onSelect={setSelectedUnitId}
              display="desktop"
            />
          </div>
        </div>
      </aside>

      <section className="p-5 sm:p-8">
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <BesatLogoMark size="md" />
          <div>
            <p className="text-sm font-black text-emerald-600">پیش‌ثبت‌نام</p>
            <h1 className="text-xl font-black text-[#062452]">
              پیش‌ثبت‌نام آنلاین
            </h1>
          </div>
        </div>

        {state === "success" ? (
          <div className="rounded-[1.7rem] border border-emerald-100 bg-emerald-50 p-6 text-right">
            <h2 className="text-xl font-black text-emerald-700">
              درخواست ثبت شد!
            </h2>

            <p className="mt-3 text-sm font-bold leading-8 text-emerald-800">
              {message}
            </p>

            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              ثبت درخواست جدید
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="text-sm font-black text-emerald-600">پیش‌ثبت‌نام</p>
              <h2 className="mt-2 text-2xl font-black text-[#062452]">
                ثبت درخواست پیش‌ثبت‌نام
              </h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
                واحد مورد نظر را انتخاب کنید و اطلاعات خواسته‌شده را وارد کنید.
              </p>
            </div>

            <RegistrationUnitSelector
              units={units}
              selectedUnitId={selectedUnitId}
              onSelect={setSelectedUnitId}
              display="mobile"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="fullName"
                label="نام و نام خانوادگی دانش‌آموز"
                autoComplete="name"
                required
              />

              <Field
                id="parentPhone"
                label="شماره تماس والدین"
                type="tel"
                autoComplete="tel"
                required
              />
              <RegistrationGradeSelector
                units={units}
                selectedUnitId={selectedUnitId}
              />

              <label className="block text-right md:col-span-2">
                <span className="mb-2 block text-sm font-black text-[#062452]">
                  توضیحات تکمیلی
                </span>

                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold leading-7 text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
            </div>

            {state === "error" ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={state === "submitting" || units === null || !selectedUnitId}
              className="besat-navy-button w-full rounded-2xl bg-[#12395b] px-5 py-3.5 text-sm font-black transition duration-500 hover:-translate-y-0.5 hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {state === "submitting" ? "در حال ثبت درخواست..." : "ثبت درخواست پیش‌ثبت‌نام"}
            </button>
          </form>
        )}

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-[#062452] transition duration-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            بازگشت به سایت
          </Link>
        </div>
      </section>
    </div>
  );
}
