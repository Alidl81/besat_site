"use client";

import { type FormEvent, useRef, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, StatusBadge, TextArea, TextInput } from "@/components/crud/crud-ui";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  homeSlidesRepository,
  staffRepository,
  staticPagesRepository,
} from "@/lib/data/repositories";
import type {
  HomeSlideRecord,
  StaffRecord,
  StaticPageRecord,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

function slugify(value: string) {
  return value.trim().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "").slice(0, 80);
}

export function HomeSliderWorkspace() {
  const columns: Column<HomeSlideRecord>[] = [
    { key: "title", header: "عنوان", render: (item) => <span className="font-black">{item.title || "بدون عنوان"}</span> },
    { key: "order", header: "ترتیب", render: (item) => item.order },
    { key: "status", header: "وضعیت", render: (item) => <StatusBadge status={item.is_active ? "active" : "inactive"} /> },
  ];
  return (
    <CrudManager<HomeSlideRecord>
      title="اسلایدهای صفحه اصلی"
      description="عنوان، تصویر و ترتیب نمایش اسلایدهای صفحه اصلی را مدیریت کنید."
      repository={homeSlidesRepository}
      columns={columns}
      emptyText="اسلایدی ثبت نشده است."
      addLabel="اسلاید جدید"
      rowLabel={(item) => item.title || "اسلاید بدون عنوان"}
      renderForm={(props) => <HomeSlideForm {...props} />}
    />
  );
}

function HomeSlideForm({ initial, onSubmit, onCancel, submitting }: {
  initial: HomeSlideRecord | null;
  onSubmit: (data: WithoutSystemFields<HomeSlideRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [href, setHref] = useState(initial?.href ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isActive && !image.trim()) {
      setError("برای فعال بودن اسلاید، نشانی تصویر الزامی است.");
      imageRef.current?.focus();
      return;
    }
    try {
      await onSubmit({ title: title || null, subtitle: subtitle || null, image, href: href || null, is_active: isActive, order: Number(order) || 0 });
    } catch (reason) { setError(getApiErrorMessage(reason)); }
  }
  return <form onSubmit={submit} noValidate className="space-y-5">
    {error ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
    <Field label="عنوان"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <Field label="زیرعنوان"><TextArea value={subtitle} onChange={(event) => setSubtitle(event.target.value)} rows={3} /></Field>
    <Field label="نشانی تصویر" required><TextInput ref={imageRef} value={image} onChange={(event) => setImage(event.target.value)} placeholder="/media/..." /></Field>
    <div className="grid gap-5 md:grid-cols-2"><Field label="پیوند مقصد"><TextInput dir="ltr" value={href} onChange={(event) => setHref(event.target.value)} /></Field><Field label="ترتیب نمایش"><TextInput type="number" value={order} onChange={(event) => setOrder(Number(event.target.value))} /></Field></div>
    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black"><span>اسلاید فعال باشد</span><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-5 accent-blue-600" /></label>
    <FormActions onCancel={onCancel} submitting={submitting} />
  </form>;
}

export function StaffWorkspace() {
  const columns: Column<StaffRecord>[] = [
    { key: "name", header: "نام", render: (item) => <span className="font-black">{item.full_name}</span> },
    { key: "role", header: "عنوان نقش", render: (item) => item.role_title || "—" },
    { key: "phone", header: "تماس", render: (item) => item.phone || "—" },
  ];
  return <CrudManager<StaffRecord> title="کادر مدرسه" description="اعضای کادر و اطلاعات تماس آن‌ها را مدیریت کنید." repository={staffRepository} columns={columns} emptyText="عضوی برای نمایش ثبت نشده است." addLabel="عضو جدید" rowLabel={(item) => item.full_name} renderForm={(props) => <StaffForm {...props} />} />;
}

function StaffForm({ initial, onSubmit, onCancel, submitting }: {
  initial: StaffRecord | null;
  onSubmit: (data: WithoutSystemFields<StaffRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.full_name ?? "");
  const [roleTitle, setRoleTitle] = useState(initial?.role_title ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!name.trim()) { setError("نام عضو کادر الزامی است."); return; }
    try {
      await onSubmit({ full_name: name, role_title: roleTitle || null, phone: phone || null, unit_id: unitId || null, ...(unitId ? { scope: "unit" } : { scope: "school" }) } as WithoutSystemFields<StaffRecord>);
    } catch (reason) { setError(getApiErrorMessage(reason)); }
  }
  return <form onSubmit={submit} noValidate className="space-y-5">
    {error ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
    <Field label="نام و نام خانوادگی" required><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="عنوان نقش"><TextInput value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="مثلاً معلم ریاضی" /></Field>
    <div className="grid gap-5 md:grid-cols-2"><Field label="واحد (اختیاری)"><TextInput value={unitId} onChange={(event) => setUnitId(event.target.value)} inputMode="numeric" placeholder="شناسه واحد" /></Field><Field label="شماره تماس"><TextInput dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field></div>
    <FormActions onCancel={onCancel} submitting={submitting} />
  </form>;
}

export function StaticPagesWorkspace() {
  const columns: Column<StaticPageRecord>[] = [
    { key: "title", header: "عنوان", render: (item) => <span className="font-black">{item.title || "بدون عنوان"}</span> },
    { key: "slug", header: "اسلاگ", render: (item) => <span dir="ltr">{item.slug}</span> },
    { key: "status", header: "وضعیت", render: (item) => <StatusBadge status={item.is_published ? "published" : "inactive"} /> },
  ];
  return <CrudManager<StaticPageRecord> title="صفحه درباره ما" description="فقط صفحه از پیش تعریف‌شده درباره ما را از یک مسیر کنترل‌شده و قابل ویرایش مدیریت کنید." repository={staticPagesRepository} columns={columns} emptyText="صفحه درباره ما ثبت نشده است." addLabel="ویرایش صفحه" canCreate={false} rowLabel={(item) => item.title || item.slug} renderForm={(props) => <StaticPageForm {...props} />} />;
}

function StaticPageForm({ initial, onSubmit, onCancel, submitting }: {
  initial: StaticPageRecord | null;
  onSubmit: (data: WithoutSystemFields<StaticPageRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "about");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body_html ?? "");
  const [meta, setMeta] = useState(initial?.meta_description ?? "");
  const [published, setPublished] = useState(initial?.is_published ?? true);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { await onSubmit({ slug: slug || slugify(title) || "about", title, body_html: body, meta_description: meta || null, is_published: published }); }
    catch (reason) { setError(getApiErrorMessage(reason)); }
  }
  return <form onSubmit={submit} noValidate className="space-y-5">
    {error ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
    <div className="grid gap-5 md:grid-cols-2"><Field label="اسلاگ" required><TextInput dir="ltr" value={slug} onChange={(event) => setSlug(event.target.value)} /></Field><Field label="عنوان" required><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field></div>
    <Field label="متن صفحه"><TextArea value={body} onChange={(event) => setBody(event.target.value)} rows={8} /></Field>
    <Field label="توضیح متا"><TextArea value={meta} onChange={(event) => setMeta(event.target.value)} rows={3} /></Field>
    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black"><span>صفحه منتشر باشد</span><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="size-5 accent-blue-600" /></label>
    <FormActions onCancel={onCancel} submitting={submitting} />
  </form>;
}
