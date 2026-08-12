"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Container } from "@/components/shared/container";
import { getApiErrorMessage } from "@/lib/api/client";
import { submitMockPaymentOutcome } from "@/services/shop-account-service";

export function MockPaymentGateway({ attemptId }: { attemptId: number }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const returnUrl = searchParams.get("return_url") ?? "/shop";
  const [submitting, setSubmitting] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoice(outcome: "success" | "failure") {
    setSubmitting(outcome);
    setError(null);
    try {
      await submitMockPaymentOutcome({ attempt_id: attemptId, outcome, mock_token: token });
      window.location.href = returnUrl;
    } catch (reason) {
      setError(getApiErrorMessage(reason));
      setSubmitting(null);
    }
  }

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-center">
        <ShieldAlert aria-hidden="true" className="mx-auto size-10 text-amber-600" />
        <h1 className="mt-3 text-lg font-black text-amber-900">این یک درگاه پرداخت آزمایشی است</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-amber-800">
          این صفحه شبیه‌ساز پرداخت است و صرفاً برای محیط توسعه و تست استفاده می‌شود. هیچ پرداخت واقعی انجام
          نمی‌شود.
        </p>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => handleChoice("success")}
            disabled={submitting !== null}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
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
      </div>
    </Container>
  );
}
