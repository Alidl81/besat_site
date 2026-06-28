"use client";

import { useEffect, type ReactNode } from "react";

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
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="fixed inset-0 -z-10"
      />
      <div
        className={`relative w-full ${widthClass} rounded-[1.8rem] border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-xl font-black text-[#062452]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-[1.8rem] border border-slate-200 bg-white p-6 text-right shadow-2xl">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600">
          ⚠
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

const inputClass =
  "h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white ${props.className ?? ""}`}
    />
  );
}

// ---------- Buttons ----------
export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`besat-navy-button inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-[#12395b] px-6 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70 ${props.className ?? ""}`}
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#062452] transition hover:bg-slate-50 ${props.className ?? ""}`}
    />
  );
}

// ---------- StatusBadge ----------
const statusMap: Record<string, { label: string; className: string }> = {
  draft: { label: "پیش‌نویس", className: "bg-slate-100 text-slate-600" },
  waiting_review: { label: "در انتظار بررسی", className: "bg-amber-50 text-amber-700" },
  published: { label: "منتشرشده", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "رد شده", className: "bg-rose-50 text-rose-700" },
  new: { label: "جدید", className: "bg-sky-50 text-sky-700" },
  reviewing: { label: "در حال بررسی", className: "bg-amber-50 text-amber-700" },
  accepted: { label: "پذیرفته‌شده", className: "bg-emerald-50 text-emerald-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const item = statusMap[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-xl px-3 py-1 text-xs font-black ${item.className}`}>
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
    <section className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm sm:p-6">
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
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-xl text-emerald-700 shadow-sm">
        ◌
      </div>
      <p className="text-sm font-bold leading-7 text-slate-500">{text}</p>
    </div>
  );
}
