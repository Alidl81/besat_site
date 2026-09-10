"use client";

import { useRef, useState, type ReactNode } from "react";
import { useCollection } from "@/components/crud/use-collection";
import {
  ConfirmDialog,
  CrudSection,
  EmptyState,
  GhostButton,
  Modal,
  PrimaryButton,
} from "@/components/crud/crud-ui";
import type { Repository } from "@/lib/data/repository";
import type { WithoutSystemFields } from "@/lib/data/domain-types";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { PanelError } from "@/components/dashboard/panel-request-state";

type BaseRecord = { id: string; created_at: string; updated_at: string };

export type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
};

export type CrudManagerProps<T extends BaseRecord> = {
  title: string;
  description?: string;
  repository: Repository<T>;
  filter?: (item: T) => boolean;
  columns: Column<T>[];
  emptyText: string;
  addLabel: string;
  /** فرم ساخت/ویرایش — مقدار اولیه و callback ذخیره می‌گیرد */
  renderForm: (args: {
    initial: T | null;
    onSubmit: (data: WithoutSystemFields<T>) => Promise<void>;
    onCancel: () => void;
    submitting: boolean;
  }) => ReactNode;
  /** اگر false شود، دکمه افزودن نمایش داده نمی‌شود (مثلاً برای پیام‌ها) */
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** اکشن‌های اضافی روی هر ردیف */
  rowActions?: (
    item: T,
    helpers: {
      update: (id: string, data: Partial<WithoutSystemFields<T>>) => Promise<void>;
      reload: () => Promise<void>;
    },
  ) => ReactNode;
  /**
   * FE-A11Y-ADMIN-USERS-ACTION-NAMES-001: every consumer's rows repeat the
   * identical "ویرایش"/"حذف" visible text, so a screen reader user tabbing
   * through 8 identical rows hears "ویرایش" 8 times with no way to tell
   * which record each one targets. Optional so existing callers that don't
   * pass it keep the prior (unlabelled) button text unchanged.
   */
  rowLabel?: (item: T) => string;
};

export function CrudManager<T extends BaseRecord>({
  title,
  description,
  repository,
  filter,
  columns,
  emptyText,
  addLabel,
  renderForm,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  rowActions,
  rowLabel,
}: CrudManagerProps<T>) {
  const { items, loading, error, create, update, remove, reload } = useCollection<T>(
    repository,
    filter,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  // FE-CMS-GENERIC-DUPLICATE-MUTATION-001: same guard/rationale as
  // login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001 -- state-backed
  // `submitting` (and the ConfirmDialog's lack of any disabled state at
  // all) only take effect after React re-renders, so two same-tick form
  // submits or confirm clicks both reach the actual repository call. This
  // component is the shared generic CRUD screen for users/units/
  // registrations/gallery/departments and more, so this guard covers all
  // of them at once.
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSubmit(data: WithoutSystemFields<T>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (editing) {
        await update(editing.id, data);
      } else {
        await create(data);
      }
      setModalOpen(false);
      setEditing(null);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      deletingRef.current = false;
    }
  }

  function rowActionButtons(item: T) {
    const label = rowLabel?.(item);
    return (
      <>
        {rowActions ? rowActions(item, { update, reload }) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => openEdit(item)}
            aria-label={label ? `ویرایش ${label}` : undefined}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-[#062452] transition hover:bg-blue-50 hover:text-blue-700"
          >
            ویرایش
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={() => setDeleteTarget(item)}
            aria-label={label ? `حذف ${label}` : undefined}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-50"
          >
            حذف
          </button>
        ) : null}
      </>
    );
  }

  return (
    <CrudSection
      title={title}
      description={description}
      action={
        canCreate ? (
          <PrimaryButton type="button" onClick={openCreate}>
            <PanelIcon name="plus" className="size-4" />
            <span>{addLabel}</span>
          </PrimaryButton>
        ) : null
      }
    >
      {error ? (
        // FE-PANEL-CRUD-ERROR-RETRY-A11Y-001: this was a plain, non-live
        // div with no retry action, even though useCollection already
        // returns `reload` -- registration-workspace.tsx's own PanelError
        // usage (a separate, custom-built component, not this shared one)
        // was the working reference implementation for this exact fix.
        <PanelError message={error} onRetry={reload} />
      ) : null}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <>
          {/* Below md: a stacked card per row instead of a horizontally
              scrolling table with no visible affordance that it scrolls.
              grid-cols-1 is required, not decorative: an unspecified
              grid-template-columns leaves the browser to size the single
              implicit column to its content's max-content width, which can
              exceed the container and overflow -- min-w-0 on the item alone
              doesn't fix this, the TRACK itself needs an explicit
              minmax(0,1fr) (Tailwind's grid-cols-1). See
              FE-ADMIN-USERS-MOBILE-OVERFLOW-001's second REOPEN. */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <dl className="space-y-2">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 font-bold text-slate-500">{col.header}</dt>
                      <dd className="min-w-0 break-words text-left font-black text-[#062452]">{col.render(item)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  {rowActionButtons(item)}
                </div>
              </article>
            ))}
          </div>

          {/* panel-table-scroll -- same fix as FE-DASH-RTL-TABLE-ROOT-OVERFLOW-001
              and FE-DASH-RTL-TABLE-MOBILE-AFFORDANCE-001 (shop-orders-
              manager.tsx and siblings): an RTL overflow-x-auto table
              wrapper's own content can inflate documentElement.scrollWidth
              even though the wrapper itself scrolls correctly, and an
              overflowing table gives no visual cue that scrolling reveals
              more columns. Applied here proactively for every
              CrudManager-based table (this one is md:hidden below md, so
              it wasn't the cause of the mobile-width findings, but is
              exposed to the identical risk at wider widths for any
              sufficiently wide table). */}
          <div className="panel-table-scroll hidden rounded-lg border border-slate-200 md:block">
            <table className="panel-table min-w-[40rem]">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                    >
                      {col.header}
                    </th>
                  ))}
                  {/* FE-PANEL-ADMIN-USERS-TABLE-ACTION-768-001: at 768px this
                      wide, columns-heavy table pushes the operations column
                      entirely offscreen with no visual/keyboard cue that
                      scrolling reveals it. panel-table-action-sticky (same
                      fix already applied per-table in the shop admin
                      managers) pins this shared CrudManager table's actions
                      column to the wrapper's visible edge at every width,
                      fixing every consumer (Users, Departments, Gallery,
                      Registrations, Units) at once. */}
                  <th className="panel-table-action-sticky">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition"
                  >
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.render(item)}
                      </td>
                    ))}
                    <td className="panel-table-action-sticky">
                      <div className="flex items-center justify-end gap-2">
                        {rowActionButtons(item)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? `ویرایش — ${title}` : addLabel}
        size="xl"
      >
        {/* eslint-disable-next-line react-hooks/refs -- false positive: this
            call just builds a ReactNode (a <form onSubmit={...}>), it does
            not itself invoke `handleSubmit`. The rule can't see through
            `renderForm`'s caller-supplied implementation to confirm
            `onSubmit` is only ever called from that form's own submit
            event (a genuine event-handler context), so it conservatively
            flags this render-prop call itself as if it read `submittingRef.
            current` synchronously during render -- it doesn't; that read
            only happens inside handleSubmit's body, when the form later
            actually submits. */}
        {renderForm({
          initial: editing,
          onSubmit: handleSubmit,
          onCancel: () => {
            setModalOpen(false);
            setEditing(null);
          },
          submitting,
        })}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف رکورد"
        description="آیا از حذف این مورد مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </CrudSection>
  );
}

// helper برای دکمه‌های فرم
export function FormActions({
  onCancel,
  submitting,
  disabled = false,
  submitLabel = "ذخیره",
}: {
  onCancel: () => void;
  submitting: boolean;
  // Extra reasons to disable the button beyond an actual save being in
  // flight (e.g. a required field not filled in yet) -- kept separate
  // from `submitting` so the label only ever claims "در حال ذخیره..."
  // while a save is genuinely happening, not while a prerequisite is
  // simply unmet.
  disabled?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <GhostButton type="button" onClick={onCancel}>
        انصراف
      </GhostButton>
      <PrimaryButton type="submit" disabled={submitting || disabled}>
        {submitting ? "در حال ذخیره..." : submitLabel}
      </PrimaryButton>
    </div>
  );
}
