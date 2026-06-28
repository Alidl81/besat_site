"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, TextArea, TextInput } from "@/components/crud/crud-ui";
import { departmentsRepository } from "@/lib/data/repositories";
import type { DepartmentRecord, WithoutSystemFields } from "@/lib/data/domain-types";

function slugify(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "").slice(0, 80);
}

export function DepartmentsManager() {
  const columns: Column<DepartmentRecord>[] = [
    { key: "title", header: "نام دپارتمان", render: (i) => <span className="font-black">{i.title}</span> },
    {
      key: "desc",
      header: "توضیحات",
      render: (i) => <span className="block max-w-md truncate text-slate-500">{i.description ?? "—"}</span>,
    },
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
    <CrudManager<DepartmentRecord>
      title="مدیریت دپارتمان‌ها"
      description="دپارتمان‌ها و گروه‌های تخصصی مجموعه را مدیریت کنید."
      repository={departmentsRepository}
      columns={columns}
      emptyText="دپارتمانی ثبت نشده است."
      addLabel="دپارتمان جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <DepartmentForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function DepartmentForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: DepartmentRecord | null;
  onSubmit: (data: WithoutSystemFields<DepartmentRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      slug: initial?.slug || slugify(title) || `dep-${Date.now()}`,
      description: description || null,
      cover_image: coverImage || null,
      order: Number(order) || 0,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نام دپارتمان" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="توضیحات">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="تصویر کاور (URL)">
          <TextInput value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="/images/..." />
        </Field>
        <Field label="ترتیب نمایش">
          <TextInput type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="text-sm font-black text-[#062452]">دپارتمان فعال باشد</span>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 rounded border-slate-300 accent-emerald-600" />
      </label>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
