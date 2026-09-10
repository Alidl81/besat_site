"use client";

/* eslint-disable @next/next/no-img-element */

import type { JSONContent } from "@tiptap/core";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContentBlockInserter } from "@/components/cms/content-block-inserter";
import { StatusBadge } from "@/components/crud/crud-ui";
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
import { BlockInspector } from "@/components/editor/block-inspector";
import {
  RichEditor,
  type ActiveBlockContext,
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
import { handleSelectableRowKeyDown } from "@/lib/dashboard/selectable-table-row";
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
  isImportant: boolean;
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
  { value: "archived", label: "آرشیوشده" },
];

const statusLabels: Record<ContentWorkflowStatus, string> = Object.fromEntries(
  statusOptions.map((option) => [option.value, option.label]),
) as Record<ContentWorkflowStatus, string>;

type QueueCard = {
  key: keyof ContentSummary;
  status: ContentWorkflowStatus;
  icon: "document" | "review" | "calendar" | "check";
};

// Split so the statuses that drive daily action (someone needs to write,
// review, or fix something today) stay visually prominent, while
// end-of-lifecycle statuses (scheduled/archived) -- true but checked far
// less often -- don't compete with them for attention.
const primaryQueueCards: QueueCard[] = [
  { key: "draft", status: "draft", icon: "document" },
  { key: "in_review", status: "in_review", icon: "review" },
  { key: "changes_requested", status: "changes_requested", icon: "review" },
  { key: "approved", status: "approved", icon: "check" },
  { key: "published", status: "published", icon: "check" },
];

const secondaryQueueCards: QueueCard[] = [
  { key: "scheduled", status: "scheduled", icon: "calendar" },
  { key: "archived", status: "archived", icon: "document" },
];

const orderingOptions = [
  { value: "-updated_at", label: "آخرین ویرایش" },
  { value: "updated_at", label: "قدیمی‌ترین ویرایش" },
  { value: "title", label: "عنوان (الف تا ی)" },
  { value: "-title", label: "عنوان (ی تا الف)" },
  { value: "published_at", label: "قدیمی‌ترین انتشار" },
  { value: "-published_at", label: "آخرین انتشار" },
] as const;

// Identifies *which* table is active, not just that a table is active, so
// switching between two different tables can be told apart from staying
// inside the same one.
function activeTableBlockIndex(
  activeBlock: Pick<ActiveBlockContext, "kind" | "index"> | null,
): number | null {
  return activeBlock?.kind === "table" ? activeBlock.index : null;
}

// Decides whether the table Inspector's "explicitly opened" flag should be
// reset for the current render. Exported standalone (pure, no React) so the
// Table A -> Table B inspector-state-leak regression can be covered by a
// plain unit test without mounting this whole component: tracking only
// block "kind" (as an earlier version of this logic did) can't tell two
// different tables apart, so switching straight from Table A to Table B
// never triggered a reset and Table B silently inherited Table A's
// explicit-open state.
export function nextTableInspectorState(
  activeBlock: Pick<ActiveBlockContext, "kind" | "index"> | null,
  lastActiveTableIndex: number | null,
): { lastActiveTableIndex: number | null; shouldReset: boolean } {
  const currentTableIndex = activeTableBlockIndex(activeBlock);
  return {
    lastActiveTableIndex: currentTableIndex,
    shouldReset: currentTableIndex !== lastActiveTableIndex,
  };
}

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
    isImportant: item?.is_important ?? false,
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

function FieldErrors({ errors, field, id }: { errors: ApiFieldErrors; field: string; id?: string }) {
  const messages = fieldMessages(errors, field);
  if (!messages.length) return null;
  return <small id={id} role="alert" className="mt-1 block text-xs font-bold text-rose-600">{messages.join(" ")}</small>;
}

function ContentStatus({ status }: { status: ContentWorkflowStatus }) {
  return <StatusBadge status={status} />;
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
  // FE-CMS-EDITOR-DETAIL-ERROR-RECOVERY-001: a failed detail fetch left
  // `currentItem`/`draft` at whatever the list-summary `item` prop already
  // was (incomplete -- no body_html, etc.) with no signal that Save would
  // submit that stale/incomplete draft rather than the real content. The
  // generic `errorText` banner (reused by every other action in this
  // component) gets cleared by the next unrelated action, and the status
  // text fell through to "autosave active" once `detailLoading` settled,
  // implying everything was fine.
  const [detailError, setDetailError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorText, setErrorText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [conflict, setConflict] = useState<ConflictState>(null);
  const [workflowComment, setWorkflowComment] = useState("");
  // FE-CMS-REVIEW-REJECT-NOTE-FOCUS-001: the "بازخورد گردش کار" <details>
  // group defaults to collapsed and had no way to open programmatically --
  // a blank-reject validation error rendered inside it, but the reviewer
  // never saw the group open or the field gain focus, leaving the mandatory
  // control hidden. workflowFeedbackOpen makes the group's `open` state
  // controllable so a blank reject can reveal it.
  const [workflowFeedbackOpen, setWorkflowFeedbackOpen] = useState(false);
  const workflowCommentRef = useRef<HTMLTextAreaElement>(null);
  const workflowCommentErrorId = useId();
  // FE-CMS-REVIEW-REJECT-NOTE-FOCUS-001 (residual): calling .focus() in the
  // very same synchronous handler that also calls setWorkflowFeedbackOpen(true)
  // is a no-op -- the browser still sees a collapsed <details> (React hasn't
  // committed the `open` attribute change yet), and focusing an element
  // inside a still-collapsed <details> silently fails. Deferring the actual
  // focus() call to an effect keyed on this counter guarantees it only runs
  // after the group has actually re-rendered open in the DOM. A counter
  // (not a boolean) so a second blank-reject attempt in a row still
  // re-triggers the effect even though the previous value was already true.
  const [pendingCommentFocus, setPendingCommentFocus] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSource>("local");
  const [serverPreview, setServerPreview] = useState<ContentItem | null>(null);
  const [activeRevision, setActiveRevision] = useState<ContentRevision | null>(null);
  const [revisionComparison, setRevisionComparison] = useState<ContentRevisionComparison | null>(null);
  const [revisionComparisonLoading, setRevisionComparisonLoading] = useState(false);
  const [revisionComparisonError, setRevisionComparisonError] = useState("");
  // FE-CMS-EDITOR-REVISION-COMPARISON-RACE-001: openRevisionComparison()
  // set revisionComparison unconditionally once its request resolved, with
  // no fence against a NEWER comparison (or a close/switch-to-preview)
  // having since superseded it -- comparing revision A, closing, then
  // comparing revision B, could have B's diff silently replaced by A's
  // once A's slower response finally landed. A plain monotonic counter,
  // bumped at the start of every action that changes what's currently
  // being viewed (a new comparison request, closing the dialog, or
  // switching to the local/server preview), captured at call time and
  // compared at completion time, lets a superseded response recognize
  // itself and discard its own result instead of overwriting whatever is
  // now on screen.
  const revisionComparisonSeqRef = useRef(0);
  const [outline, setOutline] = useState<EditorOutlineItem[]>([]);
  const [activeBlock, setActiveBlock] = useState<ActiveBlockContext | null>(null);
  // Table is the one complex block whose Inspector does NOT open just from
  // selection -- it only opens once the user explicitly clicks the small
  // settings trigger RichEditor renders over the selected table (see
  // onTableSettingsClick below). This flag tracks that explicit request and
  // is cleared as soon as the selection leaves THIS table (moving to a
  // different block, or to a *different* table -- switching straight from
  // Table A to Table B must NOT let Table B inherit Table A's open
  // inspector), so re-entering requires clicking the trigger again rather
  // than the inspector popping open on its own.
  const [tableInspectorRequested, setTableInspectorRequested] = useState(false);
  // Resets tableInspectorRequested the moment the active table identity
  // changes -- done during render (React's documented pattern for
  // "adjusting state when a prop/derived value changes") rather than in a
  // useEffect, since a synchronous setState inside an effect body causes an
  // extra cascading render for no benefit here.
  const [lastActiveTableIndex, setLastActiveTableIndex] = useState<number | null>(null);
  const tableInspectorTransition = nextTableInspectorState(activeBlock, lastActiveTableIndex);
  if (tableInspectorTransition.shouldReset) {
    setLastActiveTableIndex(tableInspectorTransition.lastActiveTableIndex);
    setTableInspectorRequested(false);
  }
  const [stats, setStats] = useState<EditorDocumentStats>({
    blocks: 0,
    characters: 0,
    words: 0,
    readingMinutes: 1,
  });
  // FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: two separate signals, deliberately
  // not merged into one. `uploading` (state) is cosmetic only -- it drives
  // the status label and the buttons' `disabled` attribute, and is fed
  // directly by each child's own onUploadState(active) callback exactly as
  // before. RichEditor's own onUploadState fires true/false around each of
  // its independent upload call sites, so two overlapping RichEditor
  // uploads (a multi-file paste/drop, or a paste racing a replace-image
  // action) can report a premature `false` while a *different* upload it
  // started is still in flight -- that signal is good enough for a status
  // label, but not trustworthy enough to gate an actual save. The real
  // gate is `pendingUploadCountRef`, a plain counter incremented/decremented
  // only by work this component itself directly awaits: uploadEditorMedia's
  // own try/finally (the real RichEditor upload calls), and
  // ContentBlockInserter's onUploadState (safe to also treat as
  // authoritative there -- its own handleFiles() emits exactly one true
  // before, and one false strictly after, its whole sequential upload
  // batch, with a reentrancy guard preventing any overlap). save(),
  // workflow(), and openPreview() read the ref directly, synchronously, at
  // call time, instead of trusting the possibly-stale `uploading` state.
  const [uploading, setUploading] = useState(false);
  const pendingUploadCountRef = useRef(0);
  function trackAuthoritativeUpload(active: boolean) {
    if (active) {
      pendingUploadCountRef.current += 1;
    } else {
      pendingUploadCountRef.current = Math.max(0, pendingUploadCountRef.current - 1);
    }
  }
  const [revisionCache, setRevisions] = useState<ContentRevision[]>([]);
  const [revisionsContentId, setRevisionsContentId] = useState<string | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const editVersion = useRef(0);
  const currentItemRef = useRef<ContentItem | null>(item);
  const saveQueue = useRef<SerialSaveQueue<ContentItem>>(createSerialSaveQueue<ContentItem>());
  // FE-CMS-EDITOR-SAVE-DOUBLE-SUBMIT-001: `saving` is state-backed, so two
  // same-tick save()/workflow() calls both read it as `false` before either
  // update commits. The serial queue below is deliberate -- it still needs
  // to sequence a background autosave against a later manual save/workflow
  // action -- so this guard only collapses literal duplicate re-entrant
  // calls into save()/workflow() themselves; it does not touch persist()
  // or the queue.
  const savingRef = useRef(false);
  const previewDialogRef = useRef<HTMLElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const previewOpenerRef = useRef<HTMLElement | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // This editor replaces the content list in place (not a real navigation),
  // so nothing moves the document scroll position or focus to match --
  // whatever scrollY the list happened to be at carries over onto a much
  // shorter form, and the browser leaves focus on <body>. Moving focus to
  // the editor's own heading on mount both scrolls it into view natively
  // and gives keyboard/AT users a deliberate starting point.
  useEffect(() => {
    editorHeadingRef.current?.focus();
  }, []);

  const canReview = canPublish || authorRole === "unit_manager";

  const applyFailure = useCallback((reason: unknown) => {
    const message = getApiErrorMessage(reason);
    setErrorText(message);
    setSaveState("error");
    if (reason instanceof ApiError) {
      setFieldErrors(reason.fieldErrors);
      if (reason.fieldErrors.title) {
        titleInputRef.current?.focus();
      }
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
    // FE-CMS-EDITOR-DETAIL-HYDRATION-LOSS-001: the form fields stay
    // interactive while this request is in flight (there's no loading
    // gate on them), so a user who starts editing before the detail
    // response lands used to have their edit silently overwritten the
    // moment it arrived -- `setDraft`/`setDirty(false)` ran unconditionally.
    // `editVersion` (bumped by every field edit, see `update()` below) is
    // the same call-time-captured guard `persist()` already uses to detect
    // "did the user edit since I started" for the save path; applying it
    // here too skips re-hydrating the draft from a response that's now
    // stale relative to an edit the user has already made.
    const versionAtStart = editVersion.current;
    try {
      const loaded = await panelService.contentItem(contentId);
      currentItemRef.current = loaded;
      setCurrentItem(loaded);
      if (editVersion.current === versionAtStart) {
        setDraft(draftFrom(loaded, defaultKind, unitId));
        setDirty(false);
      }
      setConflict(null);
      setDetailError(false);
      // FE-CMS-EDITOR-DETAIL-ERROR-STALE-ALERT-001: a successful retry
      // cleared the dedicated detailError alert but left the earlier
      // failure's generic `errorText` banner (set by applyFailure() below
      // on the FIRST attempt) stuck on screen indefinitely -- nothing else
      // clears it until some unrelated action happens to overwrite it.
      setErrorText("");
    } catch (reason) {
      applyFailure(reason);
      setDetailError(true);
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

  // The reviewer's rejection note is the most recent revision recorded
  // against the raw backend "rejected" status (serialize_content_item
  // renames it to "changes_requested" for the frontend, but revision
  // snapshots keep the raw model value) -- shown only while the content is
  // actually in that state, so it disappears once the author moves past it.
  const latestChangesFeedback = currentItem?.status === "changes_requested"
    ? revisions.find((revision) => (revision.snapshot.status as string) === "rejected") ?? null
    : null;

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
    ...(draft.kind === "news" ? { is_important: draft.isImportant } : {}),
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
    // FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: RichEditor's onUploadMedia
    // callback hasn't inserted its result into the document yet while an
    // upload is pending -- saving right now would persist body_html as it
    // exists at this exact instant, missing the media the user is
    // actively in the middle of adding (or, for the block-inserter
    // upload path, could persist a shorter document than what the user
    // sees once the insertion lands). Checked via the authoritative ref
    // (see its declaration above), not the cosmetic `uploading` state.
    if (pendingUploadCountRef.current > 0) {
      setErrorText("بارگذاری تصویر یا فایل هنوز تمام نشده است. لطفاً صبر کنید.");
      return;
    }
    // FE-CMS-EDITOR-DETAIL-ERROR-RECOVERY-001: the disabled attribute on
    // the save/workflow buttons already covers the normal click path, but
    // this form's own onSubmit still fires on a plain Enter keypress
    // regardless of any button's disabled state -- so both save() and
    // workflow() must also refuse to persist a draft built from an
    // incomplete detail fetch, the same way the upload-pending guard
    // above does.
    if (detailError) {
      setErrorText("دریافت نسخه کامل این محتوا ناموفق بود. پیش از ذخیره، «تلاش دوباره» را بزنید.");
      return;
    }
    if (conflict) {
      setErrorText("نسخه شما قدیمی است. ابتدا نسخه جدید را دریافت کنید.");
      setSaveState("conflict");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrorText("");
    setFieldErrors({});
    try {
      await persist();
    } catch (reason) {
      applyFailure(reason);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  async function workflow(action: ContentWorkflowAction) {
    // FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: same guard/rationale as save()
    // above -- a workflow transition (submit for review, publish, etc.)
    // persists the current draft just like a plain save does, and must
    // not run while an upload is still in flight for the same reason.
    if (pendingUploadCountRef.current > 0) {
      setErrorText("بارگذاری تصویر یا فایل هنوز تمام نشده است. لطفاً صبر کنید.");
      return;
    }
    // FE-CMS-EDITOR-DETAIL-ERROR-RECOVERY-001: the disabled attribute on
    // the save/workflow buttons already covers the normal click path, but
    // this form's own onSubmit still fires on a plain Enter keypress
    // regardless of any button's disabled state -- so both save() and
    // workflow() must also refuse to persist a draft built from an
    // incomplete detail fetch, the same way the upload-pending guard
    // above does.
    if (detailError) {
      setErrorText("دریافت نسخه کامل این محتوا ناموفق بود. پیش از ذخیره، «تلاش دوباره» را بزنید.");
      return;
    }
    if (conflict) {
      setErrorText("نسخه شما قدیمی است. ابتدا نسخه جدید را دریافت کنید.");
      setSaveState("conflict");
      return;
    }
    if (savingRef.current) return;
    if (action === "reject" && !workflowComment.trim()) {
      setFieldErrors({ comment: ["برای درخواست اصلاح، بازخورد سردبیر را بنویسید."] });
      setErrorText("بازخورد اصلاحات لازم است.");
      // FE-CMS-REVIEW-REJECT-NOTE-FOCUS-001: the field error above rendered
      // correctly but stayed hidden inside the collapsed "بازخورد گردش کار"
      // details group with no focus movement -- open the group here; the
      // actual focus() call happens in the effect below, once the group has
      // genuinely re-rendered open in the DOM (see pendingCommentFocus).
      setWorkflowFeedbackOpen(true);
      setPendingCommentFocus((current) => current + 1);
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

    savingRef.current = true;
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
      savingRef.current = false;
    }
  }

  // FE-CMS-REVIEW-REJECT-NOTE-FOCUS-001: runs after workflowFeedbackOpen has
  // actually committed to the DOM. useLayoutEffect (not useEffect) so this
  // fires synchronously right after that DOM mutation and before the
  // browser paints -- not deferred to a later passive-effect pass -- so the
  // <details> is guaranteed genuinely open and its textarea genuinely
  // focusable by the time this runs, unlike calling .focus() directly
  // inside the same synchronous handler that requests the group open.
  useLayoutEffect(() => {
    if (pendingCommentFocus === 0) return;
    workflowCommentRef.current?.focus();
  }, [pendingCommentFocus]);

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
    // FE-CMS-EDITOR-COVER-UPLOAD-DOUBLE-SUBMIT-001: shares the `saving`
    // guard used by save()/workflow() -- the cover file input isn't
    // disabled while `saving` is true (state hasn't re-rendered yet
    // either way), so two same-tick cover changes both reached
    // uploadMedia without this.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrorText("");
    // FE-CMS-COVER-PREVIEW-UPLOAD-RACE-001: this upload is awaited
    // directly by this component (matching the `pendingUploadCountRef`
    // contract described above uploadEditorMedia), but it never reported
    // into that authoritative gate -- only into the `saving`/`savingRef`
    // pair, which save()/workflow() already check but openPreview() does
    // not. With an unrelated editor-media upload settling in the
    // meantime (correctly returning pendingUploadCountRef to 0), Preview
    // read that ref as "nothing pending" and opened a local preview built
    // from the draft's still-stale coverImageUrl while this upload was
    // genuinely still in flight.
    trackAuthoritativeUpload(true);
    try {
      const media = await panelService.uploadMedia(file, {
        unitId: numericId(unitId),
        altText: draft.title,
      });
      update("coverImageUrl", media.url);
    } catch (reason) {
      applyFailure(reason);
    } finally {
      trackAuthoritativeUpload(false);
      setSaving(false);
      savingRef.current = false;
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function uploadEditorMedia(file: File) {
    trackAuthoritativeUpload(true);
    try {
      return await panelService.uploadMedia(file, {
        unitId: numericId(unitId),
        altText: file.name,
      });
    } catch (reason) {
      applyFailure(reason);
      throw reason;
    } finally {
      trackAuthoritativeUpload(false);
    }
  }

  async function restoreRevision(selectedRevision: ContentRevision) {
    if (!currentItem || !window.confirm("نسخه انتخاب‌شده جایگزین محتوای فعلی شود؟")) return;
    if (conflict) {
      setErrorText("برای بازگردانی، ابتدا نسخه جدید محتوا را دریافت کنید.");
      return;
    }
    // FE-CMS-EDITOR-RESTORE-DOUBLE-SUBMIT-001: shares the savingRef guard
    // already used by save()/workflow()/uploadCover() -- this entry point
    // was missed when that guard was added.
    if (savingRef.current) return;
    savingRef.current = true;
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
      savingRef.current = false;
    }
  }

  async function loadLatest() {
    if (!currentItem || (dirty && !window.confirm("نسخه محلی ذخیره‌نشده حذف و نسخه جدید سرور دریافت شود؟"))) {
      return;
    }
    await loadDetail(currentItem.id);
  }

  function closePreview() {
    revisionComparisonSeqRef.current += 1;
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
    const requestSeq = ++revisionComparisonSeqRef.current;
    try {
      const comparison = await panelService.contentRevisionComparison(
        currentItem.id,
        selectedRevision.id,
      );
      if (revisionComparisonSeqRef.current !== requestSeq) return;
      setRevisionComparison(comparison);
    } catch (reason) {
      if (revisionComparisonSeqRef.current !== requestSeq) return;
      setRevisionComparisonError(getApiErrorMessage(reason));
    } finally {
      if (revisionComparisonSeqRef.current === requestSeq) {
        setRevisionComparisonLoading(false);
      }
    }
  }

  async function openPreview() {
    // FE-CMS-EDITOR-UPLOAD-SAVE-RACE-001: a local preview renders the
    // current draft as-is -- opening it mid-upload would show the
    // document missing whatever media the user is actively in the middle
    // of adding, which is misleading even though (unlike save/workflow)
    // it doesn't persist anything.
    if (pendingUploadCountRef.current > 0) {
      setErrorText("بارگذاری تصویر یا فایل هنوز تمام نشده است. لطفاً صبر کنید.");
      return;
    }
    // FE-CMS-EDITOR-PREVIEW-STALE-DETAIL-001: the header button's disabled
    // attribute already covers the normal click path, but this guards the
    // function itself too (consistent with save()/workflow() above) --
    // opening a preview while the detail fetch is still failing/in flight
    // would show stale/incomplete content and, for the "server preview"
    // branch below, fire a second, premature detail request before the
    // user has even retried the first one.
    if (detailError || detailLoading) {
      return;
    }
    previewOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    revisionComparisonSeqRef.current += 1;
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
      onActiveBlockChange={setActiveBlock}
      onTableSettingsClick={() => setTableInspectorRequested(true)}
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
        {currentItem?.status === "archived" ? (
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
          {draft.kind === "news" ? (
            <label className="besat-editor-switch"><input type="checkbox" checked={draft.isImportant} onChange={(event) => update("isImportant", event.target.checked)} /><span aria-hidden="true" /><b>نمایش در بخش «اخبار و رویدادها»ی صفحه نخست</b></label>
          ) : null}
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
          <input ref={coverInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
          {draft.coverImageUrl ? <img src={draft.coverImageUrl} alt="پیش‌نمایش تصویر شاخص" className="besat-editor-cover-preview" /> : <p className="besat-editor-cover-empty">هنوز تصویر شاخص انتخاب نشده است.</p>}
          <button type="button" onClick={() => coverInput.current?.click()} className="panel-secondary-button w-full"><EditorIcon name="upload" className="size-4" />{draft.coverImageUrl ? "جایگزینی تصویر" : "بارگذاری تصویر"}</button>
          <FieldErrors errors={fieldErrors} field="cover_image_url" />
        </div>
      </details>

      <details
        className="besat-editor-setting-group"
        open={workflowFeedbackOpen}
        onToggle={(event) => setWorkflowFeedbackOpen(event.currentTarget.open)}
      >
        <summary>بازخورد گردش کار <EditorIcon name="chevron-down" /></summary>
        <div className="besat-editor-setting-body">
          <label>
            <span>یادداشت برای بازبینی یا اصلاح</span>
            <textarea
              ref={workflowCommentRef}
              value={workflowComment}
              onChange={(event) => {
                setWorkflowComment(event.target.value);
                if (fieldErrors.comment) {
                  setFieldErrors((current) => {
                    const rest = { ...current };
                    delete rest.comment;
                    return rest;
                  });
                }
              }}
              className="panel-input min-h-24"
              placeholder="برای درخواست اصلاح، این بازخورد الزامی است."
              aria-invalid={Boolean(fieldMessages(fieldErrors, "comment").length)}
              aria-describedby={fieldMessages(fieldErrors, "comment").length ? workflowCommentErrorId : undefined}
            />
            <FieldErrors errors={fieldErrors} field="comment" id={workflowCommentErrorId} />
          </label>
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
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }} noValidate className="besat-editor-studio" dir="rtl">
      <header className="besat-editor-studio-header">
        <div className="besat-editor-studio-title">
          <button type="button" onClick={close} aria-label="بازگشت به فهرست محتوا"><EditorIcon name="chevron-left" /></button>
          <div><p>مدیریت محتوا / {currentItem ? "ویرایش محتوا" : "محتوای جدید"}</p><h2 ref={editorHeadingRef} tabIndex={-1}>ادیتور {mode === "simple" ? "ساده" : "پیشرفته"}</h2></div>
        </div>
        <div className="besat-editor-header-actions">
          <span role="status" aria-live="polite" className={"besat-editor-save-state " + (saveState === "error" || saveState === "conflict" ? "is-error" : "")}>
            <i aria-hidden="true" />
            {detailLoading ? "در حال دریافت نسخه ویرایش…" : detailError ? "خطا در دریافت نسخه ویرایش" : saving || uploading ? "در حال ذخیره یا بارگذاری…" : saveState === "conflict" ? "تعارض نسخه: ذخیره خودکار متوقف شد" : dirty ? "تغییرات ذخیره‌نشده" : saveState === "saved" ? "ذخیره شد · " + formatDate(currentItem?.updated_at) : "ذخیره خودکار فعال است"}
          </span>
          <button type="button" disabled={previewLoading || uploading || saving || detailError || detailLoading} onClick={() => void openPreview()} className="panel-secondary-button"><PanelIcon name="eye" className="size-4" />{previewLoading ? "دریافت پیش‌نمایش…" : "پیش‌نمایش"}</button>
        </div>
      </header>

      {errorText ? <p role="alert" className="besat-editor-error">{errorText}</p> : null}
      {detailError ? <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-950"><p>دریافت نسخه کامل این محتوا ناموفق بود. تا دریافت موفق، محتوای نمایش‌داده‌شده ممکن است ناقص باشد و ذخیره غیرفعال شده است.</p><button type="button" onClick={() => { const retryId = currentItem?.id ?? item?.id; if (retryId) void loadDetail(retryId); }} className="mt-2 underline">تلاش دوباره</button></section> : null}
      {conflict ? <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"><p>نسخه دیگری از این محتوا در {formatDate(conflict.updatedAt)} ذخیره شده است. تغییرات شما بدون دریافت نسخه جدید ارسال نمی‌شوند.</p><FieldErrors errors={fieldErrors} field="version" /><button type="button" onClick={() => void loadLatest()} className="mt-2 underline">دریافت نسخه جدید از سرور</button></section> : null}
      {latestChangesFeedback ? (
        <section role="status" className="besat-editor-review-feedback">
          <p className="besat-editor-review-feedback-title">
            <EditorIcon name="close" className="size-4" />
            بازخورد بازبینی — نیازمند اصلاح
          </p>
          <p className="besat-editor-review-feedback-body">{latestChangesFeedback.note}</p>
          <p className="besat-editor-review-feedback-meta">
            {latestChangesFeedback.actor?.full_name ?? "سردبیر"} · {formatDate(latestChangesFeedback.created_at)}
          </p>
        </section>
      ) : null}

      <div dir="ltr" className={"besat-editor-layout " + (mode === "advanced" ? "is-advanced" : "is-simple")}>
        {mode === "advanced" ? (
          <aside dir="rtl" className="besat-editor-left-column">
            <EditorDocumentOutline
              editorRef={editorRef}
              outline={outline}
              inspector={
                activeBlock && (activeBlock.kind !== "table" || tableInspectorRequested) ? (
                  <BlockInspector block={activeBlock} onReplaceImage={() => editorRef.current?.replaceImage()} />
                ) : undefined
              }
            >
              <ContentBlockInserter
                value=""
                onChange={(html) => editorRef.current?.insertHtml(html)}
                unitId={unitId}
                variant="sidebar"
                onUploadState={(active) => { trackAuthoritativeUpload(active); setUploading(active); }}
              />
            </EditorDocumentOutline>
          </aside>
        ) : null}
        <div dir="rtl" className="besat-editor-document">
          <div className="besat-editor-document-meta">
            <label><span>عنوان محتوا <b aria-hidden="true">*</b></span><input ref={titleInputRef} required value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="عنوان دقیق و خوانای محتوا را بنویسید" aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "editorial-title-error" : undefined} /><FieldErrors errors={fieldErrors} field="title" id="editorial-title-error" /></label>
            <label><span>خلاصه</span><textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="خلاصه کوتاه برای کارت خبر و نتایج جست‌وجو" /><small>{draft.summary.length.toLocaleString("fa-IR")} نویسه</small><FieldErrors errors={fieldErrors} field="summary" /></label>
          </div>
          {mode === "simple" && draft.coverImageUrl ? <img src={draft.coverImageUrl} alt="" className="besat-editor-inline-cover" /> : null}
          <div className="besat-editor-document-label"><span>متن اصلی</span><div><b>{stats.words.toLocaleString("fa-IR")}</b> واژه · <b>{stats.readingMinutes.toLocaleString("fa-IR")}</b> دقیقه مطالعه · <b>{stats.blocks.toLocaleString("fa-IR")}</b> بلوک</div></div>
          {editor}
          <FieldErrors errors={fieldErrors} field="body_json" />
          <FieldErrors errors={fieldErrors} field="body_html" />
        </div>
        <div dir="rtl" className="besat-editor-right-column">{settings}</div>
      </div>

      <footer className="besat-editor-actionbar">
        <div>{currentItem ? <StatusBadge status={currentItem.status} /> : <span className="panel-status">محتوای جدید</span>}<small>میان‌بر ذخیره: Ctrl/⌘ + S</small></div>
        <div>
          <button disabled={saving || uploading || detailError} type="submit" className="panel-secondary-button"><PanelIcon name="document" className="size-4" />ذخیره</button>
          {!currentItem || currentItem.status === "draft" || currentItem.status === "changes_requested" ? <button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("submit-review")} className="panel-primary-button"><PanelIcon name="review" className="size-4" />ارسال برای بررسی</button> : null}
          {currentItem?.status === "in_review" && canReview ? <><button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("reject")} className="panel-secondary-button !border-rose-200 !text-rose-700"><EditorIcon name="close" className="size-4" />درخواست اصلاح</button><button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("approve")} className="panel-secondary-button !border-emerald-200 !text-emerald-700"><EditorIcon name="check" className="size-4" />تأیید</button></> : null}
          {canPublish && currentItem?.status === "approved" ? <button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow(draft.scheduledAt ? "schedule" : "publish")} className="panel-primary-button !bg-[#d98712]"><PanelIcon name={draft.scheduledAt ? "calendar" : "check"} className="size-4" />{draft.scheduledAt ? "زمان‌بندی انتشار" : "انتشار نهایی"}</button> : null}
          {canPublish && currentItem?.status === "scheduled" ? <button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("publish")} className="panel-primary-button !bg-[#d98712]"><PanelIcon name="check" className="size-4" />انتشار اکنون</button> : null}
          {currentItem?.status === "published" ? <button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("archive")} className="panel-secondary-button"><PanelIcon name="document" className="size-4" />آرشیو</button> : null}
          {currentItem?.status === "archived" ? <button disabled={saving || uploading || detailError} type="button" onClick={() => void workflow("restore")} className="panel-primary-button"><PanelIcon name="document" className="size-4" />بازگردانی به پیش‌نویس</button> : null}
        </div>
      </footer>

      {previewOpen ? (
        <div
          className="besat-editor-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            // Without this, the browser's native mousedown default action
            // shifts focus to the nearest focusable ancestor of the backdrop
            // before our own close/focus-restore logic gets a chance to act.
            event.preventDefault();
            closePreview();
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  // FE-CMS-EDITOR-BULK-ARCHIVE-DOUBLE-SUBMIT-001: `bulkPending` is
  // state-backed, so two same-tick clicks both started the batch before
  // either update committed.
  const bulkPendingRef = useRef(false);
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
    action: "archive",
    ids = selectedIds,
  ) {
    const targets = items.filter((item) => ids.some((id) => String(id) === String(item.id)));
    if (!targets.length || !window.confirm("عملیات انتخاب‌شده برای " + targets.length.toLocaleString("fa-IR") + " محتوا انجام شود؟")) return;
    if (bulkPendingRef.current) return;
    bulkPendingRef.current = true;
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
    bulkPendingRef.current = false;
    setBulkPending(false);
    setSelectedIds([]);
    request.reload();
    if (failures.length) {
      setActionError(completed + " مورد انجام شد؛ " + failures.join(" | "));
    }
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
      {request.data?.summary ? (
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {primaryQueueCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => { setStatus(card.status); setPage(1); }}
                className={"panel-card text-right transition hover:border-blue-300 " + (status === card.status ? "ring-2 ring-blue-200" : "")}
              >
                <PanelIcon name={card.icon} className="size-5 text-[#0b599b]" />
                <p className="mt-2 text-xs font-black text-slate-500">{statusLabels[card.status]}</p>
                <b className="mt-1 block text-2xl text-[#172b43]">{request.data?.summary?.[card.key] ?? 0}</b>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {secondaryQueueCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => { setStatus(card.status); setPage(1); }}
                className={"flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:border-blue-300 hover:bg-blue-50 " + (status === card.status ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500")}
              >
                <span>{statusLabels[card.status]}</span>
                <b className="text-[#172b43]">{request.data?.summary?.[card.key] ?? 0}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">{([["all", "همه محتواها"], ["news", "اخبار"], ["announcement", "اطلاعیه‌ها"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setKind(value); setPage(1); }} className={"rounded-md px-4 py-2 text-xs font-black " + (kind === value ? "bg-[#fff3de] text-[#8a5709]" : "text-slate-500 hover:bg-slate-50")}>{label}</button>)}</div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setEditor({ mode: "simple", item: null })}
            className="flex items-center gap-2 border-l border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-[#173652] transition hover:bg-[#fff8ec]"
          >
            <PanelIcon name="edit" className="size-4 text-[#d98a12]" />
            محتوای جدید · ساده
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: "advanced", item: null })}
            className="flex items-center gap-2 bg-[#12395b] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0d2f4d]"
          >
            <PanelIcon name="services" className="size-4" />
            محتوای جدید · پیشرفته
          </button>
        </div>
      </div>

      <section className="panel-split-layout grid gap-5 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="panel-card h-fit 2xl:sticky 2xl:top-28">
          {selected ? <><header className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-[#183a5b]">پیش‌نمایش محتوا</h2><ContentStatus status={selected.status} /></header>{selected.cover_image_url ? <img src={selected.cover_image_url} alt="" className="h-44 w-full rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs font-bold text-slate-500">بدون تصویر شاخص</div>}<h3 className="mt-4 text-lg font-black leading-8 text-[#172b43]">{selected.title}</h3>{selected.summary ? <p className="mt-2 text-xs font-bold leading-7 text-slate-500">{selected.summary}</p> : null}<dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-600"><dt>نویسنده:</dt><dd>{selected.author?.full_name ?? "ثبت نشده"}</dd><dt>واحد هدف:</dt><dd>{selected.scope === "school" ? "کل مدرسه" : selected.unit?.title ?? "واحد ثبت نشده"}</dd><dt>دسته‌بندی:</dt><dd>{selected.category?.title ?? "بدون دسته‌بندی"}</dd><dt>انتشار:</dt><dd>{formatDate(selected.published_at ?? selected.scheduled_at)}</dd></dl><div className="mt-5"><button type="button" onClick={() => setEditor({ mode: "advanced", item: selected })} className="panel-secondary-button w-full"><PanelIcon name="edit" className="size-4" />ویرایش</button></div></> : <PanelEmpty title="محتوایی برای پیش‌نمایش انتخاب نشده است." />}
        </aside>

        <section className="panel-card min-w-0">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="panel-search"><PanelIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="panel-input" placeholder="جست‌وجو در عنوان یا خلاصه…" aria-label="جست‌وجو در عنوان یا خلاصه" /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value as ContentWorkflowStatus | ""); setPage(1); }} className="panel-select" aria-label="وضعیت محتوا"><option value="">همه وضعیت‌ها</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={ordering} onChange={(event) => { setOrdering(event.target.value as (typeof orderingOptions)[number]["value"]); setPage(1); }} className="panel-select" aria-label="مرتب‌سازی محتوا">{orderingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={scope} onChange={(event) => { setScope(event.target.value as "school" | "unit" | ""); setPage(1); }} className="panel-select" aria-label="دامنه محتوا"><option value="">همه دامنه‌ها</option><option value="school">کل مجموعه</option><option value="unit">واحد آموزشی</option></select>
            <select value={featured} onChange={(event) => { setFeatured(event.target.value as "" | "true" | "false"); setPage(1); }} className="panel-select" aria-label="محتوای ویژه"><option value="">همه محتواها</option><option value="true">فقط ویژه</option><option value="false">غیرویژه</option></select>
            <div className="flex gap-2"><button type="button" onClick={() => { setQueueMode("all"); setPage(1); }} className={"panel-secondary-button flex-1 " + (queueMode === "all" ? "!border-blue-300 !text-blue-700" : "")}>همه صف‌ها</button><button type="button" onClick={() => { setQueueMode("mine"); setPage(1); }} className={"panel-secondary-button flex-1 " + (queueMode === "mine" ? "!border-blue-300 !text-blue-700" : "")}>کارهای من</button></div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-slate-500">فیلترها در همین مرورگر حفظ می‌شوند؛ «کارهای من» از فیلتر امن author=me استفاده می‌کند.</p><button type="button" onClick={resetFilters} className="panel-secondary-button"><PanelIcon name="filter" className="size-4" />پاک‌کردن فیلترها</button></div>
          {selectedIds.length ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#173652]"><span>{selectedIds.length.toLocaleString("fa-IR")} مورد انتخاب شده</span><button disabled={bulkPending} type="button" onClick={() => void moveSelected("archive")} className="panel-secondary-button">آرشیو گروهی</button></div> : null}
          {items.length ? (
            <>
              {/* Below md: a stacked card per row -- 8 columns of horizontal
                  scroll with no visible affordance was the exact pattern
                  flagged for a deliberate mobile layout instead. */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {items.map((entry) => (
                  <article
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    // FE-PANEL-MEDIA-REVIEW-MOBILE-CARD-KEYBOARD-001: this
                    // card had only onClick -- no tabIndex/role/keyboard
                    // handler at all, unlike the desktop <tr> below which
                    // already has the full treatment. Matches that same
                    // established pattern (role="button" instead of the
                    // desktop row's implicit row semantics, since this is a
                    // card, not a table row).
                    role="button"
                    tabIndex={0}
                    aria-pressed={String(effectiveSelectedId) === String(entry.id)}
                    aria-label={"مشاهده " + entry.title}
                    onKeyDown={(event) => handleSelectableRowKeyDown(event, () => setSelectedId(entry.id))}
                    className={`rounded-lg border p-4 ${String(effectiveSelectedId) === String(entry.id) ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.some((id) => String(id) === String(entry.id))}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelected(entry.id)}
                        aria-label={"انتخاب " + entry.title}
                        className="mt-1 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black leading-6 text-[#172b43]">{entry.title}</h3>
                          <ContentStatus status={entry.status} />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-bold text-slate-500">
                          <div><dt className="inline">نوع: </dt><dd className="inline">{entry.kind === "news" ? "خبر" : "اطلاعیه"}</dd></div>
                          <div><dt className="inline">دسته‌بندی: </dt><dd className="inline">{entry.category?.title ?? "—"}</dd></div>
                          <div><dt className="inline">واحد: </dt><dd className="inline">{entry.scope === "school" ? "کل مدرسه" : entry.unit?.title ?? "—"}</dd></div>
                          <div><dt className="inline">نویسنده: </dt><dd className="inline">{entry.author?.full_name ?? "—"}</dd></div>
                          <div className="col-span-2"><dt className="inline">تاریخ انتشار: </dt><dd className="inline">{formatDate(entry.published_at ?? entry.scheduled_at ?? entry.created_at)}</dd></div>
                        </dl>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setEditor({ mode: "advanced", item: entry }); }}
                        className="panel-icon-button !size-8 shrink-0"
                        aria-label={"ویرایش " + entry.title}
                      >
                        <PanelIcon name="edit" className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block"><table className="panel-table min-w-[62rem]"><thead><tr><th><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="انتخاب همه موارد صفحه" /></th><th>عنوان</th><th>نوع</th><th>دسته‌بندی</th><th>واحد آموزشی</th><th>وضعیت</th><th>نویسنده</th><th>تاریخ انتشار</th><th>عملیات</th></tr></thead><tbody>{items.map((entry) => <tr key={entry.id} onClick={() => setSelectedId(entry.id)} onKeyDown={(event) => handleSelectableRowKeyDown(event, () => setSelectedId(entry.id))} tabIndex={0} aria-selected={String(effectiveSelectedId) === String(entry.id)} className={String(effectiveSelectedId) === String(entry.id) ? "is-selected" : ""}><td><input type="checkbox" checked={selectedIds.some((id) => String(id) === String(entry.id))} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelected(entry.id)} aria-label={"انتخاب " + entry.title} /></td><td className="max-w-64 whitespace-normal font-black leading-6 text-[#172b43]">{entry.title}</td><td>{entry.kind === "news" ? "خبر" : "اطلاعیه"}</td><td>{entry.category?.title ?? "—"}</td><td>{entry.scope === "school" ? "کل مدرسه" : entry.unit?.title ?? "—"}</td><td><ContentStatus status={entry.status} /></td><td>{entry.author?.full_name ?? "—"}</td><td>{formatDate(entry.published_at ?? entry.scheduled_at ?? entry.created_at)}</td><td><button type="button" onClick={(event) => { event.stopPropagation(); setEditor({ mode: "advanced", item: entry }); }} className="panel-icon-button !size-8" aria-label={"ویرایش " + entry.title}><PanelIcon name="edit" className="size-4" /></button></td></tr>)}</tbody></table></div>

              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>صفحه {page.toLocaleString("fa-IR")} — مجموع {(request.data?.count ?? 0).toLocaleString("fa-IR")} مورد</span><div className="flex gap-2"><button disabled={!request.data?.previous} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button" className="panel-secondary-button">صفحه قبل</button><button disabled={!request.data?.next} onClick={() => setPage((value) => value + 1)} type="button" className="panel-secondary-button">صفحه بعد</button></div></footer>
            </>
          ) : <PanelEmpty title="محتوایی با این فیلترها پیدا نشد." />}
        </section>
      </section>
    </div>
  );
}
