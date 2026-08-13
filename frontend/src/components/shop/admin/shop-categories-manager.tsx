"use client";

import { type FormEvent, useState } from "react";
import { ConfirmDialog, CrudSection, EmptyState, Field, GhostButton, Modal, PrimaryButton, TextArea, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { cmsCreateCategory, cmsDeleteCategory, cmsGetCategories, cmsUpdateCategory } from "@/services/shop-cms-service";
import type { CMSShopCategory } from "@/types/shop";

export function ShopCategoriesManager() {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetCategories(), []);
  const [editing, setEditing] = useState<CMSShopCategory | null | "new">(null);
  const [deleting, setDeleting] = useState<CMSShopCategory | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = data?.results ?? [];

  async function handleDelete() {
    if (!deleting) return;
    try {
      await cmsDeleteCategory(deleting.id);
      setDeleting(null);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    }
  }

  return (
    <CrudSection
      title="دسته‌بندی‌های فروشگاه"
      description="دسته‌بندی محصولات و دوره‌ها"
      action={
        <PrimaryButton type="button" onClick={() => setEditing("new")}>
          <PanelIcon name="plus" className="ml-1.5 inline size-4" />
          دسته‌بندی جدید
        </PrimaryButton>
      }
    >
      {actionError ? (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : categories.length === 0 ? (
        <EmptyState text="دسته‌بندی‌ای ثبت نشده است." />
      ) : (
        <div className="overflow-x-auto">
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>اسلاگ</th>
                <th>وضعیت</th>
                <th>ترتیب</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="font-black">{category.title}</td>
                  <td dir="ltr" className="text-left text-xs text-slate-500">{category.slug}</td>
                  <td>
                    <span className={`rounded-xl px-3 py-1 text-xs font-black ${category.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                      {category.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td>{category.order}</td>
                  <td className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(category)} className="panel-icon-button" aria-label={`ویرایش ${category.title}`}>
                      <PanelIcon name="edit" className="size-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(category)} className="panel-icon-button hover:bg-rose-50 hover:text-rose-600" aria-label={`حذف ${category.title}`}>
                      <PanelIcon name="trash" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "دسته‌بندی جدید" : "ویرایش دسته‌بندی"}>
        {editing !== null ? (
          <CategoryForm
            initial={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="حذف دسته‌بندی"
        description={`آیا از حذف «${deleting?.title}» مطمئن هستید؟`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </CrudSection>
  );
}

function CategoryForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: CMSShopCategory | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (initial) {
        await cmsUpdateCategory(initial.id, { title, description: description || null, order: Number(order) });
      } else {
        await cmsCreateCategory({ title, description: description || null, order: Number(order) });
      }
      onSaved();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <Field label="عنوان" required>
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
      </Field>
      <Field label="توضیحات">
        <TextArea value={description ?? ""} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </Field>
      <Field label="ترتیب نمایش">
        <TextInput type="number" value={order} onChange={(event) => setOrder(Number(event.target.value))} />
      </Field>
      {error ? <p role="alert" className="text-sm font-black text-rose-600">{error}</p> : null}
      <div className="flex gap-3">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "در حال ذخیره…" : "ذخیره"}
        </PrimaryButton>
        <GhostButton type="button" onClick={onCancel}>انصراف</GhostButton>
      </div>
    </form>
  );
}
