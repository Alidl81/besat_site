"use client";

import type { JSONContent } from "@tiptap/core";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContentBlockInserter } from "@/components/cms/content-block-inserter";
import { RichContentRenderer } from "@/components/content/rich-content-renderer";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "@/components/dashboard/panel-request-state";
import { EditorDocumentOutline } from "@/components/editor/editor-document-outline";
import { EditorIcon } from "@/components/editor/editor-icons";
import {
  RichEditor,
  type EditorDocumentStats,
  type EditorOutlineItem,
  type RichEditorHandle,
} from "@/components/editor/rich-editor";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  createSerialSaveQueue,
  type SerialSaveQueue,
} from "@/lib/editor/serial-save-queue";
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
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  audience: "all" | "students" | "parents" | "staff";
  isFeatured: boolean;
  allowComments: boolean;
  wordpressSync: boolean;
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
    seoTitle: item?.seo_title ?? "",
    seoDescription: item?.seo_description ?? "",
    seoKeywords: item?.seo_keywords?.join("، ") ?? "",
    canonicalUrl: item?.canonical_url ?? "",
    audience: item?.audience ?? "all",
    isFeatured: item?.is_featured ?? false,
    allowComments: item?.allow_comments ?? false,
    wordpressSync: item?.wordpress_sync ?? false,
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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [outline, setOutline] = useState<EditorOutlineItem[]>([]);
  const [stats, setStats] = useState<EditorDocumentStats>({
    blocks: 0,
    characters: 0,
    words: 0,
    readingMinutes: 1,
  });
  const [uploading, setUploading] = useState(false);
  const [revisionCache, setRevisions] = useState<ContentRevision[]>([]);
  const [revisionsContentId, setRevisionsContentId] = useState<string | null>(null);
  const [revisionLoadPending, setRevisionsLoading] = useState(false);
  const [revisionPreview, setRevisionPreview] = useState<ContentRevision | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const editVersion = useRef(0);
  const currentItemRef = useRef<ContentItem | null>(item);
  const saveQueue = useRef<SerialSaveQueue<ContentItem>>(
    createSerialSaveQueue<ContentItem>(),
  );

  useEffect(() => {
    currentItemRef.current = currentItem;
  }, [currentItem]);

  useEffect(() => {
    if (!open) return;
    panelService.contentCategories().then(setCategories).catch(() => setCategories([]));
  }, [open]);

  useEffect(() => {
    if (!open || !currentItem?.id) return;

    const contentId = currentItem.id;
    let active = true;
    queueMicrotask(() => {
      if (active) setRevisionsLoading(true);
    });
    panelService.contentRevisions(contentId)
      .then((items) => {
        if (!active) return;
        setRevisions(items);
        setRevisionsContentId(String(contentId));
      })
      .catch(() => {
        if (!active) return;
        setRevisions([]);
        setRevisionsContentId(String(contentId));
      })
      .finally(() => {
        if (active) setRevisionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentItem?.id, currentItem?.updated_at, open]);

  const revisions =
    open && revisionsContentId === String(currentItem?.id ?? "") ? revisionCache : [];
  const revisionsLoading = revisionLoadPending && open && Boolean(currentItem?.id);

  const payload = useMemo(
    () => ({
      kind: draft.kind,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      body_html: draft.bodyHtml,
      body_json: draft.bodyJson,
      cover_image_url: draft.coverImageUrl || null,
      category:
        categories.find((category) => String(category.id) === draft.categoryId)
          ?.title ?? null,
      scope: draft.scope,
      unit_id: draft.scope === "unit" ? unitId : null,
      scheduled_at: draft.scheduledAt || null,
      is_featured: draft.isFeatured,
    }),
    [categories, draft, unitId],
  );

  const persist = useCallback(async (
    snapshot = payload,
    versionAtStart = editVersion.current,
    autosave = false,
  ) => {
    if (!snapshot.title) throw new Error("عنوان محتوا الزامی است.");

    const operation = async () => {
      const existing = currentItemRef.current;
      const requestPayload = autosave ? { ...snapshot, autosave: true } : snapshot;
      const saved = existing
        ? await panelService.updateContent(existing.id, requestPayload)
        : await panelService.createContent(requestPayload);
      currentItemRef.current = saved;
      setCurrentItem(saved);
      if (editVersion.current === versionAtStart) {
        setDraft(draftFrom(saved, defaultKind, unitId));
        setDirty(false);
      }
      setSaveState("saved");
      onSaved(saved);
      return saved;
    };

    return saveQueue.current.enqueue(operation);
  }, [defaultKind, onSaved, payload, unitId]);

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

  async function workflow(action: "submit-review" | "approve" | "reject" | "publish" | "schedule") {
    setSaving(true);
    setErrorText("");
    try {
      const saved = await persist(payload, editVersion.current);
      const updated = await panelService.contentAction(
        saved.id,
        action,
        action === "schedule" ? { scheduled_at: draft.scheduledAt } : {},
      );
      currentItemRef.current = updated;
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
    if (!open || !dirty || !payload.title) return;
    const versionAtSchedule = editVersion.current;
    const timer = window.setTimeout(() => {
      persist(payload, versionAtSchedule, true)
        .then((saved) => {
          currentItemRef.current = saved;
        })
        .catch(() => setSaveState("error"));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [dirty, open, payload, persist]);

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

  useEffect(() => {
    if (!dirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  if (!open) return null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    editVersion.current += 1;
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
      const media = await panelService.uploadMedia(file, {
        unitId,
        altText: draft.title,
      });
      update("coverImageUrl", media.url);
    } catch (reason) {
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function uploadEditorMedia(file: File) {
    try {
      return await panelService.uploadMedia(file, {
        unitId,
        altText: file.name,
      });
    } catch (reason) {
      const message = getApiErrorMessage(reason);
      setErrorText(message);
      throw reason;
    }
  }

  async function restoreRevision(revision: ContentRevision) {
    if (!currentItem || !window.confirm("نسخه انتخاب‌شده جایگزین محتوای فعلی شود؟")) return;
    setSaving(true);
    setErrorText("");
    try {
      const saved = await panelService.restoreContentRevision(currentItem.id, revision.id);
      currentItemRef.current = saved;
      setCurrentItem(saved);
      setDraft(draftFrom(saved, defaultKind, unitId));
      setDirty(false);
      setRevisionPreview(null);
      onSaved(saved);
      setSaveState("saved");
    } catch (reason) {
      setSaveState("error");
      setErrorText(getApiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const editor = (
    <RichEditor
      ref={editorRef}
      value={draft.bodyHtml}
      jsonValue={draft.bodyJson}
      onChange={(html) => update("bodyHtml", html)}
      onJsonChange={(json) => update("bodyJson", json)}
      mode={mode}
      onOutlineChange={setOutline}
      onStatsChange={setStats}
      onUploadMedia={uploadEditorMedia}
      onUploadState={setUploading}
      placeholder="متن کامل محتوا را اینجا بنویسید..."
    />
  );

  const settings = (
    <aside className="besat-editor-settings">
      <section className="besat-editor-side-card">
        <header className="besat-editor-side-heading">
          <div><h3>گردش کار</h3><p>مرحله فعلی انتشار</p></div>
          <PanelIcon name="review" className="size-5" />
        </header>
        <ol className="besat-editor-workflow">
          {[
            ["draft", "پیش‌نویس"],
            ["waiting_review", "ارسال برای بررسی"],
            ["approved", "تأیید سردبیر"],
            ["published", "انتشار نهایی"],
          ].map(([value, label], index) => {
            const statusOrder = ["draft", "waiting_review", "approved", "published"];
            const currentIndex = statusOrder.indexOf(currentItem?.status === "scheduled" ? "published" : currentItem?.status ?? "draft");
            return (
              <li key={value} className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""}>
                <span>{index < currentIndex ? <EditorIcon name="check" /> : index + 1}</span>
                <b>{label}</b>
              </li>
            );
          })}
        </ol>
      </section>

      <details className="besat-editor-setting-group" open>
        <summary>تنظیمات انتشار <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <label><span>نوع محتوا</span><select value={draft.kind} onChange={(event) => update("kind", event.target.value as ContentKind)} className="panel-select"><option value="news">خبر</option><option value="announcement">اطلاعیه</option></select></label>
          <label><span>دسته‌بندی</span><select value={draft.categoryId} onChange={(event) => update("categoryId", event.target.value)} className="panel-select"><option value="">بدون دسته‌بندی</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
          <label><span>دامنه نمایش</span><select value={draft.scope} onChange={(event) => update("scope", event.target.value as "school" | "unit")} className="panel-select"><option value="school">کل مجموعه</option>{unitId ? <option value="unit">واحد آموزشی جاری</option> : null}</select></label>
          <label><span>زمان انتشار</span><input type="datetime-local" value={draft.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} className="panel-input" /></label>
          <label><span>مخاطبان</span><select value={draft.audience} onChange={(event) => update("audience", event.target.value as Draft["audience"])} className="panel-select"><option value="all">همه کاربران سایت</option><option value="students">دانش‌آموزان</option><option value="parents">والدین</option><option value="staff">کادر آموزشی</option></select></label>
        </div>
      </details>

      <details className="besat-editor-setting-group" open>
        <summary>تصویر شاخص <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <input ref={coverInput} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
          {draft.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.coverImageUrl} alt="پیش‌نمایش تصویر شاخص" className="besat-editor-cover-preview" />
          ) : <p className="besat-editor-cover-empty">هنوز تصویر شاخص انتخاب نشده است.</p>}
          <button type="button" onClick={() => coverInput.current?.click()} className="panel-secondary-button w-full"><EditorIcon name="upload" className="size-4" />{draft.coverImageUrl ? "جایگزینی تصویر" : "بارگذاری تصویر"}</button>
        </div>
      </details>

      <details className="besat-editor-setting-group">
        <summary>نمایش <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <label className="besat-editor-switch"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} /><span aria-hidden="true" /><b>نمایش به‌عنوان محتوای ویژه</b></label>
        </div>
      </details>

      <details className="besat-editor-setting-group">
        <summary>نسخه‌های محتوا <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          {revisionsLoading ? <p className="text-xs font-bold text-slate-500">در حال دریافت نسخه‌ها...</p> : null}
          {!revisionsLoading && !currentItem ? <p className="text-xs font-bold text-slate-500">پس از نخستین ذخیره، نسخه‌ها اینجا نمایش داده می‌شوند.</p> : null}
          {!revisionsLoading && currentItem && !revisions.length ? <p className="text-xs font-bold text-slate-500">نسخه‌ای ثبت نشده است.</p> : null}
          {!revisionsLoading && revisions.length ? (
            <ol className="besat-editor-revisions">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <div>
                    <b>{revision.note ?? "ذخیره محتوا"}</b>
                    <span>{revision.actor?.full_name ?? "کاربر حذف‌شده"} · {formatDate(revision.updated_at)}</span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setRevisionPreview(revision); setPreviewOpen(true); }} className="panel-icon-button !size-8" aria-label="پیش‌نمایش نسخه"><PanelIcon name="eye" className="size-4" /></button>
                    <button type="button" disabled={saving} onClick={() => void restoreRevision(revision)} className="panel-icon-button !size-8" aria-label="بازگردانی نسخه"><PanelIcon name="document" className="size-4" /></button>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </details>
    </aside>
  );

  const previewContent = revisionPreview?.snapshot ?? {
    title: draft.title,
    summary: draft.summary,
    body_html: draft.bodyHtml,
    cover_image_url: draft.coverImageUrl,
  };

  return (
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }} className="besat-editor-studio" dir="rtl">
      <header className="besat-editor-studio-header">
        <div className="besat-editor-studio-title">
          <button type="button" onClick={close} aria-label="بازگشت به فهرست محتوا"><EditorIcon name="chevron-left" /></button>
          <div>
            <p>مدیریت محتوا / {currentItem ? "ویرایش محتوا" : "محتوای جدید"}</p>
            <h2>ادیتور {mode === "simple" ? "ساده" : "پیشرفته"}</h2>
          </div>
        </div>
        <div className="besat-editor-header-actions">
          <span role="status" aria-live="polite" className={`besat-editor-save-state ${saveState === "error" ? "is-error" : ""}`}>
            <i aria-hidden="true" />
            {saving || uploading ? "در حال ذخیره یا بارگذاری..." : dirty ? "تغییرات ذخیره‌نشده" : saveState === "saved" ? `ذخیره شد · ${formatDate(currentItem?.updated_at ?? null)}` : "ذخیره خودکار فعال است"}
          </span>
          <button type="button" onClick={() => { setRevisionPreview(null); setPreviewOpen(true); }} className="panel-secondary-button"><PanelIcon name="eye" className="size-4" />پیش‌نمایش</button>
        </div>
      </header>

      {errorText ? <p role="alert" className="besat-editor-error">{errorText}</p> : null}

      <div dir="ltr" className={`besat-editor-layout ${mode === "advanced" ? "is-advanced" : "is-simple"}`}>
        {mode === "advanced" ? (
          <aside dir="rtl" className="besat-editor-left-column">
            <EditorDocumentOutline editorRef={editorRef} outline={outline} />
            <ContentBlockInserter
              value=""
              onChange={(html) => editorRef.current?.insertHtml(html)}
              unitId={unitId}
              variant="sidebar"
              onUploadState={setUploading}
            />
          </aside>
        ) : null}

        <main dir="rtl" className="besat-editor-document">
          <div className="besat-editor-document-meta">
            <label>
              <span>عنوان محتوا <b aria-hidden="true">*</b></span>
              <input required value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="عنوان دقیق و خوانای محتوا را بنویسید" />
            </label>
            <label>
              <span>خلاصه</span>
              <textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="خلاصه کوتاه برای کارت خبر و نتایج جستجو" />
              <small>{draft.summary.length.toLocaleString("fa-IR")} نویسه</small>
            </label>
          </div>

          {mode === "simple" && draft.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.coverImageUrl} alt="" className="besat-editor-inline-cover" />
          ) : null}

          <div className="besat-editor-document-label">
            <span>متن اصلی</span>
            <div><b>{stats.words.toLocaleString("fa-IR")}</b> واژه · <b>{stats.readingMinutes.toLocaleString("fa-IR")}</b> دقیقه مطالعه · <b>{stats.blocks.toLocaleString("fa-IR")}</b> بلوک</div>
          </div>
          {editor}
        </main>

        <div dir="rtl" className="besat-editor-right-column">{settings}</div>
      </div>

      <footer className="besat-editor-actionbar">
        <div>
          <span className={`panel-status ${currentItem ? statusClasses[currentItem.status] : ""}`}>{currentItem ? statusLabels[currentItem.status] : "محتوای جدید"}</span>
          <small>میانبر ذخیره: Ctrl/⌘ + S</small>
        </div>
        <div>
          {currentItem?.status === "waiting_review" && canPublish ? <button disabled={saving} type="button" onClick={() => void workflow("reject")} className="panel-secondary-button !border-rose-200 !text-rose-700"><EditorIcon name="close" className="size-4" />رد محتوا</button> : null}
          <button disabled={saving} type="submit" className="panel-secondary-button"><PanelIcon name="document" className="size-4" />ذخیره پیش‌نویس</button>
          {currentItem?.status === "waiting_review" && canPublish ? <button disabled={saving} type="button" onClick={() => void workflow("approve")} className="panel-secondary-button !border-emerald-200 !text-emerald-700"><EditorIcon name="check" className="size-4" />تأیید محتوا</button> : null}
          {!currentItem || currentItem.status === "draft" || currentItem.status === "rejected" ? <button disabled={saving} type="button" onClick={() => void workflow("submit-review")} className="panel-primary-button"><PanelIcon name="review" className="size-4" />ارسال برای بررسی</button> : null}
          {canPublish && currentItem?.status === "approved" ? <button disabled={saving} type="button" onClick={() => void workflow(draft.scheduledAt ? "schedule" : "publish")} className="panel-primary-button !bg-[#d98712]"><PanelIcon name={draft.scheduledAt ? "calendar" : "check"} className="size-4" />{draft.scheduledAt ? "زمان‌بندی انتشار" : "انتشار نهایی"}</button> : null}
        </div>
      </footer>

      {previewOpen ? (
        <div className="besat-editor-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPreviewOpen(false); setRevisionPreview(null); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="editor-preview-title" className="besat-editor-preview">
            <header><div><p>{revisionPreview ? "پیش‌نمایش نسخه ثبت‌شده" : "پیش‌نمایش قبل از انتشار"}</p><h2 id="editor-preview-title">{previewContent.title || "عنوان محتوا"}</h2></div><button type="button" onClick={() => { setPreviewOpen(false); setRevisionPreview(null); }} aria-label="بستن پیش‌نمایش"><EditorIcon name="close" /></button></header>
            <article>
              {previewContent.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewContent.cover_image_url} alt="" />
              ) : null}
              {previewContent.summary ? <p className="besat-editor-preview-summary">{previewContent.summary}</p> : null}
              <RichContentRenderer html={previewContent.body_html} />
            </article>
          </section>
        </div>
      ) : null}
    </form>
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

  if (editor) {
    return (
      <EditorialEditor
        key={`${editor.mode}-${editor.item?.id ?? "new"}`}
        open
        mode={editor.mode}
        item={editor.item}
        defaultKind={defaultKind}
        unitId={unitId}
        canPublish={canPublish}
        onClose={() => setEditor(null)}
        onSaved={onSaved}
      />
    );
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

    </div>
  );
}
