"use client";

import Link from "next/link";
import { useState } from "react";

type AuthMode = "login" | "register";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-right text-sm font-black text-[#062452]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition duration-500 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

export function AuthCubeCard() {
  const [mode, setMode] = useState<AuthMode>("login");
  const isRegister = mode === "register";

  return (
    <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#062452] p-8 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.28),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.14),transparent_32%)]" />
        <div className="absolute bottom-0 left-0 h-40 w-72 rounded-tr-[6rem] bg-white/10" />

        <div className="relative z-10 flex h-full min-h-[36rem] flex-col">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-[1.5rem] bg-white text-3xl font-black text-[#062452] shadow-xl">
              ب
            </div>

            <div>
              <p className="text-xl font-black text-white">مدرسه بعثت</p>
              <p className="mt-1 text-sm font-bold text-white/65">سامانه مدیریت مدرسه</p>
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-sm font-black text-emerald-300">
              {isRegister ? "ثبت‌نام" : "ورود"}
            </p>
            <h1 className="mt-4 text-4xl font-black leading-[1.5] text-white">
              {isRegister ? "ثبت‌نام در مدرسه بعثت" : "ورود به پنل مدرسه"}
            </h1>
          </div>
        </div>
      </section>

      <section className="p-6 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
          <div className="text-right">
            <p className="text-lg font-black text-[#062452]">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-slate-500">سامانه مدیریت مدرسه</p>
          </div>

          <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-[#062452] text-2xl font-black text-white">
            ب
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition duration-500 ${
              mode === "login"
                ? "bg-[#062452] text-white shadow-sm"
                : "text-[#062452] hover:bg-white"
            }`}
          >
            ورود
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition duration-500 ${
              mode === "register"
                ? "bg-[#062452] text-white shadow-sm"
                : "text-[#062452] hover:bg-white"
            }`}
          >
            ثبت‌نام
          </button>
        </div>

        <div style={{ perspective: "1400px" }}>
          <div
            className="relative min-h-[30rem] transition duration-700 ease-out"
            style={{
              transformStyle: "preserve-3d",
              transform: isRegister ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            <div
              className="absolute inset-0 rounded-[1.75rem] border border-slate-200 bg-white p-1"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="h-full rounded-[1.5rem] bg-white text-right">
                <p className="mb-3 text-sm font-black text-emerald-700">ورود</p>
                <h2 className="text-3xl font-black leading-[1.4] text-[#062452]">
                  ورود به پنل
                </h2>

                <form className="mt-8 space-y-5">
                  <Field id="username" label="نام کاربری" autoComplete="username" />
                  <Field
                    id="password"
                    label="رمز عبور"
                    type="password"
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    className="w-full rounded-2xl bg-[#12395b] px-5 py-3 text-sm font-black text-white transition duration-500 hover:-translate-y-0.5 hover:bg-[#0d2f4d]"
                  >
                    ورود به پنل
                  </button>
                </form>

                <div className="mt-6 flex justify-center">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-[#062452] transition duration-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    بازگشت به سایت
                  </Link>
                </div>
              </div>
            </div>

            <div
              className="absolute inset-0 rounded-[1.75rem] border border-slate-200 bg-white p-1"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div className="h-full rounded-[1.5rem] bg-white text-right">
                <p className="mb-3 text-sm font-black text-emerald-700">ثبت‌نام</p>
                <h2 className="text-3xl font-black leading-[1.4] text-[#062452]">
                  ثبت‌نام آنلاین
                </h2>

                <form className="mt-8 space-y-5">
                  <Field id="fullName" label="نام و نام خانوادگی" autoComplete="name" />
                  <Field id="phone" label="شماره تماس" autoComplete="tel" />
                  <Field id="grade" label="پایه یا واحد مورد نظر" />

                  <button
                    type="button"
                    className="w-full rounded-2xl bg-[#12395b] px-5 py-3 text-sm font-black text-white transition duration-500 hover:-translate-y-0.5 hover:bg-[#0d2f4d]"
                  >
                    ثبت درخواست
                  </button>
                </form>

                <div className="mt-6 flex justify-center">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-[#062452] transition duration-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    بازگشت به سایت
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
