"use client";

import { CrudManager, type Column } from "@/components/crud/crud-manager";
import { StatusBadge } from "@/components/crud/crud-ui";
import { registrationsRepository } from "@/lib/data/repositories";
import type { RegistrationRequestRecord, WithoutSystemFields } from "@/lib/data/domain-types";

type RegistrationsManagerProps = {
  unitId?: string | null;
};

export function RegistrationsManager({ unitId = null }: RegistrationsManagerProps) {
  const columns: Column<RegistrationRequestRecord>[] = [
    { key: "name", header: "نام دانش‌آموز", render: (i) => <span className="font-black">{i.full_name}</span> },
    { key: "phone", header: "تماس والدین", render: (i) => <span className="text-slate-500">{i.parent_phone}</span> },
    { key: "grade", header: "پایه درخواستی", render: (i) => <span>{i.requested_grade}</span> },
    { key: "status", header: "وضعیت", render: (i) => <StatusBadge status={i.status} /> },
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
    <CrudManager<RegistrationRequestRecord>
      title="درخواست‌های ثبت‌نام"
      description="درخواست‌های پیش‌ثبت‌نام دریافتی را بررسی و وضعیت آن‌ها را تعیین کنید."
      repository={registrationsRepository}
      filter={unitId ? (i) => i.unit_id === unitId : undefined}
      columns={columns}
      emptyText="درخواست ثبت‌نامی برای نمایش وجود ندارد."
      addLabel=""
      canCreate={false}
      canEdit={false}
      rowActions={(item, { update }) => (
        <select
          value={item.status}
          onChange={(e) =>
            update(item.id, {
              status: e.target.value as RegistrationRequestRecord["status"],
            } as Partial<WithoutSystemFields<RegistrationRequestRecord>>)
          }
          className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-black text-[#062452] outline-none focus:border-emerald-400"
        >
          <option value="new">جدید</option>
          <option value="reviewing">در حال بررسی</option>
          <option value="accepted">پذیرفته‌شده</option>
          <option value="rejected">رد شده</option>
        </select>
      )}
      renderForm={() => null}
    />
  );
}
