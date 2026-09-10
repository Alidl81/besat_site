"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { isTopDialog, popDialog, pushDialog } from "@/lib/dialog-stack";

// ---------- Modal ----------
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
};

export function Modal({ open, onClose, title, children, size = "lg" }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Keeps the keydown handler below able to call the latest onClose without
  // needing it in the effect's dependency array -- callers commonly pass a
  // new inline closure on every render, and depending on it directly would
  // re-run the effect (and yank focus back to the opener) on every one of
  // those renders while the dialog is still open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // FE-MODAL-FOCUS-STACK-ORDER-001: lockBodyScroll()'s reference count
  // (not a capture-and-restore-the-prior-value scheme, this component's
  // previous approach per FE-MODAL-SCROLL-STACK-001) stays correct
  // regardless of the order concurrently open modals close in -- e.g. a
  // media picker opened from inside this modal closing before this modal
  // does. Early-returning when `!open` also means no lock/release call is
  // made for a run that never opened anything.
  useEffect(() => {
    if (!open) return;
    const releaseScrollLock = lockBodyScroll();
    return () => {
      releaseScrollLock();
    };
  }, [open]);

  // Standard dialog focus contract: move focus in on open, trap Tab inside
  // it, close on Escape, and restore focus to whatever opened it once it
  // closes -- otherwise focus stays on the now-hidden opener behind the
  // backdrop and a keyboard user has no idea where they landed.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const token = pushDialog();
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // A dialog opened on top of this one (e.g. a media picker launched
        // from inside this modal) has its own Escape listener on the same
        // document target -- without this check, one Escape press would
        // close both at once instead of just the topmost one.
        if (!isTopDialog(token)) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      popDialog(token);
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const widthClass =
    size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      dir="rtl"
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Without this, the browser's native mousedown default action
        // shifts focus to the nearest focusable ancestor of the backdrop
        // (some tabIndex=-1 dashboard content container up the tree) before
        // our own close/focus-restore effect below gets a chance to act,
        // so focus lands there instead of back on the opener.
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${widthClass} flex-col rounded-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-4rem)]`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <h2 id={titleId} className="text-xl font-black text-[#062452]">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="panel-icon-button bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <PanelIcon name="plus" className="size-5 rotate-45" />
          </button>
        </div>
        {/* Caps the panel to the viewport (minus the outer p-4/sm:p-8) and
            scrolls only this body internally, so long forms never force a
            document-level scroll to reach their own action buttons -- the
            header above stays put via shrink-0/flex-col on the panel. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
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
  /** Defaults to "حذف" -- pass a different verb for a non-delete
   * destructive confirmation (e.g. "لغو سفارش", "تایید بازگشت وجه"). */
  confirmLabel?: string;
  /** Extra content rendered between the description and the action
   * buttons -- e.g. an optional-reason textarea for an action that needs
   * one, still gated behind this same explicit Confirm/Cancel/Escape/
   * backdrop contract. */
  children?: ReactNode;
};

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, confirmLabel = "حذف", children }: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Same latest-callback-without-effect-deps reasoning as Modal above.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    // FE-MODAL-FOCUS-STACK-ORDER-001 (originally added for FE-MODAL-SCROLL-
    // STACK-001, which gave ConfirmDialog its first scroll lock at all --
    // the page behind a destructive confirmation could otherwise still
    // scroll while the user decides): lockBodyScroll()'s reference count
    // stays correct regardless of the order concurrently open dialogs
    // close in, unlike a capture-and-restore-the-prior-value scheme.
    const releaseScrollLock = lockBodyScroll();
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const token = pushDialog();
    // Focus the non-destructive Cancel action, not Confirm/Delete -- this is
    // a destructive-action confirmation, so the default keyboard-accessible
    // focus target should never be the button that causes data loss.
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isTopDialog(token)) return;
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      popDialog(token);
      openerRef.current?.focus();
      releaseScrollLock();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      dir="rtl"
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-right shadow-2xl"
      >
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <PanelIcon name="trash" className="size-6" />
        </div>
        <h3 id={titleId} className="text-lg font-black text-[#062452]">{title}</h3>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
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
            {confirmLabel}
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
  /**
   * "label" (default) implicitly associates the field text with the first
   * labelable control inside `children` -- correct and desirable when that
   * child is a single real form control (input/select/textarea). Pass "div"
   * for compound custom widgets (e.g. a rich editor) that contain their own
   * incidental hidden controls (like an image-upload <input type="file">) --
   * a wrapping <label> would silently forward clicks anywhere in the widget
   * to that unrelated hidden control instead of the widget itself.
   */
  as?: "label" | "div";
};

export function Field({ label, children, required, className = "", as = "label" }: FieldProps) {
  const Wrapper = as;
  return (
    <Wrapper className={`block text-right ${className}`}>
      <span className="mb-2 block text-sm font-black text-[#062452]">
        {label}
        {required ? <span className="mr-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </Wrapper>
  );
}

const inputClass = "panel-input";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> },
) {
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

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> },
) {
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
