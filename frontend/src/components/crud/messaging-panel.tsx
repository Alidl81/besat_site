"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Modal } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { readBesatSession } from "@/lib/auth/auth-session";
import { panelService } from "@/services/panel-service";
import type {
  InternalMessageItem,
  MessageRecipient,
} from "@/types/panel-api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function MessagingPanel() {
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<InternalMessageItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messages = usePanelRequest(
    () => panelService.messages(activeTab),
    [activeTab],
  );
  const recipients = usePanelRequest(
    () => panelService.messageRecipients(),
    [],
  );
  // Belt-and-suspenders: the backend already excludes the caller, but a user must
  // never see themselves as a selectable recipient even if that response ever regresses.
  const selectableRecipients = useMemo(() => {
    const selfId = `user-${readBesatSession()?.username ?? ""}`;
    return (recipients.data ?? []).filter((recipient) => recipient.id !== selfId);
  }, [recipients.data]);

  async function openMessage(message: InternalMessageItem) {
    setError(null);
    try {
      const next =
        activeTab === "inbox" && !message.is_read
          ? await panelService.markMessageRead(message.id)
          : message;
      setSelected(next);
      if (next !== message) messages.reload();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    }
  }

  async function remove() {
    if (!selected || !window.confirm("این پیام حذف شود؟")) return;
    setError(null);
    try {
      await panelService.removeMessage(selected.id);
      setSelected(null);
      messages.reload();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#062452]">پیام‌رسانی داخلی</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">ارسال و دریافت پیام با کاربران مجاز سامانه</p>
        </div>
        <button type="button" onClick={() => setComposeOpen(true)} className="panel-primary-button"><PanelIcon name="edit" className="size-4" />پیام جدید</button>
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button type="button" onClick={() => setActiveTab("inbox")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-black ${activeTab === "inbox" ? "bg-[#062452] text-white" : "text-[#062452] hover:bg-slate-50"}`}>صندوق ورودی</button>
        <button type="button" onClick={() => setActiveTab("sent")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-black ${activeTab === "sent" ? "bg-[#062452] text-white" : "text-[#062452] hover:bg-slate-50"}`}>ارسال‌شده‌ها</button>
      </div>

      {messages.loading ? <PanelLoading label="در حال دریافت پیام‌ها..." /> : messages.error ? <PanelError message={messages.error} onRetry={messages.reload} /> : messages.data?.results.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {messages.data.results.map((message) => {
              const person = activeTab === "inbox" ? message.sender : message.recipient;
              return (
                <li key={message.id}>
                  <button type="button" onClick={() => void openMessage(message)} className={`flex w-full items-start gap-4 px-5 py-4 text-right hover:bg-slate-50 ${activeTab === "inbox" && !message.is_read ? "bg-blue-50/50" : ""}`}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef3f7] text-sm font-black text-[#0c3a66]">{person.full_name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><b className="truncate text-sm text-[#062452]">{person.full_name} · {person.role_display}</b><time className="shrink-0 text-[11px] font-bold text-slate-400">{formatDate(message.created_at)}</time></span><strong className="mt-1 block truncate text-sm text-slate-700">{message.subject}</strong><span className="mt-1 block truncate text-xs font-bold text-slate-400">{message.body}</span></span>
                    {activeTab === "inbox" && !message.is_read ? <i className="mt-2 size-2 shrink-0 rounded-full bg-blue-500" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500">مجموع {messages.data.count} پیام</p>
        </section>
      ) : <PanelEmpty title={activeTab === "inbox" ? "پیامی دریافت نشده است." : "پیامی ارسال نشده است."} />}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="مشاهده پیام" size="lg">
        {selected ? <div className="space-y-4"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600"><p>از: <b className="text-[#062452]">{selected.sender.full_name}</b></p><p className="mt-2">به: <b className="text-[#062452]">{selected.recipient.full_name}</b></p><time className="mt-2 block">{formatDate(selected.created_at)}</time></div><h3 className="text-lg font-black text-[#062452]">{selected.subject}</h3><p className="min-h-24 whitespace-pre-line rounded-lg border border-slate-200 p-4 text-sm font-bold leading-8 text-slate-700">{selected.body}</p><div className="flex justify-end gap-3"><button type="button" onClick={() => void remove()} className="panel-secondary-button !border-rose-200 !text-rose-600"><PanelIcon name="trash" className="size-4" />حذف پیام</button><button type="button" onClick={() => { setComposeOpen(true); }} className="panel-primary-button">پاسخ</button></div></div> : null}
      </Modal>

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title={selected ? "پاسخ به پیام" : "ارسال پیام"} size="lg">
        {recipients.loading ? <PanelLoading label="در حال دریافت گیرندگان..." /> : recipients.error ? <PanelError message={recipients.error} onRetry={recipients.reload} /> : (
          <ComposeForm
            recipients={selectableRecipients}
            replyTo={selected}
            onCancel={() => setComposeOpen(false)}
            onSent={() => {
              setComposeOpen(false);
              setSelected(null);
              setActiveTab("sent");
              messages.reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

type ComposeFieldName = "recipient_id" | "subject" | "body";
type ComposeFieldErrors = Partial<Record<ComposeFieldName, string>>;

function ComposeForm({
  recipients,
  replyTo,
  onSent,
  onCancel,
}: {
  recipients: MessageRecipient[];
  replyTo: InternalMessageItem | null;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<ComposeFieldErrors>({});

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipientId = String(form.get("recipient_id") ?? "");
    const subject = String(form.get("subject") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();

    const nextErrors: ComposeFieldErrors = {};
    if (!recipientId) nextErrors.recipient_id = "انتخاب گیرنده الزامی است.";
    if (!subject) nextErrors.subject = "موضوع پیام الزامی است.";
    if (!body) nextErrors.body = "متن پیام الزامی است.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      return;
    }

    setSaving(true);
    setFormError("");
    setErrors({});
    try {
      await panelService.sendMessage({ recipient_id: recipientId, subject, body });
      onSent();
    } catch (reason) {
      if (reason instanceof ApiError) {
        const nextErrors: ComposeFieldErrors = {};
        for (const [field, messages] of Object.entries(reason.fieldErrors)) {
          if (messages?.[0] && (field === "recipient_id" || field === "subject" || field === "body")) {
            nextErrors[field] = messages[0];
          }
        }
        setErrors(nextErrors);
      }
      setFormError(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={send} noValidate className="space-y-4">
      {formError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-black text-rose-700">
          {formError}
        </p>
      ) : null}
      {!recipients.length ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-800">
          گیرنده مجازی برای ارسال پیام یافت نشد.
        </p>
      ) : null}
      <label>
        <span className="panel-field-label">گیرنده</span>
        <select
          name="recipient_id"
          required
          defaultValue={replyTo?.sender.id ?? ""}
          disabled={!recipients.length}
          aria-invalid={Boolean(errors.recipient_id)}
          aria-describedby={errors.recipient_id ? "recipient_id-error" : undefined}
          className="panel-select"
        >
          <option value="">انتخاب گیرنده</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.full_name} ({recipient.role_display})
            </option>
          ))}
        </select>
        {errors.recipient_id ? (
          <p id="recipient_id-error" className="mt-2 text-sm font-bold text-rose-700">
            {errors.recipient_id}
          </p>
        ) : null}
      </label>
      <label>
        <span className="panel-field-label">موضوع</span>
        <input
          name="subject"
          required
          defaultValue={replyTo ? `پاسخ: ${replyTo.subject}` : ""}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "subject-error" : undefined}
          className="panel-input"
        />
        {errors.subject ? (
          <p id="subject-error" className="mt-2 text-sm font-bold text-rose-700">
            {errors.subject}
          </p>
        ) : null}
      </label>
      <label>
        <span className="panel-field-label">متن پیام</span>
        <textarea
          name="body"
          required
          rows={7}
          aria-invalid={Boolean(errors.body)}
          aria-describedby={errors.body ? "body-error" : undefined}
          className="panel-textarea"
        />
        {errors.body ? (
          <p id="body-error" className="mt-2 text-sm font-bold text-rose-700">
            {errors.body}
          </p>
        ) : null}
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="panel-secondary-button">
          انصراف
        </button>
        <button disabled={saving || !recipients.length} type="submit" className="panel-primary-button">
          {saving ? "در حال ارسال..." : "ارسال پیام"}
        </button>
      </div>
    </form>
  );
}
