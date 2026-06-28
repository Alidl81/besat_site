"use client";

import { CrudManager, type Column } from "@/components/crud/crud-manager";
import { messagesRepository } from "@/lib/data/repositories";
import type { ContactMessageRecord, WithoutSystemFields } from "@/lib/data/domain-types";

export function MessagesManager() {
  const columns: Column<ContactMessageRecord>[] = [
    {
      key: "read",
      header: "",
      render: (i) =>
        i.is_read ? null : <span className="inline-block size-2.5 rounded-full bg-emerald-500" />,
    },
    { key: "name", header: "فرستنده", render: (i) => <span className="font-black">{i.name}</span> },
    { key: "subject", header: "موضوع", render: (i) => <span>{i.subject}</span> },
    { key: "phone", header: "تماس", render: (i) => <span className="text-slate-500">{i.phone}</span> },
    {
      key: "message",
      header: "متن",
      render: (i) => <span className="block max-w-xs truncate text-slate-500">{i.message}</span>,
    },
    {
      key: "date",
      header: "تاریخ",
      render: (i) => (
        <span className="text-xs font-bold text-slate-400">
          {new Intl.DateTimeFormat("fa-IR").format(new Date(i.created_at))}
        </span>
      ),
    },
  ];

  return (
    <CrudManager<ContactMessageRecord>
      title="پیام‌های دریافتی"
      description="پیام‌های ارسالی از فرم تماس را مشاهده و مدیریت کنید."
      repository={messagesRepository}
      columns={columns}
      emptyText="پیامی برای نمایش وجود ندارد."
      addLabel=""
      canCreate={false}
      canEdit={false}
      rowActions={(item, { update }) =>
        item.is_read ? (
          <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-400">
            خوانده‌شده
          </span>
        ) : (
          <button
            type="button"
            onClick={() =>
              update(item.id, { is_read: true } as Partial<WithoutSystemFields<ContactMessageRecord>>)
            }
            className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            علامت خوانده‌شده
          </button>
        )
      }
      renderForm={() => null}
    />
  );
}
