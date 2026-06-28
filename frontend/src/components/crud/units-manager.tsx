"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Select, TextArea, TextInput } from "@/components/crud/crud-ui";
import { unitsRepository } from "@/lib/data/repositories";
import type {
  SchoolUnitRecord,
  UnitGender,
  UnitKind,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

const kindLabels: Record<UnitKind, string> = {
  preschool: "پیش‌دبستانی",
  elementary: "دبستان",
  middle_school: "متوسطه اول",
  high_school: "دبیرستان",
};

const genderLabels: Record<UnitGender, string> = {
  boys: "پسرانه",
  girls: "دخترانه",
  mixed: "مختلط",
};

function slugify(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "").slice(0, 80);
}

export function UnitsManager() {
  const columns: Column<SchoolUnitRecord>[] = [
    { key: "title", header: "نام واحد", render: (i) => <span className="font-black">{i.title}</span> },
    { key: "kind", header: "نوع", render: (i) => <span>{kindLabels[i.kind]}</span> },
    { key: "gender", header: "جنسیت", render: (i) => <span>{genderLabels[i.gender]}</span> },
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
    <CrudManager<SchoolUnitRecord>
      title="مدیریت واحدها"
      description="واحدهای آموزشی مجموعه را ایجاد، ویرایش و مدیریت کنید."
      repository={unitsRepository}
      columns={columns}
      emptyText="واحدی ثبت نشده است."
      addLabel="واحد جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <UnitForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function UnitForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: SchoolUnitRecord | null;
  onSubmit: (data: WithoutSystemFields<SchoolUnitRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<UnitKind>(initial?.kind ?? "elementary");
  const [gender, setGender] = useState<UnitGender>(initial?.gender ?? "boys");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      slug: initial?.slug || slugify(title) || `unit-${Date.now()}`,
      kind,
      gender,
      description: description || null,
      cover_image: coverImage || null,
      is_active: isActive,
      order: Number(order) || 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نام واحد" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="نوع واحد">
          <Select value={kind} onChange={(e) => setKind(e.target.value as UnitKind)}>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="جنسیت">
          <Select value={gender} onChange={(e) => setGender(e.target.value as UnitGender)}>
            {Object.entries(genderLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>

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
        <span className="text-sm font-black text-[#062452]">واحد فعال باشد</span>
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
