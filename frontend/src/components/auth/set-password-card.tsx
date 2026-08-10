"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { setAccountPassword } from "@/lib/api/account-api";
import { BesatLogoMark } from "@/components/shared/besat-logo";

type Status = "idle" | "missing_token" | "submitting" | "success" | "error";

function resolveErrorMessages(reason: unknown): string[] {
  if (reason instanceof ApiError) {
    if (reason.fieldErrors.token?.length) {
      return reason.fieldErrors.token;
    }

    const passwordErrors = [
      ...(reason.fieldErrors.password ?? []),
      ...(reason.fieldErrors.non_field_errors ?? []),
    ];

    if (passwordErrors.length) {
      return passwordErrors;
    }
  }

  return [getApiErrorMessage(reason)];
}

const fieldInputClass =
  "h-[3.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white";

export function SetPasswordCard({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? "idle" : "missing_token");
  const [messages, setMessages] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessages(["رمز عبور و تکرار آن یکسان نیستند."]);
      return;
    }

    setStatus("submitting");
    setMessages([]);

    try {
      await setAccountPassword({ token, password });
      setStatus("success");
    } catch (reason) {
      setStatus("error");
      setMessages(resolveErrorMessages(reason));
    }
  }

  return (
    <section
      dir="rtl"
      className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:min-h-[34rem] lg:grid-cols-[0.95fr_1.05fr]"
    >
      <aside className="relative min-h-72 overflow-hidden bg-gradient-to-br from-[#143e61] via-[#0d3157] to-[#062452] p-8 text-white lg:min-h-full lg:p-12">
        <div className="relative z-10 flex items-center justify-start gap-4 text-right">
          <BesatLogoMark size="lg" tone="light" />
          <div>
            <h2 className="text-2xl font-black">مدرسه بعثت</h2>
            <p className="mt-2 text-sm font-black text-white/70">فعال‌سازی حساب کاربری</p>
          </div>
        </div>

        <div className="relative z-10 mt-20 text-right lg:absolute lg:bottom-12 lg:right-12 lg:mt-0">
          <p className="text-sm font-black text-blue-300">تعیین رمز عبور</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.5] text-white lg:text-5xl">
            رمز عبور خود را بسازید
          </h1>
        </div>

        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-blue-300/10 blur-2xl" />
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-xl text-right">
          <p className="text-sm font-black text-blue-600">تعیین رمز عبور</p>
          <h1 className="mt-3 text-3xl font-black text-[#062452] sm:text-4xl">
            رمز عبور خود را تعیین کنید
          </h1>

          {status === "missing_token" ? (
            <div className="mt-10 space-y-6">
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
                لینک دعوت نامعتبر است. نشانی صفحه فاقد کد دعوت است.
              </p>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:border-blue-200 hover:bg-blue-50"
              >
                رفتن به صفحه ورود
              </Link>
            </div>
          ) : status === "success" ? (
            <div className="mt-10 space-y-6" role="status" aria-live="polite">
              <p className="rounded-2xl bg-blue-50 px-4 py-3 text-right text-sm font-black text-blue-700">
                رمز عبور شما با موفقیت تعیین شد. اکنون می‌توانید با آن وارد حساب کاربری خود شوید.
              </p>
              <Link
                href="/login"
                className="besat-navy-button flex h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#12395b] text-sm font-black transition hover:bg-[#0d2f4d]"
              >
                ورود به حساب
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <label className="block text-right">
                <span className="mb-3 block text-sm font-black text-[#062452]">
                  رمز عبور جدید
                </span>
                <input
                  dir="rtl"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={fieldInputClass}
                />
              </label>

              <label className="block text-right">
                <span className="mb-3 block text-sm font-black text-[#062452]">
                  تکرار رمز عبور جدید
                </span>
                <input
                  dir="rtl"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={fieldInputClass}
                />
              </label>

              {status === "error" && messages.length ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700"
                >
                  {messages.length === 1 ? (
                    <p>{messages[0]}</p>
                  ) : (
                    <ul className="list-inside list-disc space-y-1">
                      {messages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="besat-navy-button flex h-[3.5rem] w-full items-center justify-center rounded-2xl bg-[#12395b] text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "submitting" ? "در حال ثبت..." : "تعیین رمز عبور"}
              </button>

              <div className="flex justify-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:border-blue-200 hover:bg-blue-50"
                >
                  بازگشت به ورود
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
