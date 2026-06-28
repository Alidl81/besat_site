"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { apiRequest } from "@/lib/api/client";

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
};

function Field({ id, label, type = "text", autoComplete, required, placeholder }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-right text-sm font-black text-[#062452]">
        {label}
        {required ? <span className="mr-1 text-rose-500">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition duration-500 placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

type FormState = "idle" | "submitting" | "success" | "error";

export function PreregistrationCard() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          description: String(formData.get("description") ?? ""),
        }),
      });
      setState("success");
      setMessage("درخواست پیش‌ثبت‌نام شما با موفقیت ثبت شد. به زودی با شما تماس می‌گیریم.");
      (event.target as HTMLFormElement).reset();
    } catch {
      setState("error");
      setMessage("خطا در ثبت درخواست. لطفاً دوباره تلاش کنید یا با شماره تماس مدرسه تماس بگیرید.");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 lg:grid-cols-[0.95fr_1.05fr]">
      {/* پنل سمت راست — دکوراتیو */}
      <section className="relative hidden overflow-hidden bg-[#062452] p-8 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.28),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.14),transparent_32%)]" />
        <div className="absolute bottom-0 left-0 h-40 w-72 rounded-tr-[6rem] bg-white/10" />

        <div className="relative z-10 flex h-full min-h-[34rem] flex-col">
          <div className="flex items-center gap-4">
            <BesatLogoMark size="xl" priority />
            <div>
              <p className="text-xl font-black text-white">مدرسه بعثت</p>
              <p className="mt-1 text-sm font-bold text-white/65">پیش‌ثبت‌نام آنلاین</p>
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-sm font-black text-emerald-300">پیش‌ثبت‌نام</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.5] text-white">
              ثبت درخواست پیش‌ثبت‌نام
            </h1>
            <p className="mt-4 text-sm font-bold leading-8 text-white/65">
              اطلاعات خود را وارد کنید تا همکاران مدرسه با شما تماس بگیرند.
            </p>
          </div>
        </div>
      </section>

      {/* فرم */}
      <section className="p-6 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
          <div className="text-right">
            <p className="text-lg font-black text-[#062452]">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-slate-500">پیش‌ثبت‌نام آنلاین</p>
          </div>
          <BesatLogoMark size="lg" priority />
        </div>

        <div className="text-right">
          <p className="mb-3 text-sm font-black text-emerald-700">پیش‌ثبت‌نام</p>
          <h2 className="text-3xl font-black leading-[1.4] text-[#062452]">
            پیش‌ثبت‌نام آنلاین
          </h2>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
            لطفاً اطلاعات خواسته‌شده را با دقت وارد نمایید.
          </p>
        </div>

        {state === "success" ? (
          <div className="mt-8 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 text-right">
            <p className="text-lg font-black text-emerald-700">درخواست ثبت شد!</p>
            <p className="mt-2 text-sm font-bold leading-7 text-emerald-600">{message}</p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              ثبت درخواست جدید
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field
              id="fullName"
              label="نام و نام خانوادگی دانش‌آموز"
              autoComplete="name"
              required
              placeholder="نام کامل دانش‌آموز"
            />
            <Field
              id="parentPhone"
              label="شماره تماس والدین"
              type="tel"
              autoComplete="tel"
              required
              placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
            />
            <Field
              id="requestedGrade"
              label="پایه یا واحد مورد نظر"
              required
              placeholder="مثال: پایه اول ابتدایی"
            />

            <div>
              <label htmlFor="description" className="mb-2 block text-right text-sm font-black text-[#062452]">
                توضیحات تکمیلی
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="هر توضیح یا سوالی که دارید اینجا بنویسید..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition duration-500 placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {state === "error" ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={state === "submitting"}
              className="w-full rounded-2xl bg-[#12395b] px-5 py-3.5 text-sm font-black text-white transition duration-500 hover:-translate-y-0.5 hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
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
