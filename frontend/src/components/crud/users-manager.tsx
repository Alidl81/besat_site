"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Modal, PrimaryButton, Select, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import type { Repository } from "@/lib/data/repository";
import { unitsRepository, usersRepository } from "@/lib/data/repositories";
import type {
  AccountRole,
  SchoolUnitRecord,
  UserRecord,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

// Includes the legacy unit_manager value so existing accounts still render a
// label; it is intentionally excluded from assignableRoleOptions below.
const roleLabels: Record<AccountRole, string> = {
  general_manager: "مدیر کل",
  unit_manager: "مدیر واحد (نقش قدیمی)",
  unit_media: "همکار رسانه",
  parent: "والدین",
};

const assignableRoleOptions: { value: AccountRole; label: string }[] = [
  { value: "general_manager", label: roleLabels.general_manager },
  { value: "unit_media", label: roleLabels.unit_media },
  { value: "parent", label: roleLabels.parent },
];

function buildSetPasswordLink(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/set-password?token=${token}`;
}

export function UsersManager() {
  const [invitedUser, setInvitedUser] = useState<UserRecord | null>(null);

  // CrudManager/useCollection only propagate create()'s resolved record
  // internally (their public onSubmit contract is Promise<void>, shared by
  // every other manager); this repository wrapper is a side channel that
  // hands the one-time invitation token back to this component without
  // widening that shared contract for every other entity.
  const usersRepositoryWithInvite: Repository<UserRecord> = useMemo(
    () => ({
      ...usersRepository,
      async create(data) {
        const created = await usersRepository.create(data);
        if (created.invitation) {
          setInvitedUser(created);
        }
        return created;
      },
    }),
    [],
  );

  const columns: Column<UserRecord>[] = [
    { key: "name", header: "نام", render: (i) => <span className="font-black">{i.full_name}</span> },
    { key: "username", header: "نام کاربری", render: (i) => <span className="text-slate-500">{i.username}</span> },
    { key: "role", header: "نقش", render: (i) => <span>{roleLabels[i.role]}</span> },
    { key: "phone", header: "تماس", render: (i) => <span className="text-slate-500">{i.phone ?? "—"}</span> },
    {
      key: "active",
      header: "وضعیت",
      render: (i) => (
        <span className={`rounded-xl px-3 py-1 text-xs font-black ${i.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
          {i.is_active ? "فعال" : "غیرفعال"}
        </span>
      ),
    },
  ];

  return (
    <>
      <CrudManager<UserRecord>
        title="مدیریت کاربران"
        description="کاربران سیستم و نقش‌های آن‌ها را مدیریت کنید."
        repository={usersRepositoryWithInvite}
        columns={columns}
        emptyText="کاربری ثبت نشده است."
        addLabel="کاربر جدید"
        renderForm={({ initial, onSubmit, onCancel, submitting }) => (
          <UserForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
        )}
      />

      <InviteLinkModal user={invitedUser} onClose={() => setInvitedUser(null)} />
    </>
  );
}

function InviteLinkModal({
  user,
  onClose,
}: {
  user: UserRecord | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const invitation = user?.invitation;

  async function copyLink() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(buildSetPasswordLink(invitation.token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal open={Boolean(user && invitation)} onClose={onClose} title="دعوت کاربر ارسال شد" size="md">
      {user && invitation ? (
        <div className="space-y-5 text-right">
          {invitation.email_sent ? (
            <p className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
              <PanelIcon name="mail" className="size-4 shrink-0" />
              <span>ایمیل دعوت برای «{user.email}» ارسال شد.</span>
            </p>
          ) : (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
              ارسال خودکار ایمیل فعال نیست. لینک زیر را برای «{user.full_name || user.username}» ارسال کنید.
            </p>
          )}

          <div>
            <span className="mb-2 block text-sm font-black text-[#062452]">لینک تعیین رمز عبور</span>
            <div className="flex items-center gap-2">
              <TextInput
                readOnly
                dir="ltr"
                value={buildSetPasswordLink(invitation.token)}
                onFocus={(event) => event.currentTarget.select()}
                className="text-left"
              />
              <PrimaryButton type="button" onClick={copyLink} className="shrink-0">
                <PanelIcon name={copied ? "check" : "link"} className="size-4" />
                <span>{copied ? "کپی شد" : "کپی لینک"}</span>
              </PrimaryButton>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">
              این لینک فقط یک‌بار قابل استفاده است و تا ۷۲ ساعت دیگر معتبر خواهد بود.
            </p>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <PrimaryButton type="button" onClick={onClose}>
              متوجه شدم
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </Modal>
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
  const [role, setRole] = useState<AccountRole>(initial?.role ?? "unit_media");
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
            {initial?.role === "unit_manager" ? (
              <option value="unit_manager" disabled>
                {roleLabels.unit_manager} — این نقش دیگر قابل انتخاب نیست
              </option>
            ) : null}
            {assignableRoleOptions.map(({ value, label }) => (
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
          className="size-5 rounded border-slate-300 accent-blue-600"
        />
      </label>

      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
