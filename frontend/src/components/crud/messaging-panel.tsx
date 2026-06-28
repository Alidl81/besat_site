"use client";

import { type FormEvent, useEffect, useState } from "react";
import { internalMessagesRepository, usersRepository } from "@/lib/data/repositories";
import { readBesatSession } from "@/lib/auth/auth-session";
import { Modal } from "@/components/crud/crud-ui";
import type { InternalMessageRecord, UserRecord } from "@/lib/data/domain-types";

function formatDate(str: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(str));
  } catch {
    return str;
  }
}

const roleLabels: Record<string, string> = {
  general_manager: "مدیر کل",
  unit_manager: "مدیر واحد",
  unit_media: "همکار رسانه",
  parent: "والدین",
};

export function MessagingPanel() {
  const [messages, setMessages] = useState<InternalMessageRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState<InternalMessageRecord | null>(null);
  const [session, setSession] = useState<{ id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    const s = readBesatSession();
    if (s) {
      setSession({ id: `user-${s.username}`, name: s.fullName ?? s.username, role: s.role });
    }

    Promise.all([internalMessagesRepository.list(), usersRepository.list()]).then(
      ([msgs, usrs]) => {
        setMessages(msgs);
        setUsers(usrs);
        setLoading(false);
      },
    );
  }, []);

  async function reload() {
    const msgs = await internalMessagesRepository.list();
    setMessages(msgs);
  }

  const sessionId = session?.id ?? "";

  const inbox = messages.filter((m) => m.recipient_id === sessionId || m.recipient_role === session?.role).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sent = messages.filter((m) => m.sender_id === sessionId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const displayed = activeTab === "inbox" ? inbox : sent;
  const unreadCount = inbox.filter((m) => !m.is_read).length;

  async function markRead(msg: InternalMessageRecord) {
    if (!msg.is_read) {
      await internalMessagesRepository.update(msg.id, { is_read: true });
      await reload();
    }
    setViewMsg({ ...msg, is_read: true });
  }

  async function deleteMsg(id: string) {
    await internalMessagesRepository.remove(id);
    setViewMsg(null);
    await reload();
  }

  return (
    <div className="mt-5 space-y-5">
      {/* هدر */}
      <div className="flex flex-col gap-4 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-xl font-black text-[#062452]">پیام‌رسانی داخلی</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">
            ارسال و دریافت پیام با کاربران سیستم
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="besat-navy-button inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#12395b] px-6 text-sm font-black transition hover:bg-[#0d2f4d]"
        >
          <span>✏</span>
          <span>پیام جدید</span>
        </button>
      </div>

      {/* تب inbox/sent */}
      <div className="flex gap-2 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition duration-300 ${
            activeTab === "inbox" ? "bg-[#062452] text-white" : "text-[#062452] hover:bg-slate-50"
          }`}
        >
          <span>📥 صندوق ورودی</span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition duration-300 ${
            activeTab === "sent" ? "bg-[#062452] text-white" : "text-[#062452] hover:bg-slate-50"
          }`}
        >
          <span>📤 ارسال‌شده‌ها</span>
        </button>
      </div>

      {/* لیست پیام‌ها */}
      <div className="rounded-[1.8rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
              ✉
            </span>
            <p className="text-sm font-bold text-slate-500">
              {activeTab === "inbox" ? "پیامی دریافت نشده است." : "پیامی ارسال نشده است."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {displayed.map((msg) => {
              const isUnread = !msg.is_read && activeTab === "inbox";
              return (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => markRead(msg)}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-right transition hover:bg-slate-50 sm:px-6 ${
                      isUnread ? "bg-emerald-50/50" : ""
                    }`}
                  >
                    {/* نقطه خوانده‌نشده */}
                    <span className="mt-1.5 flex size-2.5 shrink-0 items-center justify-center">
                      {isUnread ? (
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm ${isUnread ? "font-black text-[#062452]" : "font-bold text-slate-600"}`}>
                          {activeTab === "inbox" ? msg.sender_name : msg.recipient_name}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-slate-400">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className={`mt-1 text-sm ${isUnread ? "font-black text-[#062452]" : "font-bold text-slate-700"}`}>
                        {msg.subject}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-400">
                        {msg.body}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* مودال مشاهده پیام */}
      <Modal open={viewMsg !== null} onClose={() => setViewMsg(null)} title="مشاهده پیام" size="lg">
        {viewMsg ? (
          <div className="space-y-4 text-right">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">از:</span>
                <span className="font-black text-[#062452]">
                  {viewMsg.sender_name}
                  <span className="mr-2 text-xs font-bold text-slate-400">
                    ({roleLabels[viewMsg.sender_role] ?? viewMsg.sender_role})
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">به:</span>
                <span className="font-black text-[#062452]">{viewMsg.recipient_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-500">تاریخ:</span>
                <span className="font-bold text-slate-500">{formatDate(viewMsg.created_at)}</span>
              </div>
            </div>
            <h3 className="text-lg font-black text-[#062452]">{viewMsg.subject}</h3>
            <div className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold leading-8 text-slate-700 whitespace-pre-line">
              {viewMsg.body}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => deleteMsg(viewMsg.id)}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-black text-rose-600 transition hover:bg-rose-100"
              >
                حذف پیام
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMsg(null);
                  setComposeOpen(true);
                }}
                className="besat-navy-button rounded-2xl bg-[#12395b] px-5 py-2.5 text-sm font-black transition hover:bg-[#0d2f4d]"
              >
                پاسخ
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* مودال نوشتن پیام */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="ارسال پیام" size="lg">
        <ComposeForm
          session={session}
          users={users}
          replyTo={viewMsg}
          onSent={async () => {
            setComposeOpen(false);
            setViewMsg(null);
            await reload();
          }}
          onCancel={() => setComposeOpen(false)}
        />
      </Modal>
    </div>
  );
}

function ComposeForm({
  session,
  users,
  replyTo,
  onSent,
  onCancel,
}: {
  session: { id: string; name: string; role: string } | null;
  users: UserRecord[];
  replyTo: InternalMessageRecord | null;
  onSent: () => Promise<void>;
  onCancel: () => void;
}) {
  const [recipientId, setRecipientId] = useState(
    replyTo ? (replyTo.sender_id ?? "") : "",
  );
  const [subject, setSubject] = useState(
    replyTo ? `پاسخ: ${replyTo.subject}` : "",
  );
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const recipientUser = users.find((u) => u.id === recipientId);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      await internalMessagesRepository.create({
        sender_id: session.id,
        sender_name: session.name,
        sender_role: session.role as InternalMessageRecord["sender_role"],
        recipient_id: recipientId || null,
        recipient_name: recipientUser?.full_name ?? "همه",
        recipient_role: recipientUser?.role ?? null,
        subject,
        body,
        is_read: false,
        unit_id: null,
      });
      await onSent();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-right">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[#062452]">
          گیرنده <span className="text-rose-500">*</span>
        </span>
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          required
          className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
        >
          <option value="">— انتخاب گیرنده —</option>
          {users
            .filter((u) => `user-${u.username}` !== session?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({roleLabels[u.role] ?? u.role})
              </option>
            ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-[#062452]">
          موضوع <span className="text-rose-500">*</span>
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-[#062452]">
          متن پیام <span className="text-rose-500">*</span>
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
        />
      </label>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-[#062452] transition hover:bg-slate-50"
        >
          انصراف
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="besat-navy-button rounded-2xl bg-[#12395b] px-6 py-2.5 text-sm font-black transition hover:bg-[#0d2f4d] disabled:opacity-70"
        >
          {submitting ? "در حال ارسال..." : "ارسال پیام"}
        </button>
      </div>
    </form>
  );
}
