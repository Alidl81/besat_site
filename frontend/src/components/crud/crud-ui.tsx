"use client";

import { useEffect, type ReactNode } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";

// ---------- Modal ----------
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
};

export function Modal({ open, onClose, title, children, size = "lg" }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const widthClass =
    size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="fixed inset-0 -z-10"
      />
      <div
        className={`relative w-full ${widthClass} rounded-xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-xl font-black text-[#062452]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="panel-icon-button bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <PanelIcon name="plus" className="size-5 rotate-45" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

// ---------- ConfirmDialog ----------
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-right shadow-2xl">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <PanelIcon name="trash" className="size-6" />
        </div>
        <h3 className="text-lg font-black text-[#062452]">{title}</h3>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-[#062452] transition hover:bg-slate-50"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- FormField ----------
type FieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
};

export function Field({ label, children, required, className = "" }: FieldProps) {
  return (
    <label className={`block text-right ${className}`}>
      <span className="mb-2 block text-sm font-black text-[#062452]">
        {label}
        {required ? <span className="mr-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass = "panel-input";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`panel-textarea ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`panel-select ${props.className ?? ""}`}
    />
  );
}

// ---------- Buttons ----------
export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`panel-primary-button disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`panel-secondary-button ${props.className ?? ""}`}
    />
  );
}

// ---------- StatusBadge ----------
// A stamp/seal treatment (ring border + light tint + slight rotation)
// rather than a flat filled pill -- this is the school-registrar visual
// language established for shop (order status, enrollment status) and
// applied here since this one component is shared by every workflow
// status badge across the whole CMS (News/Announcements review states,
// shop orders, course enrollments).
type StatusTone = "neutral" | "pending" | "info" | "positive" | "negative";

const toneClassName: Record<StatusTone, string> = {
  neutral: "border-slate-400 bg-slate-50 text-slate-600",
  pending: "border-amber-500 bg-amber-50 text-amber-700",
  info: "border-sky-500 bg-sky-50 text-sky-700",
  positive: "border-emerald-500 bg-emerald-50 text-emerald-700",
  negative: "border-rose-500 bg-rose-50 text-rose-700",
};

const statusMap: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  waiting_review: { label: "در انتظار بررسی", tone: "pending" },
  approved: { label: "تأییدشده", tone: "info" },
  published: { label: "منتشرشده", tone: "positive" },
  rejected: { label: "رد شده", tone: "negative" },
  archived: { label: "آرشیوشده", tone: "neutral" },
  // Content (news/announcements) workflow statuses -- a longer state
  // machine than Gallery/Virtual Tour/Events, which only use the six
  // keys above.
  in_review: { label: "در صف بررسی", tone: "pending" },
  changes_requested: { label: "نیازمند اصلاح", tone: "negative" },
  scheduled: { label: "زمان‌بندی‌شده", tone: "info" },
  unpublished: { label: "لغو انتشار", tone: "pending" },
  trash: { label: "زباله‌دان", tone: "negative" },
  new: { label: "جدید", tone: "info" },
  reviewing: { label: "در حال بررسی", tone: "pending" },
  accepted: { label: "پذیرفته‌شده", tone: "info" },
  // Shop order statuses
  pending_payment: { label: "در انتظار پرداخت", tone: "pending" },
  payment_processing: { label: "در حال پردازش پرداخت", tone: "pending" },
  paid: { label: "پرداخت‌شده", tone: "positive" },
  processing: { label: "در حال پردازش", tone: "info" },
  shipped: { label: "ارسال‌شده", tone: "info" },
  completed: { label: "تکمیل‌شده", tone: "positive" },
  cancelled: { label: "لغوشده", tone: "neutral" },
  payment_failed: { label: "پرداخت ناموفق", tone: "negative" },
  refunded: { label: "بازگشت وجه", tone: "neutral" },
  partially_refunded: { label: "بازگشت جزئی وجه", tone: "neutral" },
  // Shop course enrollment statuses
  active: { label: "فعال", tone: "positive" },
  revoked: { label: "ابطال‌شده", tone: "negative" },
  inactive: { label: "غیرفعال", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const item = statusMap[status] ?? { label: status, tone: "neutral" as const };
  return (
    <span
      className={`inline-flex -rotate-1 items-center rounded-full border-[1.5px] px-3 py-0.5 text-xs font-black ${toneClassName[item.tone]}`}
    >
      {item.label}
    </span>
  );
}

// ---------- Section wrapper ----------
type CrudSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function CrudSection({ title, description, action, children }: CrudSectionProps) {
  return (
    <section className="panel-card">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[#062452]">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ---------- EmptyRow ----------
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-7 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
        <PanelIcon name="file" className="size-6" />
      </div>
      <p className="text-sm font-bold leading-7 text-slate-500">{text}</p>
    </div>
  );
}
