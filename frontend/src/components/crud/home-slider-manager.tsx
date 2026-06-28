"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, TextInput } from "@/components/crud/crud-ui";
import { homeSlidesRepository } from "@/lib/data/repositories";
import type { HomeSlideRecord, WithoutSystemFields } from "@/lib/data/domain-types";

export function HomeSliderManager() {
  const columns: Column<HomeSlideRecord>[] = [
    {
      key: "image",
      header: "تصویر",
      render: (i) =>
        i.image ? (
          <img src={i.image} alt={i.title ?? "اسلاید"} className="h-12 w-20 rounded-xl object-cover" />
        ) : (
          <div className="h-12 w-20 rounded-xl bg-slate-100" />
        ),
    },
    { key: "title", header: "عنوان", render: (i) => <span className="font-black">{i.title ?? "—"}</span> },
    { key: "order", header: "ترتیب", render: (i) => <span>{i.order}</span> },
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
    <CrudManager<HomeSlideRecord>
      title="مدیریت اسلایدر صفحه اصلی"
      description="اسلایدهای صفحه اصلی سایت را مدیریت کنید."
      repository={homeSlidesRepository}
      columns={columns}
      emptyText="اسلایدی ثبت نشده است."
      addLabel="اسلاید جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <SlideForm initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function SlideForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: HomeSlideRecord | null;
  onSubmit: (data: WithoutSystemFields<HomeSlideRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [image, setImage] = useState(initial?.image ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [href, setHref] = useState(initial?.href ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      image,
      title: title || null,
      subtitle: subtitle || null,
      href: href || null,
      order: Number(order) || 0,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نشانی تصویر (URL)" required>
        <TextInput value={image} onChange={(e) => setImage(e.target.value)} required placeholder="/images/home-slider/..." />
      </Field>
      {image ? <img src={image} alt="پیش‌نمایش" className="aspect-[16/7] w-full rounded-2xl object-cover" /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="عنوان (اختیاری)">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="توضیح کوتاه (اختیاری)">
          <TextInput value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </Field>
        <Field label="لینک (اختیاری)">
          <TextInput value={href} onChange={(e) => setHref(e.target.value)} placeholder="/news یا URL" />
        </Field>
        <Field label="ترتیب نمایش">
          <TextInput type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="text-sm font-black text-[#062452]">اسلاید فعال (نمایش در سایت)</span>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 rounded border-slate-300 accent-emerald-600" />
      </label>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
