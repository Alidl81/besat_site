"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Select, StatusBadge, TextInput } from "@/components/crud/crud-ui";
import { galleryRepository } from "@/lib/data/repositories";
import type {
  GalleryItemRecord,
  PublishStatus,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

type GalleryManagerProps = {
  unitId?: string | null;
  canPublish?: boolean;
};

export function GalleryManager({ unitId = null, canPublish = true }: GalleryManagerProps) {
  const columns: Column<GalleryItemRecord>[] = [
    {
      key: "image",
      header: "تصویر",
      render: (i) =>
        i.image ? (
          <img src={i.image} alt={i.title} className="size-12 rounded-xl object-cover" />
        ) : (
          <div className="size-12 rounded-xl bg-slate-100" />
        ),
    },
    { key: "title", header: "عنوان", render: (i) => <span className="font-black">{i.title}</span> },
    { key: "album", header: "آلبوم", render: (i) => <span className="text-slate-500">{i.album ?? "—"}</span> },
    { key: "status", header: "وضعیت", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <CrudManager<GalleryItemRecord>
      title="مدیریت گالری"
      description="تصاویر گالری را افزوده و مدیریت کنید."
      repository={galleryRepository}
      filter={(item) => {
        if (unitId) return item.unit_id === unitId || item.scope === "school";
        return true;
      }}
      columns={columns}
      emptyText="تصویری ثبت نشده است."
      addLabel="تصویر جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <GalleryForm
          unitId={unitId}
          canPublish={canPublish}
          initial={initial}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={submitting}
        />
      )}
    />
  );
}

function GalleryForm({
  unitId,
  canPublish,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  unitId: string | null;
  canPublish: boolean;
  initial: GalleryItemRecord | null;
  onSubmit: (data: WithoutSystemFields<GalleryItemRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [album, setAlbum] = useState(initial?.album ?? "");
  const [scope, setScope] = useState<GalleryItemRecord["scope"]>(
    initial?.scope ?? (unitId ? "unit" : "school"),
  );
  const [status, setStatus] = useState<PublishStatus>(initial?.status ?? "draft");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      image,
      album: album || null,
      scope,
      unit_id: scope === "unit" ? unitId : null,
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="عنوان تصویر" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="نشانی تصویر (URL)" required>
        <TextInput value={image} onChange={(e) => setImage(e.target.value)} required placeholder="/images/... یا URL کامل" />
      </Field>
      {image ? (
        <img src={image} alt="پیش‌نمایش" className="h-40 w-full rounded-2xl object-cover" />
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="آلبوم">
          <TextInput value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="نام آلبوم (اختیاری)" />
        </Field>
        <Field label="وضعیت">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PublishStatus)}>
            <option value="draft">پیش‌نویس</option>
            {canPublish ? <option value="published">منتشرشده</option> : <option value="waiting_review">در انتظار بررسی</option>}
          </Select>
        </Field>
      </div>
      {!unitId ? (
        <Field label="دامنه">
          <Select value={scope} onChange={(e) => setScope(e.target.value as GalleryItemRecord["scope"])}>
            <option value="school">کل مدرسه</option>
            <option value="unit">واحد</option>
          </Select>
        </Field>
      ) : null}
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
