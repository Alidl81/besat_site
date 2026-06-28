"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { performLogin } from "@/lib/auth/login-service";
import { writeBesatSession } from "@/lib/auth/auth-session";
import { isApiMode } from "@/lib/data/repository";
import { BesatLogoMark } from "@/components/shared/besat-logo";

function getNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (next && next.startsWith("/")) return next;
  return null;
}

export function LoginCard() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    setMessage("");
    setIsSubmitting(true);

    const result = await performLogin(username, password);

    if (!result.ok) {
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    writeBesatSession(result.session);

    const next = getNextPath();
    router.push(next ?? result.session.redirectPath);
  }

  return (
    <section
      dir="rtl"
      className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:min-h-[34rem] lg:grid-cols-[0.95fr_1.05fr]"
    >
      <aside className="relative min-h-72 overflow-hidden bg-gradient-to-br from-[#143e61] via-[#0d3157] to-[#062452] p-8 text-white lg:min-h-full lg:p-12">
        <div className="relative z-10 flex items-center justify-start gap-4 text-right">
          <BesatLogoMark size="lg" />
          <div>
            <h2 className="text-2xl font-black">مدرسه بعثت</h2>
            <p className="mt-2 text-sm font-black text-white/70">ورود به حساب کاربری</p>
          </div>
        </div>

        <div className="relative z-10 mt-20 text-right lg:absolute lg:bottom-12 lg:right-12 lg:mt-0">
          <p className="text-sm font-black text-emerald-300">ورود</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.5] text-white lg:text-5xl">
            ورود به حساب
          </h1>
        </div>

        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-emerald-300/10 blur-2xl" />
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-xl text-right">
          <p className="text-sm font-black text-emerald-600">ورود</p>
          <h1 className="mt-3 text-3xl font-black text-[#062452] sm:text-4xl">
            ورود به حساب کاربری
          </h1>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <label className="block text-right">
              <span className="mb-3 block text-sm font-black text-[#062452]">
                نام کاربری
              </span>
              <input
                dir="rtl"
                type="text"
                name="username"
                autoComplete="username"
                required
                className="h-[3.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="block text-right">
              <span className="mb-3 block text-sm font-black text-[#062452]">
                رمز عبور
              </span>
              <input
                dir="rtl"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="h-[3.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            {message ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="besat-navy-button flex h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#12395b] text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "در حال ورود" : "ورود"}
            </button>

            {!isApiMode() ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
                <p className="mb-2 text-xs font-black text-slate-400">
                  حساب‌های تستی (حالت بدون بک‌اند) — رمز همه: <span className="text-emerald-600">1234</span>
                </p>
                <ul className="space-y-1 text-xs font-bold text-slate-500">
                  <li>مدیر کل: <span className="text-[#062452]">admin</span></li>
                  <li>مدیر واحد: <span className="text-[#062452]">unit_boys</span></li>
                  <li>همکار رسانه: <span className="text-[#062452]">media</span></li>
                </ul>
              </div>
            ) : null}

            <div className="flex justify-center">
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                بازگشت به سایت
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
