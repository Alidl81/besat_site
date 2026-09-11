"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Container } from "@/components/shared/container";
import { getApiErrorMessage } from "@/lib/api/client";
import { submitMockPaymentOutcome } from "@/services/shop-account-service";
import { isSafeRelativePath } from "@/lib/url-safety";

// SEC-MOCK-PAYMENT-OPEN-REDIRECT-001: the gateway page always redirects
// here after a decision, and this value arrives as an attacker-controllable
// query param. The previous bare startsWith("//")/startsWith("/\\") checks
// missed a decoded tab character right after the leading slash
// ("/\t/evil.example") -- WHATWG URL parsing strips that control character
// during resolution, collapsing it into the same "//evil.example"
// protocol-relative attack after the fact. Reuses the shared
// isSafeRelativePath() validator (already fixing the identical bypass class
// for FE-AUTH-OPEN-REDIRECT-001 and FE-RICH-MEDIA-PROTOCOL-RELATIVE-001)
// instead of a third bespoke, incomplete check.
function sanitizeReturnPath(value: string | null): string {
  if (!value || !isSafeRelativePath(value)) return "/shop";
  return value;
}

const outcomeMessages: Record<string, string> = {
  attempt_not_found: "این پیوند پرداخت آزمایشی معتبر نیست یا منقضی شده است.",
  amount_mismatch: "مبلغ این تلاش پرداخت با سفارش مطابقت ندارد.",
  duplicate: "این تلاش پرداخت پیش‌تر ثبت شده است.",
};

export function MockPaymentGateway({ attemptId }: { attemptId: number }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const returnUrl = sanitizeReturnPath(searchParams.get("return_url"));
  const [submitting, setSubmitting] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Distinct from `error`: a terminal outcome (the attempt is invalid,
  // already resolved, or mismatched) can never succeed on retry, unlike a
  // transient network/API error. Once set, the action buttons are
  // replaced rather than merely re-enabled with an error above them --
  // otherwise a known-dead attempt stays clickable forever, sending a
  // fresh wasted callback every time.
  const [terminalOutcome, setTerminalOutcome] = useState(false);
  const recoveryLinkRef = useRef<HTMLAnchorElement>(null);
  // FE-SHOP-MOCK-PAYMENT-DOUBLE-SUBMIT-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- `disabled={submitting !==
  // null}` only takes effect after React re-renders, so two clicks
  // dispatched before that render both start handleChoice.
  const submittingRef = useRef(false);

  // A malformed dynamic-route segment (e.g. /shop/payment/mock/not-a-number)
  // reaches this component as NaN -- reject it before offering any action
  // rather than letting a request go out for an attempt id that can't
  // possibly be real.
  const invalidAttemptId = !Number.isInteger(attemptId) || attemptId <= 0;

  // When the outcome buttons get replaced by the recovery link (either
  // immediately for a malformed id, or after a terminal callback result),
  // the element that had keyboard focus is removed from the DOM. Browsers
  // don't move focus anywhere sensible when that happens -- it silently
  // falls back to <body>, so a keyboard/screen-reader user loses their
  // place entirely instead of landing on the one remaining actionable
  // control.
  useEffect(() => {
    if (invalidAttemptId || terminalOutcome) {
      recoveryLinkRef.current?.focus();
    }
  }, [invalidAttemptId, terminalOutcome]);

  async function handleChoice(outcome: "success" | "failure") {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(outcome);
    setError(null);
    try {
      const response = await submitMockPaymentOutcome({ attempt_id: attemptId, outcome, mock_token: token });
      // The backend signals a *syntactically successful* (200) call that
      // still couldn't be applied via `response.outcome` -- an unknown/
      // stale/tampered attempt id resolves this way rather than an HTTP
      // error status. Redirecting unconditionally on any 200 silently
      // hid that: the response was being fetched but never read.
      if (response.outcome === "success" || response.outcome === "failed") {
        window.location.href = returnUrl;
        return;
      }
      setError(
        outcomeMessages[response.outcome] ?? "این تلاش پرداخت آزمایشی قابل تکمیل نیست.",
      );
      setTerminalOutcome(true);
      setSubmitting(null);
      submittingRef.current = false;
    } catch (reason) {
      setError(getApiErrorMessage(reason));
      setSubmitting(null);
      submittingRef.current = false;
    }
  }

  if (invalidAttemptId) {
    return (
      <main aria-labelledby="mock-payment-title" className="min-h-[70vh]">
        <Container className="flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 p-6 text-center">
          <ShieldAlert aria-hidden="true" className="mx-auto size-10 text-rose-600" />
          <h1 id="mock-payment-title" className="mt-3 text-lg font-black text-rose-900">پیوند پرداخت آزمایشی نامعتبر است</h1>
          <p role="alert" className="mt-2 text-sm font-bold leading-7 text-rose-800">
            این پیوند پرداخت آزمایشی معتبر نیست یا منقضی شده است.
          </p>
          <Link
            ref={recoveryLinkRef}
            href={returnUrl}
            className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl border border-rose-300 bg-white px-5 text-sm font-black text-rose-700 transition hover:bg-rose-50"
          >
            بازگشت به فروشگاه
          </Link>
        </div>
        </Container>
      </main>
    );
  }

  return (
    <main aria-labelledby="mock-payment-title" className="min-h-[70vh]">
      <Container className="flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-center">
        <ShieldAlert aria-hidden="true" className="mx-auto size-10 text-amber-600" />
        <h1 id="mock-payment-title" className="mt-3 text-lg font-black text-amber-900">این یک درگاه پرداخت آزمایشی است</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-amber-800">
          این صفحه شبیه‌ساز پرداخت است و صرفاً برای محیط توسعه و تست استفاده می‌شود. هیچ پرداخت واقعی انجام
          نمی‌شود.
        </p>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        {terminalOutcome ? (
          <Link
            ref={recoveryLinkRef}
            href={returnUrl}
            className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl border border-[#e5e7eb] px-5 text-sm font-black text-[#0a2848] transition hover:bg-[#f4f1ea]"
          >
            بازگشت به فروشگاه
          </Link>
        ) : (
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => handleChoice("success")}
              disabled={submitting !== null}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting === "success" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              )}
              شبیه‌سازی پرداخت موفق
            </button>
            <button
              type="button"
              onClick={() => handleChoice("failure")}
              disabled={submitting !== null}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {submitting === "failure" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <XCircle aria-hidden="true" className="size-4" />
              )}
              شبیه‌سازی پرداخت ناموفق
            </button>
          </div>
        )}
      </div>
      </Container>
    </main>
  );
}
