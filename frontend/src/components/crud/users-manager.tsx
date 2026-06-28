"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Select, TextInput } from "@/components/crud/crud-ui";
import { unitsRepository, usersRepository } from "@/lib/data/repositories";
import type {
  AccountRole,
  SchoolUnitRecord,
  UserRecord,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

const roleLabels: Record<AccountRole, string> = {
  general_manager: "مدیر کل",
  unit_manager: "مدیر واحد",
  unit_media: "همکار رسانه",
  parent: "والدین",
};

export function UsersManager() {
  const columns: Column<UserRecord>[] = [
    { key: "name", header: "نام", render: (i) => <span className="font-black">{i.full_name}</span> },
    { key: "username", header: "نام کاربری", render: (i) => <span className="text-slate-500">{i.username}</span> },
    { key: "role", header: "نقش", render: (i) => <span>{roleLabels[i.role]}</span> },
    { key: "phone", header: "تماس", render: (i) => <span className="text-slate-500">{i.phone ?? "—"}</span> },
    {
      key: "active",
      header: "وضعیت",
      render: (i) => (
        <span className={`rounded-xl px-3 py-1 text-xs font-black ${i.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {i.is_active ? "فعال" : "غیرفعال"}
        </span>
      ),
    },
  ];

  return (
    <CrudManager<UserRecord>
      title="مدیریت کاربران"
      description="کاربران سیستم و نقش‌های آن‌ها را مدیریت کنید."
      repository={usersRepository}
      columns={columns}
      emptyText="کاربری ثبت نشده است."
      addLabel="کاربر جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <UserForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function UserForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: UserRecord | null;
  onSubmit: (data: WithoutSystemFields<UserRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [role, setRole] = useState<AccountRole>(initial?.role ?? "unit_manager");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [units, setUnits] = useState<SchoolUnitRecord[]>([]);

  useEffect(() => {
    unitsRepository.list().then(setUnits);
  }, []);

  const needsUnit = role === "unit_manager" || role === "unit_media";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      full_name: fullName,
      username,
      email: email || null,
      phone: phone || null,
      role,
      unit_id: needsUnit ? unitId || null : null,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="نام و نام خانوادگی" required>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="نام کاربری" required>
          <TextInput value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="ایمیل">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="شماره تماس">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="نقش کاربری">
          <Select value={role} onChange={(e) => setRole(e.target.value as AccountRole)}>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        {needsUnit ? (
          <Field label="واحد مرتبط">
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">— انتخاب واحد —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="text-sm font-black text-[#062452]">کاربر فعال باشد</span>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-5 rounded border-slate-300 accent-emerald-600"
        />
      </label>

      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
