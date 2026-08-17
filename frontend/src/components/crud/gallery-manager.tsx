"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, GhostButton, Select, StatusBadge, TextArea, TextInput } from "@/components/crud/crud-ui";
import { MediaPickerDialog } from "@/components/cms/media-picker-dialog";
import { GalleryLightbox } from "@/components/gallery/gallery-lightbox";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { galleryRepository, unitsRepository } from "@/lib/data/repositories";
import { panelService } from "@/services/panel-service";
import { runGalleryWorkflowAction, type GalleryWorkflowAction } from "@/services/gallery-cms-service";
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

const WORKFLOW_ACTIONS: {
  action: GalleryWorkflowAction;
  label: string;
  from: PublishStatus[];
  adminOnly?: boolean;
}[] = [
  { action: "submit-review", label: "ارسال برای بررسی", from: ["draft", "rejected"] },
  { action: "approve", label: "تأیید", from: ["waiting_review"] },
  { action: "reject", label: "رد", from: ["waiting_review", "approved"] },
  { action: "publish", label: "انتشار", from: ["approved"], adminOnly: true },
  { action: "archive", label: "آرشیو", from: ["draft", "waiting_review", "approved", "published", "rejected"] },
  { action: "restore", label: "بازگردانی به پیش‌نویس", from: ["archived"] },
];

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
  const [managerKey, setManagerKey] = useState(0);
  const [previewItem, setPreviewItem] = useState<GalleryItemRecord | null>(null);
  const bumpManagerKey = () => setManagerKey((current) => current + 1);

  const columns: Column<GalleryItemRecord>[] = [
    {
      key: "image",
      header: "مدیا",
      render: (i) => <MediaThumb src={i.image} title={i.title} />,
    },
    {
      key: "title",
      header: "عنوان",
      render: (i) => (
        <span className="font-black">
          {i.title}
          {i.is_featured ? <span className="mr-1.5 text-amber-500" title="ویژه">★</span> : null}
          {!i.is_active ? <span className="mr-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">غیرفعال</span> : null}
        </span>
      ),
    },
    { key: "album", header: "آلبوم", render: (i) => <span className="text-slate-500">{i.album ?? "—"}</span> },
    { key: "status", header: "وضعیت", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <div className="space-y-6">
      <GalleryReorderPanel unitId={unitId} refreshSignal={managerKey} onReordered={bumpManagerKey} />

      <GalleryBatchUploader unitId={unitId} onUploaded={bumpManagerKey} />

      <CrudManager<GalleryItemRecord>
        key={managerKey}
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
            initial={initial}
            onSubmit={onSubmit}
            onCancel={onCancel}
            submitting={submitting}
          />
        )}
        rowActions={(item, { reload }) => (
          <GalleryRowActions
            item={item}
            canPublish={canPublish}
            reload={reload}
            onPreview={() => setPreviewItem(item)}
          />
        )}
      />

      {previewItem ? (
        <GalleryLightbox
          items={[{ id: previewItem.id, src: previewItem.image, title: previewItem.title, caption: previewItem.caption ?? previewItem.summary }]}
          index={0}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}
    </div>
  );
}

function GalleryRowActions({
  item,
  canPublish,
  reload,
  onPreview,
}: {
  item: GalleryItemRecord;
  canPublish: boolean;
  reload: () => Promise<void>;
  onPreview: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableActions = WORKFLOW_ACTIONS.filter(
    (entry) => entry.from.includes(item.status) && (!entry.adminOnly || canPublish),
  );

  async function handleAction(action: GalleryWorkflowAction) {
    setBusy(true);
    setError(null);
    try {
      await runGalleryWorkflowAction(String(item.id), action);
      await reload();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" title={error ?? undefined}>
      <button
        type="button"
        onClick={onPreview}
        className="panel-icon-button"
        aria-label={`پیش‌نمایش ${item.title}`}
      >
        <PanelIcon name="eye" className="size-4" />
      </button>
      {availableActions.map((entry) => (
        <button
          key={entry.action}
          type="button"
          disabled={busy}
          onClick={() => handleAction(entry.action)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {entry.label}
        </button>
      ))}
      {error ? <span className="text-xs font-bold text-rose-600">{error}</span> : null}
    </div>
  );
}

function GalleryForm({
  unitId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  unitId: string | null;
  initial: GalleryItemRecord | null;
  onSubmit: (data: WithoutSystemFields<GalleryItemRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [album, setAlbum] = useState(initial?.album ?? "");
  const [altText, setAltText] = useState(initial?.alt_text ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [eventDate, setEventDate] = useState(initial?.event_date ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [scope, setScope] = useState<GalleryItemRecord["scope"]>(
    initial?.scope ?? (unitId ? "unit" : "school"),
  );
  const [selectedUnitId, setSelectedUnitId] = useState(initial?.unit_id ?? unitId ?? "");
  const [units, setUnits] = useState<SchoolUnitRecord[]>([]);
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
      summary: summary || null,
      image,
      album: album || null,
      alt_text: altText || null,
      caption: caption || null,
      event_date: eventDate || null,
      is_featured: isFeatured,
      is_active: isActive,
      order: initial?.order ?? 0,
      scope,
      unit_id: scope === "unit" ? (unitId ?? selectedUnitId) : null,
      status: initial?.status ?? "draft",
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="عنوان مدیا" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>

        <Field label="توضیح کوتاه" required>
          <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="برای انتشار مدیا الزامی است." />
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
          <Field label="متن جایگزین (Alt)">
            <TextInput value={altText} onChange={(e) => setAltText(e.target.value)} />
          </Field>
          <Field label="کپشن">
            <TextInput value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="آلبوم">
            <TextInput value={album} onChange={(e) => setAlbum(e.target.value)} />
          </Field>
          <Field label="تاریخ رویداد">
            <TextInput type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <span className="text-sm font-black text-[#062452]">مدیای ویژه</span>
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <span className="text-sm font-black text-[#062452]">فعال</span>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
          </label>
        </div>

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

function GalleryReorderPanel({
  unitId,
  refreshSignal,
  onReordered,
}: {
  unitId: string | null;
  refreshSignal: number;
  onReordered: () => void;
}) {
  const { data, loading, reload } = usePanelRequest(() => galleryRepository.list(), [refreshSignal]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const items = (data ?? [])
    .filter((item) => (unitId ? item.unit_id === unitId || item.scope === "school" : true))
    .slice()
    .sort((a, b) => a.order - b.order);

  async function handleMove(index: number, direction: -1 | 1) {
    const neighborIndex = index + direction;
    if (neighborIndex < 0 || neighborIndex >= items.length) return;
    const current = items[index];
    const neighbor = items[neighborIndex];
    setBusyId(String(current.id));
    try {
      await Promise.all([
        galleryRepository.update(String(current.id), { order: neighbor.order }),
        galleryRepository.update(String(neighbor.id), { order: current.order }),
      ]);
      await reload();
      onReordered();
    } finally {
      setBusyId(null);
    }
  }

  if (loading || items.length < 2) return null;

  return (
    <div className="panel-card">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-right"
      >
        <div>
          <h2 className="text-lg font-black text-[#062452]">ترتیب نمایش</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">ترتیب نمایش مدیا در گالری عمومی را با دکمه‌های بالا/پایین تنظیم کنید.</p>
        </div>
        <PanelIcon name="chevron" className={`size-5 shrink-0 transition ${expanded ? "-rotate-90" : "rotate-0"}`} />
      </button>

      {expanded ? (
        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <MediaThumb src={item.image} title={item.title} className="size-10 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1 truncate text-sm font-black text-[#062452]">{item.title}</span>
              <StatusBadge status={item.status} />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={busyId === String(item.id) || index === 0}
                  onClick={() => handleMove(index, -1)}
                  className="panel-icon-button disabled:opacity-30"
                  aria-label="جابه‌جایی به بالا"
                >
                  <PanelIcon name="chevron" className="size-4 rotate-90" />
                </button>
                <button
                  type="button"
                  disabled={busyId === String(item.id) || index === items.length - 1}
                  onClick={() => handleMove(index, 1)}
                  className="panel-icon-button disabled:opacity-30"
                  aria-label="جابه‌جایی به پایین"
                >
                  <PanelIcon name="chevron" className="size-4 -rotate-90" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GalleryBatchUploader({
  unitId,
  onUploaded,
}: {
  unitId: string | null;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: fileList.length });

    for (const [index, file] of fileList.entries()) {
      try {
        const asset = await panelService.uploadMedia(file, {
          unitId: unitId ?? undefined,
          title: file.name,
        });
        await galleryRepository.create({
          title: asset.title || file.name,
          summary: null,
          image: asset.url,
          album: null,
          alt_text: null,
          caption: null,
          event_date: null,
          is_featured: false,
          is_active: true,
          order: 0,
          scope: unitId ? "unit" : "school",
          unit_id: unitId ?? null,
          status: "draft",
        });
      } catch (reason) {
        setError(getApiErrorMessage(reason));
      }
      setProgress({ done: index + 1, total: fileList.length });
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
  }

  return (
    <div className="panel-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#062452]">آپلود دسته‌ای</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">چند تصویر را همزمان انتخاب کنید تا به‌صورت پیش‌نویس در گالری ثبت شوند.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <GhostButton type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading && progress ? `در حال بارگذاری… (${progress.done}/${progress.total})` : "انتخاب تصاویر"}
        </GhostButton>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-black text-rose-600">{error}</p> : null}
    </div>
  );
}
