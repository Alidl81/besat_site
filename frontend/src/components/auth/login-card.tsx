"use client";

import Link from "next/link";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { performLogin } from "@/lib/auth/login-service";
import { writeBesatSession } from "@/lib/auth/auth-session";
import { getSafeNextPath } from "@/lib/auth/next-path";
import { mergeGuestCartAfterAuth } from "@/lib/shop/cart-context";
import { BesatLogoMark } from "@/components/shared/besat-logo";

function getNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return getSafeNextPath(params.get("next"));
}

export function LoginCard() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"username" | "password", string>>>({});
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameErrorId = useId();
  const passwordErrorId = useId();
  // AUTH-UI-DOUBLE-SUBMIT-001: `disabled={isSubmitting}` only disables the
  // button once React actually re-renders with the new state -- two form
  // submit events dispatched before that render (e.g. a double-click, or
  // Enter held while a mouse click also lands) both start handleSubmit
  // before either sees isSubmitting flip. A ref is read/written
  // synchronously, so it blocks a re-entrant call immediately regardless of
  // render timing.
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    setMessage("");
    setFieldErrors({});

    const nextFieldErrors: typeof fieldErrors = {};
    if (!username.trim()) nextFieldErrors.username = "نام کاربری الزامی است.";
    if (!password) nextFieldErrors.password = "رمز عبور الزامی است.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setMessage("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      (nextFieldErrors.username ? usernameRef : passwordRef).current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    const result = await performLogin(username, password);

    if (!result.ok) {
      submittingRef.current = false;
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    writeBesatSession(result.session);
    await mergeGuestCartAfterAuth();

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
          <BesatLogoMark size="lg" tone="light" />
          <div>
            <h2 className="text-2xl font-black">مدرسه بعثت</h2>
            <p className="mt-2 text-sm font-black text-white/70">ورود به حساب کاربری</p>
          </div>
        </div>

        <div className="relative z-10 mt-20 text-right lg:absolute lg:bottom-12 lg:right-12 lg:mt-0">
          <p className="text-sm font-black text-blue-300">ورود</p>
          {/* Decorative marketing headline, not the page's real heading --
              the actual h1 with the same content is in the form panel
              below. Kept as a <p> (same visual size/weight) so there's
              exactly one meaningful h1 per page instead of two competing
              peers. */}
          <p className="mt-4 text-4xl font-black leading-[1.5] text-white lg:text-5xl">
            ورود به حساب
          </p>
        </div>

        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-blue-300/10 blur-2xl" />
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-xl text-right">
          <p className="text-sm font-black text-blue-600">ورود</p>
          <h1 className="mt-3 text-3xl font-black text-[#062452] sm:text-4xl">
            ورود به حساب کاربری
          </h1>

          <form onSubmit={handleSubmit} method="post" noValidate className="mt-10 space-y-6">
            <label className="block text-right">
              <span className="mb-3 block text-sm font-black text-[#062452]">
                نام کاربری
              </span>
              <input
                ref={usernameRef}
                dir="rtl"
                type="text"
                name="username"
                autoComplete="username"
                required
                onChange={() => setFieldErrors((current) => ({ ...current, username: undefined }))}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={
                  fieldErrors.username
                    ? usernameErrorId
                    : message
                      ? "login-error-message"
                      : undefined
                }
                className="besat-focus-scroll-offset h-[3.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
              />
              {fieldErrors.username ? (
                <p id={usernameErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                  {fieldErrors.username}
                </p>
              ) : null}
            </label>

            <label className="block text-right">
              <span className="mb-3 block text-sm font-black text-[#062452]">
                رمز عبور
              </span>
              <input
                ref={passwordRef}
                dir="rtl"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                onChange={() => setFieldErrors((current) => ({ ...current, password: undefined }))}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password
                    ? passwordErrorId
                    : message
                      ? "login-error-message"
                      : undefined
                }
                className="besat-focus-scroll-offset h-[3.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
              />
              {fieldErrors.password ? (
                <p id={passwordErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                  {fieldErrors.password}
                </p>
              ) : null}
            </label>

            {message ? (
              <p
                id="login-error-message"
                role="alert"
                className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700"
              >
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

            <p className="text-center text-xs font-bold leading-6 text-slate-500">
              به حساب دسترسی ندارید یا لینک تعیین رمز را گم کرده‌اید؟{" "}
              <Link
                href="/contact?subject=%D8%AF%D8%B1%D8%AE%D9%88%D8%A7%D8%B3%D8%AA%20%D8%AF%D8%B3%D8%AA%D8%B1%D8%B3%DB%8C%20%D8%A8%D9%87%20%D8%AD%D8%B3%D8%A7%D8%A8"
                className="font-black text-[#0c5794] underline decoration-2 underline-offset-4"
              >
                درخواست راهنمایی از مدرسه
              </Link>
            </p>

            <div className="flex justify-center">
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:border-blue-200 hover:bg-blue-50"
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
