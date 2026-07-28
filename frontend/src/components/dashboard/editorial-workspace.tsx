"use client";

import type { JSONContent } from "@tiptap/core";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ContentBlockInserter } from "@/components/cms/content-block-inserter";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { RichEditor } from "@/components/editor/rich-editor";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { panelService } from "@/services/panel-service";
import type {
  ContentItem,
  ContentKind,
  ContentRevision,
  NamedOption,
} from "@/types/panel-api";
import type { AccountRole } from "@/lib/data/domain-types";
import type { PublishStatus } from "@/types/api";

type EditorialWorkspaceProps = {
  unitId?: string | null;
  authorRole: AccountRole;
  canPublish?: boolean;
  initialKind?: ContentKind | "all";
  reviewOnly?: boolean;
};

type EditorMode = "simple" | "advanced";
type Draft = {
  title: string;
  summary: string;
  bodyHtml: string;
  bodyJson: JSONContent | null;
  coverImageUrl: string;
  categoryId: string;
  kind: ContentKind;
  scope: "school" | "unit";
  scheduledAt: string;
};

const statusLabels: Record<PublishStatus, string> = {
  draft: "پیش‌نویس",
  waiting_review: "در صف بررسی",
  approved: "تأییدشده",
  scheduled: "زمان‌بندی‌شده",
  published: "منتشرشده",
  rejected: "ردشده",
};

const statusClasses: Record<PublishStatus, string> = {
  draft: "",
  waiting_review: "is-warning",
  approved: "is-info",
  scheduled: "is-info",
  published: "is-success",
  rejected: "is-danger",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function draftFrom(item: ContentItem | null, kind: ContentKind, unitId: string | null): Draft {
  return {
    title: item?.title ?? "",
    summary: item?.summary ?? "",
    bodyHtml: item?.body_html ?? "",
    bodyJson: (item?.body_json as JSONContent | null) ?? null,
    coverImageUrl: item?.cover_image_url ?? "",
    categoryId: item?.category ? String(item.category.id) : "",
    kind: item?.kind ?? kind,
    scope: item?.scope ?? (unitId ? "unit" : "school"),
    scheduledAt: item?.scheduled_at?.slice(0, 16) ?? "",
  };
}

function ContentStatus({ status }: { status: PublishStatus }) {
  return <span className={`panel-status ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

function EditorialEditor({
  open,
  mode,
  item,
  defaultKind,
  unitId,
  canPublish,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: EditorMode;
  item: ContentItem | null;
  defaultKind: ContentKind;
  unitId: string | null;
  canPublish: boolean;
  onClose: () => void;
  onSaved: (item: ContentItem) => void;
}) {
  const [currentItem, setCurrentItem] = useState(item);
  const [draft, setDraft] = useState(() => draftFrom(item, defaultKind, unitId));
  const [categories, setCategories] = useState<NamedOption[]>([]);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panelService.contentCategories().then(setCategories).catch(() => setCategories([]));
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!currentItem) return;
    panelService.contentRevisions(currentItem.id).then(setRevisions).catch(() => setRevisions([]));
  }, [currentItem]);

  const payload = useMemo(
    () => ({
      kind: draft.kind,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      body_html: draft.bodyHtml,
      body_json: draft.bodyJson,
      cover_image_url: draft.coverImageUrl || null,
      category_id: draft.categoryId || null,
      scope: draft.scope,
      unit_id: draft.scope === "unit" ? unitId : null,
      scheduled_at: draft.scheduledAt || null,
    }),
    [draft, unitId],
  );

  async function persist() {
    if (!payload.title) throw new Error("عنوان محتوا الزامی است.");
    const saved = currentItem
      ? await panelService.updateContent(currentItem.id, payload)
      : await panelService.createContent(payload);
    setCurrentItem(saved);
    setDraft(draftFrom(saved, defaultKind, unitId));
    setDirty(false);
    setSaveState("saved");
    onSaved(saved);
    return saved;
  }

  async function save() {
    setSaving(true);
    setErrorText("");
    try {
      await persist();
    } catch (reason) {
      setSaveState("error");
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function workflow(action: "submit-review" | "publish" | "schedule") {
    setSaving(true);
    setErrorText("");
    try {
      const saved = await persist();
      const updated = await panelService.contentAction(
        saved.id,
        action,
        action === "schedule" ? { scheduled_at: draft.scheduledAt } : {},
      );
      setCurrentItem(updated);
      setDraft(draftFrom(updated, defaultKind, unitId));
      onSaved(updated);
      setSaveState("saved");
    } catch (reason) {
      setSaveState("error");
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open || !currentItem || !dirty) return;
    const timer = window.setTimeout(() => {
      panelService.contentAction(currentItem.id, "autosave", payload)
        .then((saved) => {
          setCurrentItem(saved);
          setDirty(false);
          setSaveState("saved");
          onSaved(saved);
        })
        .catch(() => setSaveState("error"));
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [currentItem, dirty, onSaved, open, payload]);

  useEffect(() => {
    if (!open) return;
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  if (!open) return null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaveState("idle");
  }

  function close() {
    if (dirty && !window.confirm("تغییرات ذخیره‌نشده دارید. ویرایشگر بسته شود؟")) return;
    onClose();
  }

  async function uploadCover(file: File) {
    setSaving(true);
    setErrorText("");
    try {
      const media = await panelService.uploadMedia(file);
      update("coverImageUrl", media.url);
    } catch (reason) {
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function restore(revision: ContentRevision) {
    if (!currentItem || !window.confirm(`نسخه ${revision.number} بازیابی شود؟`)) return;
    setSaving(true);
    try {
      const restored = await panelService.restoreContentRevision(currentItem.id, revision.id);
      setCurrentItem(restored);
      setDraft(draftFrom(restored, defaultKind, unitId));
      setDirty(false);
      onSaved(restored);
    } catch (reason) {
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const editor = (
    <RichEditor
      value={draft.bodyHtml}
      jsonValue={draft.bodyJson}
      onChange={(html) => update("bodyHtml", html)}
      onJsonChange={(json) => update("bodyJson", json)}
      placeholder="متن کامل محتوا را اینجا بنویسید..."
    />
  );

  const settings = (
    <section className="panel-card space-y-4">
      <h3 className="panel-divider-title">تنظیمات انتشار</h3>
      <label><span className="panel-field-label">نوع</span><select value={draft.kind} onChange={(event) => update("kind", event.target.value as ContentKind)} className="panel-select"><option value="news">خبر</option><option value="announcement">اطلاعیه</option></select></label>
      <label><span className="panel-field-label">دسته‌بندی</span><select value={draft.categoryId} onChange={(event) => update("categoryId", event.target.value)} className="panel-select"><option value="">بدون دسته‌بندی</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
      <label><span className="panel-field-label">دامنه نمایش</span><select value={draft.scope} onChange={(event) => update("scope", event.target.value as "school" | "unit")} className="panel-select"><option value="school">کل مدرسه</option>{unitId ? <option value="unit">واحد من</option> : null}</select></label>
      <label><span className="panel-field-label">زمان انتشار</span><input type="datetime-local" value={draft.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} className="panel-input" /></label>
      <input ref={coverInput} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
      <button type="button" onClick={() => coverInput.current?.click()} className="panel-secondary-button w-full"><PanelIcon name="image" className="size-4" />بارگذاری تصویر شاخص</button>
      {draft.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={draft.coverImageUrl} alt="پیش‌نمایش تصویر شاخص" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
      ) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400">تصویر شاخص انتخاب نشده است.</p>}
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbfaf7]" dir="rtl">
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }} className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={close} className="panel-icon-button" aria-label="بستن ویرایشگر"><PanelIcon name="chevron" className="size-5" /></button>
            <div><h2 className="text-xl font-black text-[#102b4a]">ادیتور {mode === "simple" ? "ساده" : "پیشرفته"}</h2><p className="mt-1 text-[11px] font-bold text-slate-500">{currentItem ? `وضعیت: ${statusLabels[currentItem.status]}` : "محتوای جدید"}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{saving ? "در حال ذخیره..." : dirty ? "تغییرات ذخیره نشده" : saveState === "saved" ? `ذخیره شد · ${formatDate(currentItem?.updated_at ?? null)}` : saveState === "error" ? "خطا در ذخیره" : "آماده"}</span>
            <button disabled={saving} type="submit" className="panel-secondary-button"><PanelIcon name="document" className="size-4" />ذخیره پیش‌نویس</button>
            <button disabled={saving} type="button" onClick={() => void workflow("submit-review")} className="panel-primary-button"><PanelIcon name="review" className="size-4" />ارسال برای بررسی</button>
            {canPublish ? <button disabled={saving} type="button" onClick={() => void workflow(draft.scheduledAt ? "schedule" : "publish")} className="panel-primary-button !bg-emerald-600"><PanelIcon name="check" className="size-4" />{draft.scheduledAt ? "زمان‌بندی انتشار" : "انتشار"}</button> : null}
          </div>
        </header>

        {errorText ? <p role="alert" className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 sm:mx-6">{errorText}</p> : null}

        <div className={`mx-auto grid w-full max-w-7xl flex-1 gap-5 p-4 sm:p-6 ${mode === "simple" ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : "lg:grid-cols-[15rem_minmax(0,1fr)_18rem]"}`}>
          {mode === "advanced" ? (
            <aside className="space-y-4">
              <section className="panel-card"><h3 className="panel-divider-title">ساختار محتوا</h3><p className="mt-3 text-xs font-bold leading-7 text-slate-500">بلوک‌های تصویر، گالری و نقل‌قول را از بخش زیر به متن اضافه کنید. متن هم‌زمان به JSON و HTML ذخیره می‌شود.</p></section>
              {currentItem ? <section className="panel-card"><h3 className="panel-divider-title">تاریخچه نسخه‌ها</h3>{revisions.length ? <div className="mt-3 space-y-2">{revisions.slice(0, 8).map((revision) => <button key={revision.id} type="button" onClick={() => void restore(revision)} className="w-full rounded-lg border border-slate-200 p-3 text-right text-xs hover:bg-slate-50"><b className="block text-[#172b43]">نسخه {revision.number}</b><span className="mt-1 block text-slate-500">{formatDate(revision.created_at)} · {revision.actor_name}</span></button>)}</div> : <PanelEmpty title="نسخه قبلی وجود ندارد." />}</section> : null}
            </aside>
          ) : null}

          <main className="panel-card min-w-0 space-y-5">
            <label><span className="panel-field-label">عنوان</span><input required value={draft.title} onChange={(event) => update("title", event.target.value)} className="panel-input text-lg font-black" placeholder="عنوان اصلی محتوا" /></label>
            <label><span className="panel-field-label">خلاصه</span><textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} className="panel-textarea" placeholder="خلاصه‌ای کوتاه برای فهرست و متادیتا..." /></label>
            <div><span className="panel-field-label">متن محتوا</span>{editor}</div>
            {mode === "advanced" ? <ContentBlockInserter value={draft.bodyHtml} onChange={(html) => { update("bodyHtml", html); update("bodyJson", null); }} unitId={unitId} /> : null}
          </main>
          <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">{settings}</aside>
        </div>
      </form>
    </div>
  );
}

export function EditorialWorkspace({
  unitId = null,
  canPublish = true,
  initialKind = "all",
  reviewOnly = false,
}: EditorialWorkspaceProps) {
  const [kind, setKind] = useState<ContentKind | "all">(initialKind);
  const [status, setStatus] = useState(reviewOnly ? "waiting_review" : "");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [editor, setEditor] = useState<{ mode: EditorMode; item: ContentItem | null } | null>(null);
  const [modeMenu, setModeMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const request = usePanelRequest(
    () => panelService.content({ search: debouncedSearch, kind: kind === "all" ? "" : kind, status, unit: unitId, page }),
    [debouncedSearch, kind, status, unitId, page],
  );
  const items = useMemo(() => request.data?.page.results ?? [], [request.data]);
  const effectiveSelectedId = items.some((item) => String(item.id) === String(selectedId))
    ? selectedId
    : items[0]?.id ?? null;
  const selected = items.find((item) => String(item.id) === String(effectiveSelectedId)) ?? null;
  const defaultKind: ContentKind = kind === "all" ? "news" : kind;

  function onSaved(saved: ContentItem) {
    setSelectedId(saved.id);
    request.reload();
  }

  async function removeSelected() {
    if (!selected || !window.confirm("این محتوا حذف شود؟")) return;
    setActionError(null);
    try {
      await panelService.removeContent(selected.id);
      setSelectedId(null);
      request.reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    }
  }

  if (request.loading && !request.data) return <PanelLoading label="در حال دریافت محتوا..." />;
  if (request.error && !request.data) return <PanelError message={request.error} onRetry={request.reload} />;

  return (
    <div className="space-y-5">
      {actionError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p> : null}
      {request.data?.summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[["پیش‌نویس", request.data.summary.drafts, "document"], ["در صف بررسی", request.data.summary.waiting_review, "review"], ["زمان‌بندی‌شده", request.data.summary.scheduled, "calendar"], ["منتشرشده", request.data.summary.published, "check"]].map(([title, value, icon]) => <article key={String(title)} className="panel-card"><PanelIcon name={icon as "document"} className="size-6 text-[#0b599b]" /><p className="mt-3 text-xs font-black text-slate-500">{title}</p><b className="mt-2 block text-3xl text-[#172b43]">{value}</b></article>)}
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {([["all", "همه محتواها"], ["news", "اخبار"], ["announcement", "اطلاعیه‌ها"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setKind(value); setPage(1); }} className={`rounded-md px-4 py-2 text-xs font-black ${kind === value ? "bg-[#fff3de] text-[#a8660b]" : "text-slate-500 hover:bg-slate-50"}`}>{label}</button>)}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setModeMenu((open) => !open)} className="panel-primary-button"><PanelIcon name="plus" className="size-5" />محتوای جدید<PanelIcon name="chevron" className="size-3 rotate-90" /></button>
          {modeMenu ? <div className="absolute left-0 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"><button type="button" onClick={() => { setEditor({ mode: "simple", item: null }); setModeMenu(false); }} className="flex w-full items-center gap-3 rounded-md p-3 text-right text-xs font-black text-[#173652] hover:bg-[#fff8ec]"><PanelIcon name="edit" className="size-5 text-[#d98a12]" />ادیتور ساده</button><button type="button" onClick={() => { setEditor({ mode: "advanced", item: null }); setModeMenu(false); }} className="flex w-full items-center gap-3 rounded-md p-3 text-right text-xs font-black text-[#173652] hover:bg-[#fff8ec]"><PanelIcon name="services" className="size-5 text-[#0b599b]" />ادیتور پیشرفته</button></div> : null}
        </div>
      </div>

      <section className="panel-split-layout grid gap-5 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="panel-card h-fit 2xl:sticky 2xl:top-28">
          {selected ? (
            <>
              <header className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-[#183a5b]">پیش‌نمایش محتوا</h2><ContentStatus status={selected.status} /></header>
              {selected.cover_image_url ? <img src={selected.cover_image_url} alt="" className="h-44 w-full rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs font-bold text-slate-400">بدون تصویر شاخص</div>}
              <h3 className="mt-4 text-lg font-black leading-8 text-[#172b43]">{selected.title}</h3>
              {selected.summary ? <p className="mt-2 text-xs font-bold leading-7 text-slate-500">{selected.summary}</p> : null}
              <dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-600"><dt>نویسنده:</dt><dd>{selected.author?.full_name ?? "ثبت نشده"}</dd><dt>واحد هدف:</dt><dd>{selected.scope === "school" ? "کل مدرسه" : selected.unit?.title ?? "واحد ثبت نشده"}</dd><dt>دسته‌بندی:</dt><dd>{selected.category?.title ?? "بدون دسته‌بندی"}</dd><dt>انتشار:</dt><dd>{formatDate(selected.published_at ?? selected.scheduled_at)}</dd></dl>
              <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditor({ mode: "advanced", item: selected })} className="panel-secondary-button"><PanelIcon name="edit" className="size-4" />ویرایش</button><button type="button" onClick={() => void removeSelected()} className="panel-secondary-button !border-rose-200 !text-rose-600"><PanelIcon name="trash" className="size-4" />حذف</button></div>
            </>
          ) : <PanelEmpty title="محتوایی برای پیش‌نمایش انتخاب نشده است." />}
        </aside>

        <section className="panel-card min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.5fr)_minmax(9rem,.7fr)_auto]">
            <label className="panel-search"><PanelIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="جستجو در عنوان یا خلاصه..." /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="panel-select" aria-label="وضعیت محتوا"><option value="">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <button type="button" onClick={() => { setSearch(""); setStatus(reviewOnly ? "waiting_review" : ""); }} className="panel-secondary-button"><PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها</button>
          </div>
          {items.length ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="panel-table min-w-[56rem]"><thead><tr><th>عنوان</th><th>نوع</th><th>دسته‌بندی</th><th>واحد آموزشی</th><th>وضعیت</th><th>نویسنده</th><th>تاریخ انتشار</th><th>عملیات</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={String(effectiveSelectedId) === String(item.id) ? "is-selected" : ""}><td className="max-w-64 whitespace-normal font-black leading-6 text-[#172b43]">{item.title}</td><td>{item.kind === "news" ? "خبر" : "اطلاعیه"}</td><td>{item.category?.title ?? "—"}</td><td>{item.scope === "school" ? "کل مدرسه" : item.unit?.title ?? "—"}</td><td><ContentStatus status={item.status} /></td><td>{item.author?.full_name ?? "—"}</td><td>{formatDate(item.published_at ?? item.scheduled_at ?? item.created_at)}</td><td><button type="button" onClick={(event) => { event.stopPropagation(); setEditor({ mode: "advanced", item }); }} className="panel-icon-button !size-8" aria-label={`ویرایش ${item.title}`}><PanelIcon name="more" className="size-4" /></button></td></tr>)}</tbody></table></div>
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>صفحه {page} — مجموع {request.data?.page.count ?? 0} مورد</span><div className="flex gap-2"><button disabled={!request.data?.page.previous} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button" className="panel-secondary-button">صفحه قبل</button><button disabled={!request.data?.page.next} onClick={() => setPage((value) => value + 1)} type="button" className="panel-secondary-button">صفحه بعد</button></div></footer>
            </>
          ) : <PanelEmpty title="محتوایی با این فیلترها پیدا نشد." />}
        </section>
      </section>

      {editor ? <EditorialEditor key={`${editor.mode}-${editor.item?.id ?? "new"}`} open mode={editor.mode} item={editor.item} defaultKind={defaultKind} unitId={unitId} canPublish={canPublish} onClose={() => setEditor(null)} onSaved={onSaved} /> : null}
    </div>
  );
}
