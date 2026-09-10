"use client";

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Modal, PrimaryButton, Select, StatusBadge, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      render: (i) => <StatusBadge status={i.is_active ? "active" : "inactive"} />,
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
        rowLabel={(i) => i.full_name}
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
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    full_name?: string;
    username?: string;
    email?: string;
  }>({});
  const fullNameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const fullNameErrorId = useId();
  const usernameErrorId = useId();
  const emailErrorId = useId();

  useEffect(() => {
    // Internal/dev-only units (e.g. the seeded dev-accounts test unit) are
    // plumbing for internal test accounts, not a real unit a general
    // manager should ever assign a genuine staff member to.
    unitsRepository.list().then((items) => setUnits(items.filter((unit) => !unit.is_internal)));
  }, []);

  const needsUnit = role === "unit_manager" || role === "unit_media";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const nextErrors: typeof fieldErrors = {};
    if (!fullName.trim()) nextErrors.full_name = "نام و نام خانوادگی الزامی است.";
    if (!username.trim()) nextErrors.username = "نام کاربری الزامی است.";
    if (email && !EMAIL_PATTERN.test(email)) nextErrors.email = "ایمیل واردشده معتبر نیست.";

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      (nextErrors.full_name ? fullNameRef : nextErrors.username ? usernameRef : emailRef).current?.focus();
      return;
    }

    try {
      await onSubmit({
        full_name: fullName,
        username,
        email: email || null,
        phone: phone || null,
        role,
        unit_id: needsUnit ? unitId || null : null,
        is_active: isActive,
      });
    } catch (reason) {
      if (reason instanceof ApiError && reason.fieldErrors.username?.[0]) {
        setFieldErrors({ username: reason.fieldErrors.username[0] });
      }
      setFormError(getApiErrorMessage(reason));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError ? (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
          {formError}
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="نام و نام خانوادگی" required>
          <TextInput
            ref={fullNameRef}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, full_name: undefined }));
            }}
            required
            aria-invalid={Boolean(fieldErrors.full_name)}
            aria-describedby={fieldErrors.full_name ? fullNameErrorId : undefined}
          />
          {fieldErrors.full_name ? (
            <p id={fullNameErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.full_name}
            </p>
          ) : null}
        </Field>
        <Field label="نام کاربری" required>
          <TextInput
            ref={usernameRef}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((prev) => ({ ...prev, username: undefined }));
            }}
            required
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? usernameErrorId : undefined}
          />
          {fieldErrors.username ? (
            <p id={usernameErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.username}
            </p>
          ) : null}
        </Field>
        <Field label="ایمیل">
          <TextInput
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          />
          {fieldErrors.email ? (
            <p id={emailErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
              {fieldErrors.email}
            </p>
          ) : null}
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
