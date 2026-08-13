"use client";

import { type FormEvent, useState } from "react";
import { ConfirmDialog, CrudSection, EmptyState, Field, GhostButton, Modal, PrimaryButton, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatPrice, toDisplayAmount } from "@/lib/shop/money";
import { cmsCreateShippingMethod, cmsDeleteShippingMethod, cmsGetShippingMethods, cmsUpdateShippingMethod } from "@/services/shop-cms-service";
import type { ShippingMethod } from "@/types/shop";

export function ShopShippingManager() {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetShippingMethods(), []);
  const [editing, setEditing] = useState<ShippingMethod | "new" | null>(null);
  const [deleting, setDeleting] = useState<ShippingMethod | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const methods = Array.isArray(data) ? data : (data?.results ?? []);

  async function handleDelete() {
    if (!deleting) return;
    try {
      await cmsDeleteShippingMethod(deleting.id);
      setDeleting(null);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    }
  }

  return (
    <CrudSection
      title="روش‌های ارسال"
      description="روش‌های ارسال کالای فیزیکی و هزینه هر روش (موقت، تا تعیین قوانین نهایی ارسال)"
      action={
        <PrimaryButton type="button" onClick={() => setEditing("new")}>
          <PanelIcon name="plus" className="ml-1.5 inline size-4" />
          روش جدید
        </PrimaryButton>
      }
    >
      {actionError ? (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{actionError}</p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : methods.length === 0 ? (
        <EmptyState text="روش ارسالی ثبت نشده است." />
      ) : (
        <div className="overflow-x-auto">
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>هزینه</th>
                <th>پیش‌فرض</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.id}>
                  <td className="font-black">{method.title}</td>
                  <td>{formatPrice(method.price_amount)}</td>
                  <td>{method.is_default ? "بله" : "—"}</td>
                  <td className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(method)} className="panel-icon-button" aria-label={`ویرایش ${method.title}`}>
                      <PanelIcon name="edit" className="size-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(method)} className="panel-icon-button hover:bg-rose-50 hover:text-rose-600" aria-label={`حذف ${method.title}`}>
                      <PanelIcon name="trash" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "روش ارسال جدید" : "ویرایش روش ارسال"}>
        {editing !== null ? (
          <ShippingMethodForm
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
        title="حذف روش ارسال"
        description={`آیا از حذف «${deleting?.title}» مطمئن هستید؟`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </CrudSection>
  );
}

function ShippingMethodForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ShippingMethod | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [priceDisplay, setPriceDisplay] = useState(initial ? String(toDisplayAmount(initial.price_amount)) : "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = { title, price_amount: Number(priceDisplay) * 10, is_default: isDefault };
      if (initial) await cmsUpdateShippingMethod(initial.id, payload);
      else await cmsCreateShippingMethod(payload);
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
      <Field label="هزینه (تومان)" required>
        <TextInput type="number" value={priceDisplay} onChange={(event) => setPriceDisplay(event.target.value)} required />
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="text-sm font-black text-[#062452]">روش پیش‌فرض</span>
        <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
      </label>
      {error ? <p role="alert" className="text-sm font-black text-rose-600">{error}</p> : null}
      <div className="flex gap-3">
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "در حال ذخیره…" : "ذخیره"}</PrimaryButton>
        <GhostButton type="button" onClick={onCancel}>انصراف</GhostButton>
      </div>
    </form>
  );
}
