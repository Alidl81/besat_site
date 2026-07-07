"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Select, StatusBadge, TextInput } from "@/components/crud/crud-ui";
import { MediaPickerDialog } from "@/components/cms/media-picker-dialog";
import { galleryRepository, unitsRepository } from "@/lib/data/repositories";
import type {
  GalleryItemRecord,
  PublishStatus,
  SchoolUnitRecord,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

type GalleryManagerProps = {
  unitId?: string | null;
  canPublish?: boolean;
};


function getMediaSourceLabel(src: string) {
  if (!src) return "No media selected";
  if (src.startsWith("data:image/")) return "تصویر انتخاب‌شده از سیستم";
  if (src.startsWith("data:video/")) return "ویدیوی انتخاب‌شده از سیستم";
  if (src.length <= 80) return src;

  return `${src.slice(0, 44)}...${src.slice(-20)}`;
}
function isVideoSource(src: string) {
  const normalized = src.toLowerCase();
  return (
    normalized.startsWith("data:video/") ||
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".ogg") ||
    normalized.includes(".mp4?") ||
    normalized.includes(".webm?") ||
    normalized.includes(".ogg?")
  );
}

function MediaThumb({
  src,
  title,
  className = "size-12 rounded-xl",
}: {
  src: string;
  title: string;
  className?: string;
}) {
  if (!src) {
    return <div className={`${className} bg-slate-100`} />;
  }

  if (isVideoSource(src)) {
    return (
      <video
        src={src}
        muted
        className={`${className} bg-slate-950 object-cover`}
      />
    );
  }

  return <img src={src} alt={title} className={`${className} object-cover`} />;
}

export function GalleryManager({ unitId = null, canPublish = true }: GalleryManagerProps) {
  const columns: Column<GalleryItemRecord>[] = [
    {
      key: "image",
      header: "مدیا",
      render: (i) => <MediaThumb src={i.image} title={i.title} />,
    },
    { key: "title", header: "عنوان", render: (i) => <span className="font-black">{i.title}</span> },
    { key: "album", header: "آلبوم", render: (i) => <span className="text-slate-500">{i.album ?? "—"}</span> },
    { key: "status", header: "وضعیت", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <CrudManager<GalleryItemRecord>
      title="مدیریت مدیا"
      description="عکس‌ها و ویدیوهای مورد نیاز سایت را افزوده و مدیریت کنید."
      repository={galleryRepository}
      filter={(item) => {
        if (unitId) return item.unit_id === unitId || item.scope === "school";
        return true;
      }}
      columns={columns}
      emptyText="مدیایی ثبت نشده است."
      addLabel="مدیای جدید"
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
  const [selectedUnitId, setSelectedUnitId] = useState(initial?.unit_id ?? unitId ?? "");
  const [units, setUnits] = useState<SchoolUnitRecord[]>([]);
  const [status, setStatus] = useState<PublishStatus>(initial?.status ?? "draft");
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  const isAdminScope = unitId === null;
  const needsUnitSelection = isAdminScope && scope === "unit";

  useEffect(() => {
    if (!isAdminScope) return;

    unitsRepository.list().then((items) => {
      const activeUnits = items
        .filter((item) => item.is_active)
        .sort((a, b) => a.order - b.order);

      setUnits(activeUnits);

      if (scope === "unit" && !selectedUnitId && activeUnits[0]) {
        setSelectedUnitId(activeUnits[0].id);
      }
    });
  }, [isAdminScope, scope, selectedUnitId]);

  function handleScopeChange(nextScope: GalleryItemRecord["scope"]) {
    setScope(nextScope);

    if (nextScope === "school") {
      setSelectedUnitId("");
      return;
    }

    if (nextScope === "unit" && unitId) {
      setSelectedUnitId(unitId);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (needsUnitSelection && !selectedUnitId) {
      return;
    }

    await onSubmit({
      title,
      image,
      album: album || null,
      scope,
      unit_id: scope === "unit" ? (unitId ?? selectedUnitId) : null,
      status,
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="عنوان مدیا" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>

        <Field label="مدیا" required>
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4">
            {image ? (
              <MediaThumb src={image} title={title || "مدیا"} className="h-48 w-full rounded-3xl" />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-sm font-bold text-slate-400">
                هنوز مدیایی انتخاب نشده است.
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-right">
                <p className="text-sm font-black text-[#062452]">
                  انتخاب عکس یا ویدیو
                </p>
                <p className="mt-1 break-all text-xs font-bold leading-6 text-slate-400" dir="ltr">
                  {getMediaSourceLabel(image)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMediaDialogOpen(true)}
                className="h-12 shrink-0 rounded-2xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d]"
              >
                انتخاب یا افزودن مدیا
              </button>
            </div>
          </div>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="آلبوم">
            <TextInput value={album} onChange={(e) => setAlbum(e.target.value)} />
          </Field>

          <Field label="وضعیت">
            <Select value={status} onChange={(e) => setStatus(e.target.value as PublishStatus)}>
              <option value="draft">پیش‌نویس</option>
              {canPublish ? <option value="published">منتشرشده</option> : <option value="waiting_review">در انتظار بررسی</option>}
            </Select>
          </Field>
        </div>

        {isAdminScope ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="دامنه">
              <Select value={scope} onChange={(e) => handleScopeChange(e.target.value as GalleryItemRecord["scope"])}>
                <option value="school">کل مجموعه</option>
                <option value="unit">واحد مشخص</option>
              </Select>
            </Field>

            {scope === "unit" ? (
              <Field label="واحد" required>
                <Select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  required
                >
                  <option value="">انتخاب واحد</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.title}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        ) : null}

        {needsUnitSelection && !selectedUnitId ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
            برای دامنه واحد، انتخاب واحد الزامی است.
          </p>
        ) : null}

        <FormActions onCancel={onCancel} submitting={submitting || !image || (needsUnitSelection && !selectedUnitId)} />
      </form>

      <MediaPickerDialog
        open={mediaDialogOpen}
        value={image}
        unitId={unitId ?? selectedUnitId}
        onSelect={setImage}
        onClose={() => setMediaDialogOpen(false)}
      />
    </>
  );
}