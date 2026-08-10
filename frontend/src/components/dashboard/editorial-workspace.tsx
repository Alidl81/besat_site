"use client";

/* eslint-disable @next/next/no-img-element */

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
import {
  emptySeoDraft,
  SeoPanel,
  seoDraftFrom,
  seoDraftToPayload,
  type SeoDraft,
} from "@/components/cms/seo-panel";
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
import {
  ApiError,
  getApiErrorMessage,
  type ApiFieldErrors,
} from "@/lib/api/client";
import type { AccountRole } from "@/lib/data/domain-types";
import {
  createSerialSaveQueue,
  type SerialSaveQueue,
} from "@/lib/editor/serial-save-queue";
import { panelService } from "@/services/panel-service";
import type {
  ContentItem,
  ContentKind,
  ContentRevision,
  ContentRevisionComparison,
  ContentSummary,
  ContentWorkflowAction,
  ContentWorkflowStatus,
  NamedOption,
} from "@/types/panel-api";

type EditorialWorkspaceProps = {
  unitId?: string | null;
  authorRole: AccountRole;
  canPublish?: boolean;
  initialKind?: ContentKind | "all";
  reviewOnly?: boolean;
};

type EditorMode = "simple" | "advanced";
type SaveState = "idle" | "saved" | "error" | "conflict";
type QueueMode = "all" | "mine";
type PreviewSource = "server" | "local" | "revision";

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
  scheduledUnpublishAt: string;
  seo: SeoDraft;
  audience: "all" | "students" | "parents" | "staff";
  isFeatured: boolean;
};

type PreviewContent = {
  title: string;
  summary: string | null;
  bodyHtml: string;
  coverImageUrl: string | null;
};

type ConflictState = {
  id: string | number;
  version: number;
  updatedAt: string | null;
  status: ContentWorkflowStatus | null;
} | null;

const statusOptions: Array<{ value: ContentWorkflowStatus; label: string }> = [
  { value: "draft", label: "پیش‌نویس" },
  { value: "in_review", label: "در صف بررسی" },
  { value: "changes_requested", label: "نیازمند اصلاح" },
  { value: "approved", label: "تأییدشده" },
  { value: "scheduled", label: "زمان‌بندی‌شده" },
  { value: "published", label: "منتشرشده" },
  { value: "unpublished", label: "لغو انتشار" },
  { value: "archived", label: "بایگانی‌شده" },
  { value: "trash", label: "زباله‌دان" },
];

const statusLabels: Record<ContentWorkflowStatus, string> = Object.fromEntries(
  statusOptions.map((option) => [option.value, option.label]),
) as Record<ContentWorkflowStatus, string>;

const statusClasses: Record<ContentWorkflowStatus, string> = {
  draft: "",
  in_review: "is-warning",
  changes_requested: "is-danger",
  approved: "is-info",
  scheduled: "is-info",
  published: "is-success",
  unpublished: "is-warning",
  archived: "",
  trash: "is-danger",
};

const queueCards: Array<{
  key: keyof ContentSummary;
  status: ContentWorkflowStatus;
  icon: "document" | "review" | "calendar" | "check";
}> = [
  { key: "draft", status: "draft", icon: "document" },
  { key: "in_review", status: "in_review", icon: "review" },
  { key: "changes_requested", status: "changes_requested", icon: "review" },
  { key: "approved", status: "approved", icon: "check" },
  { key: "scheduled", status: "scheduled", icon: "calendar" },
  { key: "published", status: "published", icon: "check" },
  { key: "unpublished", status: "unpublished", icon: "document" },
  { key: "archived", status: "archived", icon: "document" },
  { key: "trash", status: "trash", icon: "document" },
];

const orderingOptions = [
  { value: "-updated_at", label: "آخرین ویرایش" },
  { value: "updated_at", label: "قدیمی‌ترین ویرایش" },
  { value: "title", label: "عنوان (الف تا ی)" },
  { value: "-title", label: "عنوان (ی تا الف)" },
  { value: "published_at", label: "قدیمی‌ترین انتشار" },
  { value: "-published_at", label: "آخرین انتشار" },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function toLocalDateTime(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function toIsoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numericId(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function draftFrom(
  item: ContentItem | null,
  kind: ContentKind,
  unitId: string | null,
): Draft {
  return {
    title: item?.title ?? "",
    summary: item?.summary ?? "",
    bodyHtml: item?.body_html ?? "",
    bodyJson: (item?.body_json as JSONContent | null) ?? null,
    coverImageUrl: item?.cover_image_url ?? "",
    categoryId: item?.category ? String(item.category.id) : "",
    kind: item?.kind ?? kind,
    scope: item?.scope ?? (unitId ? "unit" : "school"),
    scheduledAt: toLocalDateTime(item?.scheduled_at),
    scheduledUnpublishAt: toLocalDateTime(item?.scheduled_unpublish_at),
    seo: item?.seo ? seoDraftFrom(item.seo) : emptySeoDraft,
    audience: item?.audience ?? "all",
    isFeatured: item?.is_featured ?? false,
  };
}

function itemPreview(item: ContentItem): PreviewContent {
  return {
    title: item.title,
    summary: item.summary,
    bodyHtml: item.body_html,
    coverImageUrl: item.cover_image_url,
  };
}

function draftPreview(draft: Draft): PreviewContent {
  return {
    title: draft.title,
    summary: draft.summary || null,
    bodyHtml: draft.bodyHtml,
    coverImageUrl: draft.coverImageUrl || null,
  };
}

function revisionPreview(revision: ContentRevision): PreviewContent {
  return {
    title: revision.snapshot.title,
    summary: revision.snapshot.summary,
    bodyHtml: revision.snapshot.body_html,
    coverImageUrl: revision.snapshot.cover_image_url,
  };
}

const comparisonFieldLabels: Record<string, string> = {
  title: "عنوان",
  summary: "خلاصه",
  body_html: "متن HTML",
  body_json: "ساختار متن",
  editor_json: "ساختار ویرایشگر",
  cover_image_url: "تصویر شاخص",
  seo: "سئو و اشتراک‌گذاری",
  audience: "مخاطبان",
  scheduled_at: "زمان انتشار",
  scheduled_unpublish_at: "زمان لغو انتشار",
  status: "وضعیت",
  version: "نسخه",
};

function comparisonValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 280 ? serialized.slice(0, 280) + "…" : serialized;
  } catch {
    return "مقدار ساخت‌یافته";
  }
}

function getConflict(error: unknown): ConflictState {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const detail = error.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const current = (detail as { current?: unknown }).current;
  if (!current || typeof current !== "object" || Array.isArray(current)) return null;
  const record = current as Record<string, unknown>;
  const id = record.id;
  const version = record.version;
  if ((typeof id !== "string" && typeof id !== "number") || typeof version !== "number") {
    return null;
  }
  const status = statusOptions.some((option) => option.value === record.status)
    ? record.status as ContentWorkflowStatus
    : null;
  return {
    id,
    version,
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : null,
    status,
  };
}

function fieldMessages(fieldErrors: ApiFieldErrors, field: string) {
  return fieldErrors[field] ?? [];
}

function FieldErrors({ errors, field }: { errors: ApiFieldErrors; field: string }) {
  const messages = fieldMessages(errors, field);
  if (!messages.length) return null;
  return <small role="alert" className="mt-1 block text-xs font-bold text-rose-600">{messages.join(" ")}</small>;
}

function ContentStatus({ status }: { status: ContentWorkflowStatus }) {
  return <span className={"panel-status " + statusClasses[status]}>{statusLabels[status]}</span>;
}

function EditorialEditor({
  open,
  mode,
  item,
  defaultKind,
  unitId,
  authorRole,
  canPublish,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: EditorMode;
  item: ContentItem | null;
  defaultKind: ContentKind;
  unitId: string | null;
  authorRole: AccountRole;
  canPublish: boolean;
  onClose: () => void;
  onSaved: (item: ContentItem) => void;
}) {
  const [currentItem, setCurrentItem] = useState(item);
  const [draft, setDraft] = useState(() => draftFrom(item, defaultKind, unitId));
  const [categories, setCategories] = useState<NamedOption[]>([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [detailLoading, setDetailLoading] = useState(Boolean(item?.id));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorText, setErrorText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [conflict, setConflict] = useState<ConflictState>(null);
  const [workflowComment, setWorkflowComment] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSource>("local");
  const [serverPreview, setServerPreview] = useState<ContentItem | null>(null);
  const [activeRevision, setActiveRevision] = useState<ContentRevision | null>(null);
  const [revisionComparison, setRevisionComparison] = useState<ContentRevisionComparison | null>(null);
  const [revisionComparisonLoading, setRevisionComparisonLoading] = useState(false);
  const [revisionComparisonError, setRevisionComparisonError] = useState("");
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
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const editVersion = useRef(0);
  const currentItemRef = useRef<ContentItem | null>(item);
  const saveQueue = useRef<SerialSaveQueue<ContentItem>>(createSerialSaveQueue<ContentItem>());
  const previewDialogRef = useRef<HTMLElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const previewOpenerRef = useRef<HTMLElement | null>(null);

  const canReview = canPublish || authorRole === "unit_manager";

  const applyFailure = useCallback((reason: unknown) => {
    const message = getApiErrorMessage(reason);
    setErrorText(message);
    setSaveState("error");
    if (reason instanceof ApiError) {
      setFieldErrors(reason.fieldErrors);
      const current = getConflict(reason);
      if (current || reason.code === "content_conflict") {
        const local = currentItemRef.current;
        setConflict(current ?? (local ? {
          id: local.id,
          version: local.version,
          updatedAt: local.updated_at,
          status: local.status,
        } : {
          id: "unknown",
          version: -1,
          updatedAt: null,
          status: null,
        }));
        setSaveState("conflict");
      }
    }
  }, []);

  const loadCategories = useCallback(() => {
    setCategoriesError("");
    return panelService.contentCategories()
      .then(setCategories)
      .catch((reason: unknown) => {
        setCategories([]);
        setCategoriesError(getApiErrorMessage(reason));
      });
  }, []);

  const loadDetail = useCallback(async (contentId: string | number) => {
    setDetailLoading(true);
    try {
      const loaded = await panelService.contentItem(contentId);
      currentItemRef.current = loaded;
      setCurrentItem(loaded);
      setDraft(draftFrom(loaded, defaultKind, unitId));
      setDirty(false);
      setConflict(null);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setDetailLoading(false);
    }
  }, [applyFailure, defaultKind, unitId]);

  const loadRevisions = useCallback(async (contentId: string | number) => {
    setRevisionsLoading(true);
    setRevisionsError("");
    try {
      const revisions = await panelService.contentRevisions(contentId);
      setRevisions(revisions);
      setRevisionsContentId(String(contentId));
    } catch (reason) {
      setRevisions([]);
      setRevisionsContentId(String(contentId));
      setRevisionsError(getApiErrorMessage(reason));
    } finally {
      setRevisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    currentItemRef.current = currentItem;
  }, [currentItem]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCategories, open]);

  useEffect(() => {
    if (!open || !item?.id) return;
    const timer = window.setTimeout(() => {
      void loadDetail(item.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [item?.id, loadDetail, open]);

  useEffect(() => {
    if (!open || !currentItem?.id) return;
    const timer = window.setTimeout(() => {
      void loadRevisions(currentItem.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentItem?.id, currentItem?.updated_at, loadRevisions, open]);

  useEffect(() => {
    if (!previewOpen) return;
    const timer = window.setTimeout(() => previewCloseRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreviewOpen(false);
        setActiveRevision(null);
        window.setTimeout(() => previewOpenerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = previewDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [previewOpen]);

  const revisions = open && revisionsContentId === String(currentItem?.id ?? "")
    ? revisionCache
    : [];

  const payload = useMemo(() => ({
    kind: draft.kind,
    title: draft.title.trim(),
    summary: draft.summary.trim() || null,
    body_html: draft.bodyHtml,
    body_json: draft.bodyJson,
    cover_image_url: draft.coverImageUrl || null,
    category_id: numericId(draft.categoryId),
    scope: draft.scope,
    unit_id: draft.scope === "unit" ? numericId(unitId) : null,
    seo: seoDraftToPayload(draft.seo),
    audience: draft.audience,
    is_featured: draft.isFeatured,
  }), [draft, unitId]);

  const persist = useCallback(async (
    snapshot = payload,
    versionAtStart = editVersion.current,
    autosave = false,
  ) => {
    if (!snapshot.title) {
      throw new ApiError({
        message: "عنوان محتوا الزامی است.",
        status: 400,
        fieldErrors: { title: ["عنوان محتوا را وارد کنید."] },
      });
    }
    if (snapshot.scope === "unit" && snapshot.unit_id === null) {
      throw new ApiError({
        message: "برای محتوای واحد، واحد آموزشی معتبر لازم است.",
        status: 400,
        fieldErrors: { unit_id: ["واحد آموزشی انتخاب نشده یا معتبر نیست."] },
      });
    }

    const operation = async () => {
      const existing = currentItemRef.current;
      const requestPayload = autosave ? { ...snapshot, autosave: true } : snapshot;
      const saved = existing
        ? await panelService.updateContent(
            existing.id,
            requestPayload,
            existing.version,
          )
        : await panelService.createContent(requestPayload);
      currentItemRef.current = saved;
      setCurrentItem(saved);
      if (editVersion.current === versionAtStart) {
        setDraft(draftFrom(saved, defaultKind, unitId));
        setDirty(false);
      }
      setConflict(null);
      setFieldErrors({});
      setSaveState("saved");
      onSaved(saved);
      return saved;
    };

    return saveQueue.current.enqueue(operation);
  }, [defaultKind, onSaved, payload, unitId]);

  async function save() {
    if (conflict) {
      setErrorText("نسخه شما قدیمی است. ابتدا نسخه جدید را دریافت کنید.");
      setSaveState("conflict");
      return;
    }
    setSaving(true);
    setErrorText("");
    setFieldErrors({});
    try {
      await persist();
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setSaving(false);
    }
  }

  async function workflow(action: ContentWorkflowAction) {
    if (conflict) {
      setErrorText("نسخه شما قدیمی است. ابتدا نسخه جدید را دریافت کنید.");
      setSaveState("conflict");
      return;
    }
    if (action === "request-changes" && !workflowComment.trim()) {
      setFieldErrors({ comment: ["برای درخواست اصلاح، بازخورد سردبیر را بنویسید."] });
      setErrorText("بازخورد اصلاحات لازم است.");
      return;
    }
    const scheduledAt = action === "schedule" ? toIsoDateTime(draft.scheduledAt) : null;
    if (action === "schedule" && !scheduledAt) {
      setFieldErrors({ scheduled_at: ["تاریخ و ساعت انتشار معتبر لازم است."] });
      setErrorText("زمان انتشار را وارد کنید.");
      return;
    }
    const scheduledUnpublishAt = action === "schedule"
      ? toIsoDateTime(draft.scheduledUnpublishAt)
      : null;
    if (
      action === "schedule"
      && draft.scheduledUnpublishAt
      && !scheduledUnpublishAt
    ) {
      setFieldErrors({ scheduled_unpublish_at: ["زمان لغو انتشار معتبر نیست."] });
      setErrorText("زمان لغو انتشار را بررسی کنید.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setFieldErrors({});
    try {
      const existing = currentItemRef.current;
      const saved = !existing || dirty
        ? await persist(payload, editVersion.current)
        : existing;
      const actionPayload: Record<string, unknown> = {};
      if (workflowComment.trim()) actionPayload.comment = workflowComment.trim();
      if (action === "schedule") {
        actionPayload.scheduled_at = scheduledAt;
        if (scheduledUnpublishAt) {
          actionPayload.scheduled_unpublish_at = scheduledUnpublishAt;
        }
      }
      const updated = await panelService.contentAction(
        saved.id,
        action,
        actionPayload,
        saved.version,
      );
      currentItemRef.current = updated;
      setCurrentItem(updated);
      setDraft(draftFrom(updated, defaultKind, unitId));
      setDirty(false);
      setConflict(null);
      setWorkflowComment("");
      setSaveState("saved");
      onSaved(updated);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open || !dirty || !payload.title || conflict) return;
    const versionAtSchedule = editVersion.current;
    const timer = window.setTimeout(() => {
      persist(payload, versionAtSchedule, true)
        .catch(applyFailure);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [applyFailure, conflict, dirty, open, payload, persist]);

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
    setErrorText("");
    setFieldErrors({});
  }

  function updateSeo<K extends keyof SeoDraft>(key: K, value: SeoDraft[K]) {
    update("seo", { ...draft.seo, [key]: value });
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
        unitId: numericId(unitId),
        altText: draft.title,
      });
      update("coverImageUrl", media.url);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setSaving(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function uploadEditorMedia(file: File) {
    try {
      return await panelService.uploadMedia(file, {
        unitId: numericId(unitId),
        altText: file.name,
      });
    } catch (reason) {
      applyFailure(reason);
      throw reason;
    }
  }

  async function restoreRevision(selectedRevision: ContentRevision) {
    if (!currentItem || !window.confirm("نسخه انتخاب‌شده جایگزین محتوای فعلی شود؟")) return;
    if (conflict) {
      setErrorText("برای بازگردانی، ابتدا نسخه جدید محتوا را دریافت کنید.");
      return;
    }
    setSaving(true);
    setErrorText("");
    try {
      const saved = await panelService.restoreContentRevision(
        currentItem.id,
        selectedRevision.id,
        currentItem.version,
      );
      currentItemRef.current = saved;
      setCurrentItem(saved);
      setDraft(draftFrom(saved, defaultKind, unitId));
      setDirty(false);
      setActiveRevision(null);
      setConflict(null);
      setSaveState("saved");
      onSaved(saved);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setSaving(false);
    }
  }

  async function loadLatest() {
    if (!currentItem || (dirty && !window.confirm("نسخه محلی ذخیره‌نشده حذف و نسخه جدید سرور دریافت شود؟"))) {
      return;
    }
    await loadDetail(currentItem.id);
  }

  function closePreview() {
    setPreviewOpen(false);
    setActiveRevision(null);
    setServerPreview(null);
    setRevisionComparison(null);
    setRevisionComparisonError("");
    window.setTimeout(() => previewOpenerRef.current?.focus(), 0);
  }

  async function openRevisionComparison(selectedRevision: ContentRevision) {
    previewOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (!currentItem) return;
    setActiveRevision(selectedRevision);
    setPreviewSource("revision");
    setRevisionComparison(null);
    setRevisionComparisonError("");
    setRevisionComparisonLoading(true);
    setPreviewOpen(true);
    try {
      const comparison = await panelService.contentRevisionComparison(
        currentItem.id,
        selectedRevision.id,
      );
      setRevisionComparison(comparison);
    } catch (reason) {
      setRevisionComparisonError(getApiErrorMessage(reason));
    } finally {
      setRevisionComparisonLoading(false);
    }
  }

  async function openPreview() {
    previewOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setErrorText("");
    setActiveRevision(null);
    setRevisionComparison(null);
    setRevisionComparisonError("");
    if (!currentItem || dirty) {
      setPreviewSource("local");
      setPreviewOpen(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await panelService.contentPreview(currentItem.id);
      setServerPreview(preview);
      setPreviewSource("server");
      setPreviewOpen(true);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setPreviewLoading(false);
    }
  }

  const visiblePreview = activeRevision
    ? revisionPreview(activeRevision)
    : serverPreview
      ? itemPreview(serverPreview)
      : draftPreview(draft);
  const comparisonPreview = currentItem ? itemPreview(currentItem) : draftPreview(draft);

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

  const workflowStages = [
    ["draft", "پیش‌نویس"],
    ["in_review", "بررسی"],
    ["changes_requested", "اصلاح"],
    ["approved", "تأیید"],
    ["scheduled", "زمان‌بندی"],
    ["published", "انتشار"],
  ] as const;

  const settings = (
    <aside className="besat-editor-settings">
      <section className="besat-editor-side-card">
        <header className="besat-editor-side-heading">
          <div><h3>گردش کار</h3><p>وضعیت واقعی از سرور دریافت می‌شود.</p></div>
          <PanelIcon name="review" className="size-5" />
        </header>
        <ol className="besat-editor-workflow">
          {workflowStages.map(([value, label]) => {
            const isCurrent = currentItem?.status === value;
            const isSpecial = currentItem?.status === "changes_requested" && value === "changes_requested";
            return (
              <li key={value} className={isCurrent || isSpecial ? "is-current" : ""}>
                <span>{isCurrent || isSpecial ? <EditorIcon name="check" /> : "•"}</span>
                <b>{label}</b>
              </li>
            );
          })}
        </ol>
        {currentItem?.status === "unpublished" || currentItem?.status === "archived" || currentItem?.status === "trash" ? (
          <p className="mt-3 text-xs font-bold leading-6 text-slate-500">وضعیت فعلی: {statusLabels[currentItem.status]}</p>
        ) : null}
      </section>

      <details className="besat-editor-setting-group" open>
        <summary>تنظیمات انتشار <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <label><span>نوع محتوا</span><select value={draft.kind} onChange={(event) => update("kind", event.target.value as ContentKind)} className="panel-select"><option value="news">خبر</option><option value="announcement">اطلاعیه</option></select></label>
          <label><span>دسته‌بندی</span><select value={draft.categoryId} onChange={(event) => update("categoryId", event.target.value)} className="panel-select"><option value="">بدون دسته‌بندی</option>{categories.map((category) => <option key={category.id} value={String(category.id)}>{category.title}</option>)}</select><FieldErrors errors={fieldErrors} field="category_id" /></label>
          {categoriesError ? <p role="alert" className="text-xs font-bold text-rose-600">{categoriesError} <button type="button" onClick={() => void loadCategories()} className="underline">تلاش مجدد</button></p> : null}
          <label><span>دامنه نمایش</span><select value={draft.scope} onChange={(event) => update("scope", event.target.value as "school" | "unit")} className="panel-select"><option value="school">کل مجموعه</option>{unitId ? <option value="unit">واحد آموزشی جاری</option> : null}</select><FieldErrors errors={fieldErrors} field="unit_id" /></label>
          <label><span>مخاطبان</span><select value={draft.audience} onChange={(event) => update("audience", event.target.value as Draft["audience"])} className="panel-select"><option value="all">همه کاربران سایت</option><option value="students">دانش‌آموزان</option><option value="parents">والدین</option><option value="staff">کادر آموزشی</option></select><FieldErrors errors={fieldErrors} field="audience" /></label>
          <label><span>زمان انتشار</span><input type="datetime-local" value={draft.scheduledAt} onChange={(event) => update("scheduledAt", event.target.value)} className="panel-input" /><FieldErrors errors={fieldErrors} field="scheduled_at" /></label>
          <label><span>زمان لغو انتشار (اختیاری)</span><input type="datetime-local" value={draft.scheduledUnpublishAt} onChange={(event) => update("scheduledUnpublishAt", event.target.value)} className="panel-input" /><FieldErrors errors={fieldErrors} field="scheduled_unpublish_at" /></label>
          <label className="besat-editor-switch"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} /><span aria-hidden="true" /><b>نمایش به‌عنوان محتوای ویژه</b></label>
        </div>
      </details>

      <SeoPanel
        draft={draft.seo}
        onChange={updateSeo}
        title={draft.title}
        slug={currentItem?.slug ?? ""}
        bodyJson={draft.bodyJson}
        outline={outline}
        wordCount={stats.words}
        fieldErrors={fieldErrors}
      />

      <details className="besat-editor-setting-group" open>
        <summary>تصویر شاخص <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <input ref={coverInput} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
          {draft.coverImageUrl ? <img src={draft.coverImageUrl} alt="پیش‌نمایش تصویر شاخص" className="besat-editor-cover-preview" /> : <p className="besat-editor-cover-empty">هنوز تصویر شاخص انتخاب نشده است.</p>}
          <button type="button" onClick={() => coverInput.current?.click()} className="panel-secondary-button w-full"><EditorIcon name="upload" className="size-4" />{draft.coverImageUrl ? "جایگزینی تصویر" : "بارگذاری تصویر"}</button>
          <FieldErrors errors={fieldErrors} field="cover_image_url" />
        </div>
      </details>

      <details className="besat-editor-setting-group" open>
        <summary>بازخورد گردش کار <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <label><span>یادداشت برای بازبینی یا اصلاح</span><textarea value={workflowComment} onChange={(event) => setWorkflowComment(event.target.value)} className="panel-input min-h-24" placeholder="برای درخواست اصلاح، این بازخورد الزامی است." /><FieldErrors errors={fieldErrors} field="comment" /></label>
        </div>
      </details>

      <details className="besat-editor-setting-group">
        <summary>نسخه‌های محتوا <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          {revisionsLoading ? <p className="text-xs font-bold text-slate-500">در حال دریافت نسخه‌ها…</p> : null}
          {revisionsError ? <p role="alert" className="text-xs font-bold text-rose-600">{revisionsError} {currentItem ? <button type="button" onClick={() => void loadRevisions(currentItem.id)} className="underline">تلاش مجدد</button> : null}</p> : null}
          {!revisionsLoading && !currentItem ? <p className="text-xs font-bold text-slate-500">پس از نخستین ذخیره، نسخه‌ها اینجا نمایش داده می‌شوند.</p> : null}
          {!revisionsLoading && currentItem && !revisions.length && !revisionsError ? <p className="text-xs font-bold text-slate-500">نسخه‌ای ثبت نشده است.</p> : null}
          {revisions.length ? <ol className="besat-editor-revisions">{revisions.map((revision) => <li key={revision.id}><div><b>{revision.note ?? "ذخیره محتوا"}</b><span>{revision.actor?.full_name ?? "سیستم"} · {formatDate(revision.created_at)}</span></div><div className="flex gap-2"><button type="button" onClick={() => void openRevisionComparison(revision)} className="panel-icon-button !size-8" aria-label="مقایسه نسخه"><PanelIcon name="eye" className="size-4" /></button><button type="button" disabled={saving} onClick={() => void restoreRevision(revision)} className="panel-icon-button !size-8" aria-label="بازگردانی نسخه"><PanelIcon name="document" className="size-4" /></button></div></li>)}</ol> : null}
        </div>
      </details>
    </aside>
  );

  return (
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }} className="besat-editor-studio" dir="rtl">
      <header className="besat-editor-studio-header">
        <div className="besat-editor-studio-title">
          <button type="button" onClick={close} aria-label="بازگشت به فهرست محتوا"><EditorIcon name="chevron-left" /></button>
          <div><p>مدیریت محتوا / {currentItem ? "ویرایش محتوا" : "محتوای جدید"}</p><h2>ادیتور {mode === "simple" ? "ساده" : "پیشرفته"}</h2></div>
        </div>
        <div className="besat-editor-header-actions">
          <span role="status" aria-live="polite" className={"besat-editor-save-state " + (saveState === "error" || saveState === "conflict" ? "is-error" : "")}>
            <i aria-hidden="true" />
            {detailLoading ? "در حال دریافت نسخه ویرایش…" : saving || uploading ? "در حال ذخیره یا بارگذاری…" : saveState === "conflict" ? "تعارض نسخه: ذخیره خودکار متوقف شد" : dirty ? "تغییرات ذخیره‌نشده" : saveState === "saved" ? "ذخیره شد · " + formatDate(currentItem?.updated_at) : "ذخیره خودکار فعال است"}
          </span>
          <button type="button" disabled={previewLoading} onClick={() => void openPreview()} className="panel-secondary-button"><PanelIcon name="eye" className="size-4" />{previewLoading ? "دریافت پیش‌نمایش…" : "پیش‌نمایش"}</button>
        </div>
      </header>

      {errorText ? <p role="alert" className="besat-editor-error">{errorText}</p> : null}
      {conflict ? <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"><p>نسخه دیگری از این محتوا در {formatDate(conflict.updatedAt)} ذخیره شده است. تغییرات شما بدون دریافت نسخه جدید ارسال نمی‌شوند.</p><FieldErrors errors={fieldErrors} field="version" /><button type="button" onClick={() => void loadLatest()} className="mt-2 underline">دریافت نسخه جدید از سرور</button></section> : null}

      <div dir="ltr" className={"besat-editor-layout " + (mode === "advanced" ? "is-advanced" : "is-simple")}>
        {mode === "advanced" ? <aside dir="rtl" className="besat-editor-left-column"><EditorDocumentOutline editorRef={editorRef} outline={outline} /><ContentBlockInserter value="" onChange={(html) => editorRef.current?.insertHtml(html)} unitId={unitId} variant="sidebar" onUploadState={setUploading} /></aside> : null}
        <main dir="rtl" className="besat-editor-document">
          <div className="besat-editor-document-meta">
            <label><span>عنوان محتوا <b aria-hidden="true">*</b></span><input required value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="عنوان دقیق و خوانای محتوا را بنویسید" /><FieldErrors errors={fieldErrors} field="title" /></label>
            <label><span>خلاصه</span><textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="خلاصه کوتاه برای کارت خبر و نتایج جست‌وجو" /><small>{draft.summary.length.toLocaleString("fa-IR")} نویسه</small><FieldErrors errors={fieldErrors} field="summary" /></label>
          </div>
          {mode === "simple" && draft.coverImageUrl ? <img src={draft.coverImageUrl} alt="" className="besat-editor-inline-cover" /> : null}
          <div className="besat-editor-document-label"><span>متن اصلی</span><div><b>{stats.words.toLocaleString("fa-IR")}</b> واژه · <b>{stats.readingMinutes.toLocaleString("fa-IR")}</b> دقیقه مطالعه · <b>{stats.blocks.toLocaleString("fa-IR")}</b> بلوک</div></div>
          {editor}
          <FieldErrors errors={fieldErrors} field="body_json" />
          <FieldErrors errors={fieldErrors} field="body_html" />
        </main>
        <div dir="rtl" className="besat-editor-right-column">{settings}</div>
      </div>

      <footer className="besat-editor-actionbar">
        <div><span className={"panel-status " + (currentItem ? statusClasses[currentItem.status] : "")}>{currentItem ? statusLabels[currentItem.status] : "محتوای جدید"}</span><small>میان‌بر ذخیره: Ctrl/⌘ + S</small></div>
        <div>
          <button disabled={saving} type="submit" className="panel-secondary-button"><PanelIcon name="document" className="size-4" />ذخیره</button>
          {!currentItem || currentItem.status === "draft" || currentItem.status === "changes_requested" ? <button disabled={saving} type="button" onClick={() => void workflow("submit-review")} className="panel-primary-button"><PanelIcon name="review" className="size-4" />ارسال برای بررسی</button> : null}
          {currentItem?.status === "in_review" && canReview ? <><button disabled={saving} type="button" onClick={() => void workflow("request-changes")} className="panel-secondary-button !border-rose-200 !text-rose-700"><EditorIcon name="close" className="size-4" />درخواست اصلاح</button><button disabled={saving} type="button" onClick={() => void workflow("approve")} className="panel-secondary-button !border-emerald-200 !text-emerald-700"><EditorIcon name="check" className="size-4" />تأیید</button></> : null}
          {canPublish && currentItem?.status === "approved" ? <button disabled={saving} type="button" onClick={() => void workflow(draft.scheduledAt ? "schedule" : "publish")} className="panel-primary-button !bg-[#d98712]"><PanelIcon name={draft.scheduledAt ? "calendar" : "check"} className="size-4" />{draft.scheduledAt ? "زمان‌بندی انتشار" : "انتشار نهایی"}</button> : null}
          {canPublish && currentItem?.status === "scheduled" ? <button disabled={saving} type="button" onClick={() => void workflow("publish")} className="panel-primary-button !bg-[#d98712]"><PanelIcon name="check" className="size-4" />انتشار اکنون</button> : null}
          {canPublish && currentItem?.status === "published" ? <button disabled={saving} type="button" onClick={() => void workflow("unpublish")} className="panel-secondary-button"><EditorIcon name="close" className="size-4" />لغو انتشار</button> : null}
          {currentItem && currentItem.status !== "trash" && currentItem.status !== "archived" ? <button disabled={saving} type="button" onClick={() => void workflow("archive")} className="panel-secondary-button"><PanelIcon name="document" className="size-4" />بایگانی</button> : null}
          {currentItem && currentItem.status !== "trash" ? <button disabled={saving} type="button" onClick={() => void workflow("trash")} className="panel-secondary-button !border-rose-200 !text-rose-700"><PanelIcon name="trash" className="size-4" />انتقال به زباله‌دان</button> : null}
          {currentItem && (currentItem.status === "archived" || currentItem.status === "trash") ? <button disabled={saving} type="button" onClick={() => void workflow("restore")} className="panel-primary-button"><PanelIcon name="document" className="size-4" />بازگردانی به پیش‌نویس</button> : null}
        </div>
      </footer>

      {previewOpen ? (
        <div
          className="besat-editor-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <section
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-preview-title"
            className="besat-editor-preview"
          >
            <header>
              <div>
                <p>
                  {previewSource === "server"
                    ? "پیش‌نمایش امن سرور"
                    : previewSource === "revision"
                      ? "مقایسه نسخه ثبت‌شده"
                      : "پیش‌نمایش محلی ذخیره‌نشده"}
                </p>
                <h2 id="editor-preview-title">{visiblePreview.title || "عنوان محتوا"}</h2>
              </div>
              <button ref={previewCloseRef} type="button" onClick={closePreview} aria-label="بستن پیش‌نمایش">
                <EditorIcon name="close" />
              </button>
            </header>

            {previewSource === "local" ? (
              <p className="mx-6 mt-4 rounded-lg bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-900">
                این نسخه هنوز در سرور ذخیره نشده است؛ برای تطابق کامل با صفحه عمومی، ابتدا ذخیره کنید.
              </p>
            ) : null}

            {activeRevision ? (
              <>
                <section className="mx-6 mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-right">
                  <h3 className="text-sm font-black text-[#173652]">تغییرات تأییدشده سرور</h3>
                  {revisionComparisonLoading ? <p role="status" className="mt-2 text-xs font-bold text-slate-500">در حال دریافت تفاوت‌های نسخه…</p> : null}
                  {revisionComparisonError ? <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{revisionComparisonError}</p> : null}
                  {revisionComparison ? (
                    Object.keys(revisionComparison.changes).length ? (
                      <>
                        <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                          مبنا: {revisionComparison.base.current ? "نسخه فعلی محتوا" : formatDate(revisionComparison.base.created_at)} · نسخه هدف: {formatDate(revisionComparison.target.created_at)}
                        </p>
                        <dl className="mt-3 space-y-3">
                          {Object.entries(revisionComparison.changes).map(([field, change]) => (
                            <div key={field} className="rounded-lg border border-slate-200 bg-white p-3">
                              <dt className="text-xs font-black text-[#173652]">{comparisonFieldLabels[field] ?? field}</dt>
                              <dd className="mt-2 grid gap-2 text-xs font-bold leading-6 text-slate-600 sm:grid-cols-2">
                                <span><b className="ml-1 text-slate-400">قبل:</b>{comparisonValue(change.from)}</span>
                                <span><b className="ml-1 text-slate-400">بعد:</b>{comparisonValue(change.to)}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    ) : <p className="mt-2 text-xs font-bold text-slate-500">این نسخه با مبنای انتخاب‌شده تفاوتی ندارد.</p>
                  ) : null}
                </section>
                <div className="grid gap-5 p-6 lg:grid-cols-2">
                  <article>
                    <h3 className="mb-3 text-sm font-black text-[#173652]">نسخه انتخاب‌شده · {formatDate(activeRevision.created_at)}</h3>
                    {visiblePreview.coverImageUrl ? <img src={visiblePreview.coverImageUrl} alt="" /> : null}
                    {visiblePreview.summary ? <p className="besat-editor-preview-summary">{visiblePreview.summary}</p> : null}
                    <RichContentRenderer html={visiblePreview.bodyHtml} />
                  </article>
                  <article>
                    <h3 className="mb-3 text-sm font-black text-[#173652]">نسخه فعلی</h3>
                    {comparisonPreview.coverImageUrl ? <img src={comparisonPreview.coverImageUrl} alt="" /> : null}
                    {comparisonPreview.summary ? <p className="besat-editor-preview-summary">{comparisonPreview.summary}</p> : null}
                    <RichContentRenderer html={comparisonPreview.bodyHtml} />
                  </article>
                </div>
              </>
            ) : (
              <article>
                {visiblePreview.coverImageUrl ? <img src={visiblePreview.coverImageUrl} alt="" /> : null}
                {visiblePreview.summary ? <p className="besat-editor-preview-summary">{visiblePreview.summary}</p> : null}
                <RichContentRenderer html={visiblePreview.bodyHtml} />
              </article>
            )}
          </section>
        </div>
      ) : null}
    </form>
  );
}

export function EditorialWorkspace({
  unitId = null,
  authorRole,
  canPublish = true,
  initialKind = "all",
  reviewOnly = false,
}: EditorialWorkspaceProps) {
  const [kind, setKind] = useState<ContentKind | "all">(initialKind);
  const [status, setStatus] = useState<ContentWorkflowStatus | "">(reviewOnly ? "in_review" : "");
  const [scope, setScope] = useState<"school" | "unit" | "">("");
  const [featured, setFeatured] = useState<"" | "true" | "false">("");
  const [ordering, setOrdering] = useState<(typeof orderingOptions)[number]["value"]>("-updated_at");
  const [queueMode, setQueueMode] = useState<QueueMode>(authorRole === "unit_media" ? "mine" : "all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [editor, setEditor] = useState<{ mode: EditorMode; item: ContentItem | null } | null>(null);
  const [modeMenu, setModeMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem("besat-cms-content-filters-v2");
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, unknown>;
          if (parsed.kind === "all" || parsed.kind === "news" || parsed.kind === "announcement") setKind(parsed.kind);
          if (statusOptions.some((option) => option.value === parsed.status)) setStatus(parsed.status as ContentWorkflowStatus);
          if (parsed.scope === "school" || parsed.scope === "unit") setScope(parsed.scope);
          if (parsed.featured === "true" || parsed.featured === "false") setFeatured(parsed.featured);
          if (orderingOptions.some((option) => option.value === parsed.ordering)) setOrdering(parsed.ordering as (typeof orderingOptions)[number]["value"]);
          if (parsed.queueMode === "all" || parsed.queueMode === "mine") setQueueMode(parsed.queueMode);
        }
      } catch {
        // A malformed local preference must not block the real CMS queue.
      } finally {
        setFiltersReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    window.sessionStorage.setItem("besat-cms-content-filters-v2", JSON.stringify({
      kind,
      status,
      scope,
      featured,
      ordering,
      queueMode,
    }));
  }, [featured, filtersReady, kind, ordering, queueMode, scope, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const request = usePanelRequest(
    () => panelService.content({
      search: debouncedSearch,
      kind: kind === "all" ? "" : kind,
      status,
      scope,
      unit_id: numericId(unitId),
      featured,
      ordering,
      page,
      page_size: 20,
      author: queueMode === "mine" ? "me" : "",
    }),
    [debouncedSearch, featured, kind, ordering, page, queueMode, scope, status, unitId],
  );
  const items = useMemo(() => request.data?.results ?? [], [request.data]);
  const effectiveSelectedId = items.some((entry) => String(entry.id) === String(selectedId))
    ? selectedId
    : items[0]?.id ?? null;
  const selected = items.find((entry) => String(entry.id) === String(effectiveSelectedId)) ?? null;
  const defaultKind: ContentKind = kind === "all" ? "news" : kind;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedIds((current) => current.filter((id) => items.some((item) => String(item.id) === String(id))));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [items]);

  function onSaved(saved: ContentItem) {
    setSelectedId(saved.id);
    request.reload();
  }

  function resetFilters() {
    setSearch("");
    setStatus(reviewOnly ? "in_review" : "");
    setScope("");
    setFeatured("");
    setOrdering("-updated_at");
    setQueueMode(authorRole === "unit_media" ? "mine" : "all");
    setPage(1);
  }

  function toggleSelected(id: string | number) {
    setSelectedIds((current) => current.some((entry) => String(entry) === String(id))
      ? current.filter((entry) => String(entry) !== String(id))
      : [...current, id]);
  }

  function togglePageSelection() {
    const currentPageIds = items.map((item) => item.id);
    const allSelected = currentPageIds.length > 0
      && currentPageIds.every((id) => selectedIds.some((entry) => String(entry) === String(id)));
    setSelectedIds((current) => allSelected
      ? current.filter((entry) => !currentPageIds.some((id) => String(id) === String(entry)))
      : [...current, ...currentPageIds.filter((id) => !current.some((entry) => String(entry) === String(id)))]);
  }

  async function moveSelected(
    action: "archive" | "trash",
    ids = selectedIds,
  ) {
    const targets = items.filter((item) => ids.some((id) => String(id) === String(item.id)));
    if (!targets.length || !window.confirm("عملیات انتخاب‌شده برای " + targets.length.toLocaleString("fa-IR") + " محتوا انجام شود؟")) return;
    setBulkPending(true);
    setActionError(null);
    let completed = 0;
    const failures: string[] = [];
    for (const target of targets) {
      try {
        await panelService.contentAction(target.id, action, {}, target.version);
        completed += 1;
      } catch (reason) {
        failures.push(target.title + ": " + getApiErrorMessage(reason));
      }
    }
    setBulkPending(false);
    setSelectedIds([]);
    request.reload();
    if (failures.length) {
      setActionError(completed + " مورد انجام شد؛ " + failures.join(" | "));
    }
  }

  async function trashSelected() {
    if (!selected) return;
    await moveSelected("trash", [selected.id]);
  }

  if (editor) {
    return <EditorialEditor key={editor.mode + "-" + (editor.item?.id ?? "new")} open mode={editor.mode} item={editor.item} defaultKind={defaultKind} unitId={unitId} authorRole={authorRole} canPublish={canPublish} onClose={() => setEditor(null)} onSaved={onSaved} />;
  }

  if (request.loading && !request.data) return <PanelLoading label="در حال دریافت محتوا…" />;
  if (request.error && !request.data) return <PanelError message={request.error} onRetry={request.reload} />;

  const allPageSelected = items.length > 0
    && items.every((item) => selectedIds.some((id) => String(id) === String(item.id)));

  return (
    <div className="space-y-5">
      {actionError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p> : null}
      {request.error ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">به‌روزرسانی فهرست انجام نشد. <button type="button" onClick={request.reload} className="underline">تلاش مجدد</button></p> : null}
      {request.data?.summary ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{queueCards.map((card) => <button key={card.key} type="button" onClick={() => { setStatus(card.status); setPage(1); }} className={"panel-card text-right transition hover:border-blue-300 " + (status === card.status ? "ring-2 ring-blue-200" : "")}><PanelIcon name={card.icon} className="size-5 text-[#0b599b]" /><p className="mt-2 text-xs font-black text-slate-500">{statusLabels[card.status]}</p><b className="mt-1 block text-2xl text-[#172b43]">{request.data?.summary?.[card.key] ?? 0}</b></button>)}</section> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">{([["all", "همه محتواها"], ["news", "اخبار"], ["announcement", "اطلاعیه‌ها"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setKind(value); setPage(1); }} className={"rounded-md px-4 py-2 text-xs font-black " + (kind === value ? "bg-[#fff3de] text-[#a8660b]" : "text-slate-500 hover:bg-slate-50")}>{label}</button>)}</div>
        <div className="relative"><button type="button" onClick={() => setModeMenu((isOpen) => !isOpen)} className="panel-primary-button"><PanelIcon name="plus" className="size-5" />محتوای جدید<PanelIcon name="chevron" className="size-3 rotate-90" /></button>{modeMenu ? <div className="absolute left-0 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"><button type="button" onClick={() => { setEditor({ mode: "simple", item: null }); setModeMenu(false); }} className="flex w-full items-center gap-3 rounded-md p-3 text-right text-xs font-black text-[#173652] hover:bg-[#fff8ec]"><PanelIcon name="edit" className="size-5 text-[#d98a12]" />ادیتور ساده</button><button type="button" onClick={() => { setEditor({ mode: "advanced", item: null }); setModeMenu(false); }} className="flex w-full items-center gap-3 rounded-md p-3 text-right text-xs font-black text-[#173652] hover:bg-[#fff8ec]"><PanelIcon name="services" className="size-5 text-[#0b599b]" />ادیتور پیشرفته</button></div> : null}</div>
      </div>

      <section className="panel-split-layout grid gap-5 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="panel-card h-fit 2xl:sticky 2xl:top-28">
          {selected ? <><header className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-[#183a5b]">پیش‌نمایش محتوا</h2><ContentStatus status={selected.status} /></header>{selected.cover_image_url ? <img src={selected.cover_image_url} alt="" className="h-44 w-full rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs font-bold text-slate-400">بدون تصویر شاخص</div>}<h3 className="mt-4 text-lg font-black leading-8 text-[#172b43]">{selected.title}</h3>{selected.summary ? <p className="mt-2 text-xs font-bold leading-7 text-slate-500">{selected.summary}</p> : null}<dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-600"><dt>نویسنده:</dt><dd>{selected.author?.full_name ?? "ثبت نشده"}</dd><dt>واحد هدف:</dt><dd>{selected.scope === "school" ? "کل مدرسه" : selected.unit?.title ?? "واحد ثبت نشده"}</dd><dt>دسته‌بندی:</dt><dd>{selected.category?.title ?? "بدون دسته‌بندی"}</dd><dt>انتشار:</dt><dd>{formatDate(selected.published_at ?? selected.scheduled_at)}</dd></dl><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditor({ mode: "advanced", item: selected })} className="panel-secondary-button"><PanelIcon name="edit" className="size-4" />ویرایش</button><button type="button" onClick={() => void trashSelected()} className="panel-secondary-button !border-rose-200 !text-rose-600"><PanelIcon name="trash" className="size-4" />زباله‌دان</button></div></> : <PanelEmpty title="محتوایی برای پیش‌نمایش انتخاب نشده است." />}
        </aside>

        <section className="panel-card min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="panel-search"><PanelIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="جست‌وجو در عنوان یا خلاصه…" /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value as ContentWorkflowStatus | ""); setPage(1); }} className="panel-select" aria-label="وضعیت محتوا"><option value="">همه وضعیت‌ها</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={ordering} onChange={(event) => { setOrdering(event.target.value as (typeof orderingOptions)[number]["value"]); setPage(1); }} className="panel-select" aria-label="مرتب‌سازی محتوا">{orderingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={scope} onChange={(event) => { setScope(event.target.value as "school" | "unit" | ""); setPage(1); }} className="panel-select" aria-label="دامنه محتوا"><option value="">همه دامنه‌ها</option><option value="school">کل مجموعه</option><option value="unit">واحد آموزشی</option></select>
            <select value={featured} onChange={(event) => { setFeatured(event.target.value as "" | "true" | "false"); setPage(1); }} className="panel-select" aria-label="محتوای ویژه"><option value="">همه محتواها</option><option value="true">فقط ویژه</option><option value="false">غیرویژه</option></select>
            <div className="flex gap-2"><button type="button" onClick={() => { setQueueMode("all"); setPage(1); }} className={"panel-secondary-button flex-1 " + (queueMode === "all" ? "!border-blue-300 !text-blue-700" : "")}>همه صف‌ها</button><button type="button" onClick={() => { setQueueMode("mine"); setPage(1); }} className={"panel-secondary-button flex-1 " + (queueMode === "mine" ? "!border-blue-300 !text-blue-700" : "")}>کارهای من</button></div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-slate-500">فیلترها در همین مرورگر حفظ می‌شوند؛ «کارهای من» از فیلتر امن author=me استفاده می‌کند.</p><button type="button" onClick={resetFilters} className="panel-secondary-button"><PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها</button></div>
          {selectedIds.length ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#173652]"><span>{selectedIds.length.toLocaleString("fa-IR")} مورد انتخاب شده</span><button disabled={bulkPending} type="button" onClick={() => void moveSelected("archive")} className="panel-secondary-button">بایگانی گروهی</button><button disabled={bulkPending} type="button" onClick={() => void moveSelected("trash")} className="panel-secondary-button !border-rose-200 !text-rose-700">انتقال گروهی به زباله‌دان</button></div> : null}
          {items.length ? <><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="panel-table min-w-[62rem]"><thead><tr><th><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="انتخاب همه موارد صفحه" /></th><th>عنوان</th><th>نوع</th><th>دسته‌بندی</th><th>واحد آموزشی</th><th>وضعیت</th><th>نویسنده</th><th>تاریخ انتشار</th><th>عملیات</th></tr></thead><tbody>{items.map((entry) => <tr key={entry.id} onClick={() => setSelectedId(entry.id)} className={String(effectiveSelectedId) === String(entry.id) ? "is-selected" : ""}><td><input type="checkbox" checked={selectedIds.some((id) => String(id) === String(entry.id))} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelected(entry.id)} aria-label={"انتخاب " + entry.title} /></td><td className="max-w-64 whitespace-normal font-black leading-6 text-[#172b43]">{entry.title}</td><td>{entry.kind === "news" ? "خبر" : "اطلاعیه"}</td><td>{entry.category?.title ?? "—"}</td><td>{entry.scope === "school" ? "کل مدرسه" : entry.unit?.title ?? "—"}</td><td><ContentStatus status={entry.status} /></td><td>{entry.author?.full_name ?? "—"}</td><td>{formatDate(entry.published_at ?? entry.scheduled_at ?? entry.created_at)}</td><td><button type="button" onClick={(event) => { event.stopPropagation(); setEditor({ mode: "advanced", item: entry }); }} className="panel-icon-button !size-8" aria-label={"ویرایش " + entry.title}><PanelIcon name="more" className="size-4" /></button></td></tr>)}</tbody></table></div><footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>صفحه {page.toLocaleString("fa-IR")} — مجموع {(request.data?.count ?? 0).toLocaleString("fa-IR")} مورد</span><div className="flex gap-2"><button disabled={!request.data?.previous} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button" className="panel-secondary-button">صفحه قبل</button><button disabled={!request.data?.next} onClick={() => setPage((value) => value + 1)} type="button" className="panel-secondary-button">صفحه بعد</button></div></footer></> : <PanelEmpty title="محتوایی با این فیلترها پیدا نشد." />}
        </section>
      </section>
    </div>
  );
}
