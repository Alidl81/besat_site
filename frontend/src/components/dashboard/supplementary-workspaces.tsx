"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { PanelIcon, type PanelIconName } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type { PanelSettings } from "@/types/panel-api";

const iconNames = new Set<PanelIconName>([
  "albums", "bell", "building", "calendar", "chart", "check", "children",
  "clipboard", "dashboard", "document", "download", "edit", "eye", "file",
  "filter", "globe", "heart", "image", "link", "mail", "media", "megaphone",
  "message", "more", "news", "plus", "profile", "programs", "registration",
  "review", "search", "services", "settings", "staff", "students", "trash",
  "units", "users", "warning",
]);

function icon(value: string): PanelIconName {
  return iconNames.has(value as PanelIconName) ? value as PanelIconName : "services";
}

export function ServicesWorkspace({ parent = false }: { parent?: boolean }) {
  const request = usePanelRequest(() => panelService.services(parent), [parent]);
  if (request.loading) return <PanelLoading label="در حال دریافت سرویس‌ها..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data?.length) return <PanelEmpty title="سرویسی برای این نقش فعال نشده است." />;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {request.data.map((service) => (
        <article key={service.id} className="panel-card flex min-h-52 flex-col">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#eef4fb] text-[#1760a9]"><PanelIcon name={icon(service.icon)} className="size-6" /></span>
          <h2 className="mt-5 text-base font-black text-[#172b43]">{service.title}</h2>
          {service.description ? <p className="mt-2 flex-1 text-xs font-bold leading-7 text-slate-500">{service.description}</p> : <span className="flex-1" />}
          <a href={service.url} target={service.is_external ? "_blank" : undefined} rel={service.is_external ? "noreferrer" : undefined} className="panel-outline-button mt-5">ورود به سرویس</a>
        </article>
      ))}
    </section>
  );
}

export function ManagementReportsWorkspace() {
  const request = usePanelRequest(() => panelService.reports(), []);
  const [error, setError] = useState<string | null>(null);
  if (request.loading) return <PanelLoading label="در حال محاسبه گزارش‌ها..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data) return <PanelEmpty title="گزارشی از بک‌اند دریافت نشد." />;

  async function download() {
    setError(null);
    try {
      const result = await panelService.exportReport();
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = decodeURIComponent(result.filename ?? "school-report.xlsx");
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {request.data.metrics.map((metric) => <article key={metric.key} className="panel-card"><span className="flex size-10 items-center justify-center rounded-full bg-[#eef4fb] text-[#1760a9]"><PanelIcon name={icon(metric.icon)} className="size-5" /></span><p className="mt-4 text-xs font-black text-slate-500">{metric.title}</p><b className="mt-2 block text-3xl text-[#172b43]">{metric.value ?? "—"}</b>{metric.detail ? <p className="mt-2 text-xs text-slate-500">{metric.detail}</p> : null}</article>)}
      </section>
      <section className="panel-card">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-black text-[#172b43]">گزارش عملکرد واحدها</h2><button type="button" onClick={() => void download()} className="panel-secondary-button"><PanelIcon name="download" className="size-4" />دریافت خروجی</button></header>
        {request.data.units.length ? <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="panel-table min-w-[48rem]"><thead><tr><th>واحد آموزشی</th><th>دانش‌آموزان</th><th>کادر</th><th>ثبت‌نام جدید</th><th>محتوای منتشرشده</th><th>وضعیت</th></tr></thead><tbody>{request.data.units.map((unit) => <tr key={unit.id}><td className="font-black text-[#172b43]">{unit.title}</td><td>{unit.students_count}</td><td>{unit.staff_count}</td><td>{unit.new_registrations_count}</td><td>{unit.published_content_count}</td><td><span className={`panel-status ${unit.is_active ? "is-success" : "is-danger"}`}>{unit.is_active ? "فعال" : "غیرفعال"}</span></td></tr>)}</tbody></table></div> : <PanelEmpty title="داده‌ای برای واحدها وجود ندارد." />}
      </section>
    </div>
  );
}

export function SettingsWorkspace() {
  const request = usePanelRequest(() => panelService.settings(), []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (request.loading) return <PanelLoading label="در حال دریافت تنظیمات..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data) return <PanelEmpty title="تنظیمات از بک‌اند دریافت نشد." />;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Partial<PanelSettings> = {
      school_name: String(form.get("school_name") ?? ""),
      current_academic_year_id: String(form.get("current_academic_year_id") ?? "") || null,
      default_unit_id: String(form.get("default_unit_id") ?? "") || null,
      notify_new_registration: form.get("notify_new_registration") === "on",
      show_published_on_home: form.get("show_published_on_home") === "on",
      autosave_forms: form.get("autosave_forms") === "on",
      internal_messages_enabled: form.get("internal_messages_enabled") === "on",
    };
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await panelService.updateSettings(payload);
      setMessage("تنظیمات با موفقیت ذخیره شد.");
      request.reload();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel-card space-y-5"><h2 className="text-base font-black text-[#172b43]">اطلاعات عمومی مجموعه</h2><label><span className="panel-field-label">نام مجموعه</span><input name="school_name" defaultValue={request.data.school_name} className="panel-input" required /></label><label><span className="panel-field-label">واحد پیش‌فرض</span><select name="default_unit_id" defaultValue={request.data.default_unit_id ?? ""} className="panel-select"><option value="">بدون واحد پیش‌فرض</option>{request.data.units.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span className="panel-field-label">سال تحصیلی جاری</span><select name="current_academic_year_id" defaultValue={request.data.current_academic_year_id ?? ""} className="panel-select"><option value="">انتخاب کنید</option>{request.data.academic_years.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
        <div className="panel-card"><h2 className="text-base font-black text-[#172b43]">تنظیمات سامانه</h2><div className="mt-5 divide-y divide-slate-100">{[["notify_new_registration", "ارسال اعلان برای ثبت‌نام جدید", request.data.notify_new_registration], ["show_published_on_home", "نمایش محتوای منتشرشده در صفحه اصلی", request.data.show_published_on_home], ["autosave_forms", "ذخیره خودکار فرم‌ها", request.data.autosave_forms], ["internal_messages_enabled", "فعال‌بودن پیام‌های داخلی", request.data.internal_messages_enabled]].map(([name, label, checked]) => <label key={String(name)} className="flex cursor-pointer items-center justify-between py-4 text-sm font-black text-[#40556b]"><span>{String(label)}</span><input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} className="size-4 accent-[#d98a12]" /></label>)}</div></div>
      </section>
      <button disabled={saving} type="submit" className="panel-primary-button">{saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}</button>
    </form>
  );
}

export function ParentRegistrationWorkspace() {
  const request = usePanelRequest(() => panelService.parentRegistrations(), []);
  if (request.loading) return <PanelLoading label="در حال دریافت پرونده‌های ثبت‌نام..." />;
  if (request.error) return <PanelError message={request.error} onRetry={request.reload} />;
  if (!request.data?.length) return <PanelEmpty title="فرایند ثبت‌نام فعالی وجود ندارد." />;

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {request.data.map((registration) => <article key={registration.id} className="panel-card"><span className="flex size-12 items-center justify-center rounded-full bg-[#edf8ef] text-emerald-600"><PanelIcon name="registration" className="size-6" /></span><h2 className="mt-4 text-lg font-black text-[#172b43]">ثبت‌نام {registration.child.full_name}</h2><p className="mt-2 text-xs font-bold text-slate-500">{registration.academic_year?.title ?? "سال تحصیلی ثبت نشده است"} · {registration.status}</p><div className="mt-5 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between text-xs font-black"><span>پیشرفت پرونده</span><span>{registration.progress_percent}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${registration.progress_percent}%` }} /></div></div><ol className="mt-5 space-y-3">{registration.steps.map((step, index) => <li key={step.id} className="flex items-center gap-3 text-xs font-bold text-slate-600"><span className={`flex size-7 items-center justify-center rounded-full ${step.status === "complete" ? "bg-emerald-100 text-emerald-600" : step.status === "current" ? "bg-amber-100 text-amber-700" : "bg-slate-100"}`}>{step.status === "complete" ? <PanelIcon name="check" className="size-4" /> : index + 1}</span>{step.title}</li>)}</ol>{registration.next_action_url ? <Link href={registration.next_action_url} className="panel-primary-button mt-5">ادامه تکمیل پرونده</Link> : null}</article>)}
    </section>
  );
}

export function ProfileShortcut({ href }: { href: string }) {
  return <Link href={href} className="panel-outline-button">مشاهده پروفایل</Link>;
}
