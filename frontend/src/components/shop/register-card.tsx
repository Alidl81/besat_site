"use client";

import Link from "next/link";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { writeBesatSession } from "@/lib/auth/auth-session";
import { getSafeNextPath } from "@/lib/auth/next-path";
import { performCustomerRegistration } from "@/lib/auth/registration-service";
import { mergeGuestCartAfterAuth } from "@/lib/shop/cart-context";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return getSafeNextPath(params.get("next"));
}

export function RegisterCard() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"full_name" | "email" | "password" | "password_confirm", string>>
  >({});
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const fullNameErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const passwordConfirmErrorId = useId();
  // AUTH-UI-REGISTER-DOUBLE-SUBMIT-001: same fix/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={isSubmitting}`
  // only takes effect after React re-renders, so two submit events
  // dispatched before that render both start handleSubmit. A synchronously
  // read/written ref blocks the re-entrant call immediately.
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "");
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("password_confirm") ?? "");

    setMessage("");
    setFieldErrors({});

    const nextFieldErrors: typeof fieldErrors = {};
    if (!fullName) nextFieldErrors.full_name = "نام کامل الزامی است.";
    if (!email) nextFieldErrors.email = "ایمیل الزامی است.";
    else if (!EMAIL_PATTERN.test(email)) nextFieldErrors.email = "ایمیل واردشده معتبر نیست.";
    if (!password) nextFieldErrors.password = "رمز عبور الزامی است.";
    else if (password.length < 8) nextFieldErrors.password = "رمز عبور باید حداقل ۸ نویسه باشد.";
    if (!passwordConfirm) nextFieldErrors.password_confirm = "تکرار رمز عبور الزامی است.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setMessage("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      (nextFieldErrors.full_name
        ? fullNameRef
        : nextFieldErrors.email
          ? emailRef
          : nextFieldErrors.password
            ? passwordRef
            : passwordConfirmRef
      ).current?.focus();
      return;
    }

    if (password !== passwordConfirm) {
      setFieldErrors({ password_confirm: "رمز عبور و تکرار آن یکسان نیستند." });
      setMessage("رمز عبور و تکرار آن یکسان نیستند.");
      passwordConfirmRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    const result = await performCustomerRegistration({
      full_name: fullName,
      email,
      phone,
      password,
      password_confirm: passwordConfirm,
    });

    if (!result.ok) {
      submittingRef.current = false;
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    writeBesatSession(result.session);
    await mergeGuestCartAfterAuth();

    const next = getNextPath();
    router.push(next ?? "/shop/checkout");
  }

  return (
    <section
      dir="rtl"
      className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:min-h-[38rem] lg:grid-cols-[0.95fr_1.05fr]"
    >
      <aside className="relative min-h-72 overflow-hidden bg-gradient-to-br from-[#143e61] via-[#0d3157] to-[#062452] p-8 text-white lg:min-h-full lg:p-12">
        <div className="relative z-10 flex items-center justify-start gap-4 text-right">
          <BesatLogoMark size="lg" tone="light" />
          <div>
            <h2 className="text-2xl font-black">فروشگاه بعثت</h2>
            <p className="mt-2 text-sm font-black text-white/70">ساخت حساب کاربری</p>
          </div>
        </div>

        <div className="relative z-10 mt-20 text-right lg:absolute lg:bottom-12 lg:right-12 lg:mt-0">
          <p className="text-sm font-black text-blue-300">حساب کاربری جدید</p>
          {/* Decorative marketing headline, not the page's real heading --
              the actual h1 is in the form panel below. Same pattern/fix as
              login-card.tsx's FE-AUTH-LOGIN-HEADING-HIERARCHY-001. */}
          <p className="mt-4 text-3xl font-black leading-[1.5] text-white lg:text-4xl">
            برای خرید و پیگیری سفارش‌ها، حساب بسازید
          </p>
        </div>

        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-blue-300/10 blur-2xl" />
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-xl text-right">
          <p className="text-sm font-black text-blue-600">ثبت‌نام</p>
          <h1 className="mt-3 text-2xl font-black text-[#062452] sm:text-3xl">ساخت حساب کاربری</h1>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
            این حساب برای خرید از فروشگاه و پیگیری سفارش‌ها و دوره‌های شماست؛ جدا از حساب‌های ایجادشده توسط
            مدرسه است.
          </p>

          <form onSubmit={handleSubmit} method="post" noValidate className="mt-8 grid gap-5">
            <label className="block text-right">
              <span className="mb-2 block text-sm font-black text-[#062452]">نام کامل</span>
              <input
                ref={fullNameRef}
                dir="rtl"
                type="text"
                name="full_name"
                autoComplete="name"
                required
                onChange={() => setFieldErrors((current) => ({ ...current, full_name: undefined }))}
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={fieldErrors.full_name ? fullNameErrorId : undefined}
                className="besat-focus-scroll-offset h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
              />
              {fieldErrors.full_name ? (
                <p id={fullNameErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                  {fieldErrors.full_name}
                </p>
              ) : null}
            </label>

            <label className="block text-right">
              <span className="mb-2 block text-sm font-black text-[#062452]">ایمیل</span>
              <input
                ref={emailRef}
                dir="ltr"
                type="email"
                name="email"
                autoComplete="email"
                required
                onChange={() => setFieldErrors((current) => ({ ...current, email: undefined }))}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                className="besat-focus-scroll-offset h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
              />
              {fieldErrors.email ? (
                <p id={emailErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                  {fieldErrors.email}
                </p>
              ) : null}
            </label>

            <label className="block text-right">
              <span className="mb-2 block text-sm font-black text-[#062452]">شماره تماس (اختیاری)</span>
              <input
                dir="ltr"
                type="tel"
                name="phone"
                autoComplete="tel"
                className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-right">
                <span className="mb-2 block text-sm font-black text-[#062452]">رمز عبور</span>
                <input
                  ref={passwordRef}
                  dir="rtl"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  onChange={() => setFieldErrors((current) => ({ ...current, password: undefined }))}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                  className="besat-focus-scroll-offset h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
                />
                {fieldErrors.password ? (
                  <p id={passwordErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </label>
              <label className="block text-right">
                <span className="mb-2 block text-sm font-black text-[#062452]">تکرار رمز عبور</span>
                <input
                  ref={passwordConfirmRef}
                  dir="rtl"
                  type="password"
                  name="password_confirm"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  onChange={() => setFieldErrors((current) => ({ ...current, password_confirm: undefined }))}
                  aria-invalid={Boolean(fieldErrors.password_confirm)}
                  aria-describedby={fieldErrors.password_confirm ? passwordConfirmErrorId : undefined}
                  className="besat-focus-scroll-offset h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
                />
                {fieldErrors.password_confirm ? (
                  <p id={passwordConfirmErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                    {fieldErrors.password_confirm}
                  </p>
                ) : null}
              </label>
            </div>

            {message ? (
              <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="besat-navy-button flex h-[3.25rem] w-full items-center justify-center rounded-2xl text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "در حال ساخت حساب" : "ساخت حساب کاربری"}
            </button>

            <p className="text-center text-sm font-bold text-slate-500">
              قبلاً حساب دارید؟{" "}
              <Link href="/login?next=/shop/checkout" className="font-black text-blue-600 hover:underline">
                وارد شوید
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
