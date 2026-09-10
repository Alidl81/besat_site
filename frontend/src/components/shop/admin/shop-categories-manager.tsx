"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { ConfirmDialog, CrudSection, EmptyState, Field, GhostButton, Modal, PrimaryButton, TextArea, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { PanelError } from "@/components/dashboard/panel-request-state";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { cmsCreateCategory, cmsDeleteCategory, cmsGetCategories, cmsUpdateCategory } from "@/services/shop-cms-service";
import type { CMSShopCategory } from "@/types/shop";

export function ShopCategoriesManager() {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetCategories(), []);
  const [editing, setEditing] = useState<CMSShopCategory | null | "new">(null);
  const [deleting, setDeleting] = useState<CMSShopCategory | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // FE-SHOP-CATEGORY-DELETE-DOUBLE-SUBMIT-001: no in-flight guard at all, so
  // two same-tick delete confirmations both reached cmsDeleteCategory.
  const deletingRef = useRef(false);

  const categories = data?.results ?? [];

  async function handleDelete() {
    if (!deleting || deletingRef.current) return;
    deletingRef.current = true;
    try {
      await cmsDeleteCategory(deleting.id);
      setDeleting(null);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      deletingRef.current = false;
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
        // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: this was plain text with no
        // retry action, even though usePanelRequest already returns
        // `reload` -- the shared PanelError component (already used by
        // ManagementReportsWorkspace/SettingsWorkspace) supplies both the
        // localized alert and a keyboard-accessible "تلاش دوباره" button.
        <PanelError message={error} onRetry={reload} />
      ) : categories.length === 0 ? (
        <EmptyState text="دسته‌بندی‌ای ثبت نشده است." />
      ) : (
        <div className="panel-table-scroll">
          {/* panel-table-scroll (globals.css) -- see
              FE-DASH-RTL-TABLE-ROOT-OVERFLOW-001 and
              FE-DASH-RTL-TABLE-MOBILE-AFFORDANCE-001 in
              shop-orders-manager.tsx: isolates this wrapper's overflowing
              RTL table content from contributing to root-level
              documentElement.scrollWidth, and fades in an edge cue when
              columns start outside the visible area. */}
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>اسلاگ</th>
                <th>وضعیت</th>
                <th>ترتیب</th>
                {/* FE-DASH-RTL-SHOP-CATEGORY-ACTION-001: same sticky-column
                    fix as shop-products-manager.tsx -- the panel-table-scroll
                    edge-cue fade alone still left the edit/delete buttons
                    entirely outside the visible RTL wrapper at 390px. */}
                <th className="panel-table-action-sticky"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="font-black">{category.title}</td>
                  <td dir="ltr" className="text-left text-xs text-slate-500">{category.slug}</td>
                  <td>
                    <span className={`rounded-xl px-3 py-1 text-xs font-black ${category.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {category.is_active ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td>{category.order}</td>
                  <td className="panel-table-action-sticky">
                    {/* FE-DASH-RTL-SHOP-CATEGORY-ACTION-001: `flex` was
                        applied directly to this <td>, so it computed
                        display:flex instead of the table-cell layout every
                        other cell in this row relies on -- the flex layout
                        now lives on an inner div instead, matching the
                        pattern already used by every other actions cell in
                        this codebase (e.g. shop-products-manager.tsx). */}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(category)} className="panel-icon-button" aria-label={`ویرایش ${category.title}`}>
                        <PanelIcon name="edit" className="size-4" />
                      </button>
                      <button type="button" onClick={() => setDeleting(category)} className="panel-icon-button hover:bg-rose-50 hover:text-rose-600" aria-label={`حذف ${category.title}`}>
                        <PanelIcon name="trash" className="size-4" />
                      </button>
                    </div>
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
  const [titleError, setTitleError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const titleErrorId = useId();
  // FE-SHOP-CATEGORY-CREATE-DOUBLE-SUBMIT-001: `submitting` is state-backed,
  // so two same-tick submits both read it as `false` before either update
  // commits -- a synchronous ref guard closes that race.
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setTitleError("");

    if (!title.trim()) {
      setTitleError("عنوان الزامی است.");
      setError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      titleRef.current?.focus();
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
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
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field label="عنوان" required>
        <TextInput
          ref={titleRef}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError("");
          }}
          required
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? titleErrorId : undefined}
        />
        {titleError ? (
          <p id={titleErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
            {titleError}
          </p>
        ) : null}
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
