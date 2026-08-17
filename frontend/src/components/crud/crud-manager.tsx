"use client";

import { useState, type ReactNode } from "react";
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
}: CrudManagerProps<T>) {
  const { items, loading, error, create, update, remove, reload } = useCollection<T>(
    repository,
    filter,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSubmit(data: WithoutSystemFields<T>) {
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
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  function rowActionButtons(item: T) {
    return (
      <>
        {rowActions ? rowActions(item, { update, reload }) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => openEdit(item)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-[#062452] transition hover:bg-blue-50 hover:text-blue-700"
          >
            ویرایش
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={() => setDeleteTarget(item)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-rose-600 transition hover:bg-rose-50"
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
        <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-right text-sm font-black text-rose-700">
          {error}
        </div>
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
              scrolling table with no visible affordance that it scrolls. */}
          <div className="grid gap-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <dl className="space-y-2">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 font-bold text-slate-500">{col.header}</dt>
                      <dd className="min-w-0 text-left font-black text-[#062452]">{col.render(item)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  {rowActionButtons(item)}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
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
                  <th>عملیات</th>
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
                    <td>
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
  submitLabel = "ذخیره",
}: {
  onCancel: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <GhostButton type="button" onClick={onCancel}>
        انصراف
      </GhostButton>
      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "در حال ذخیره..." : submitLabel}
      </PrimaryButton>
    </div>
  );
}
