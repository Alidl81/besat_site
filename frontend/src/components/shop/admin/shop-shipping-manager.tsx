"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { ConfirmDialog, CrudSection, EmptyState, Field, GhostButton, Modal, PrimaryButton, TextInput } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { PanelError } from "@/components/dashboard/panel-request-state";
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
  // FE-SHOP-SHIPPING-DELETE-DOUBLE-SUBMIT-001: no in-flight guard at all, so
  // two same-tick delete confirmations both reached cmsDeleteShippingMethod.
  const deletingRef = useRef(false);

  const methods = Array.isArray(data) ? data : (data?.results ?? []);

  async function handleDelete() {
    if (!deleting || deletingRef.current) return;
    deletingRef.current = true;
    try {
      await cmsDeleteShippingMethod(deleting.id);
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
        // FE-PANEL-SHOP-CRUD-ERROR-RETRY-001: see shop-categories-manager.tsx
        // -- identical no-retry defect, same shared PanelError fix.
        <PanelError message={error} onRetry={reload} />
      ) : methods.length === 0 ? (
        <EmptyState text="روش ارسالی ثبت نشده است." />
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
                <th>هزینه</th>
                <th>پیش‌فرض</th>
                {/* FE-DASH-RTL-SHOP-CATEGORY-ACTION-001: same sticky-column
                    fix as shop-products-manager.tsx/shop-categories-
                    manager.tsx -- the panel-table-scroll edge-cue fade alone
                    still left the edit/delete buttons entirely outside the
                    visible RTL wrapper at 390px. */}
                <th className="panel-table-action-sticky"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.id}>
                  <td className="font-black">{method.title}</td>
                  <td>{formatPrice(method.price_amount)}</td>
                  <td>{method.is_default ? "بله" : "—"}</td>
                  <td className="panel-table-action-sticky">
                    {/* FE-DASH-RTL-SHOP-CATEGORY-ACTION-001: `flex` was
                        applied directly to this <td> (identical bug found in
                        shop-categories-manager.tsx), computing display:flex
                        instead of the table-cell layout every other cell in
                        this row relies on -- moved to an inner div. */}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(method)} className="panel-icon-button" aria-label={`ویرایش ${method.title}`}>
                        <PanelIcon name="edit" className="size-4" />
                      </button>
                      <button type="button" onClick={() => setDeleting(method)} className="panel-icon-button hover:bg-rose-50 hover:text-rose-600" aria-label={`حذف ${method.title}`}>
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
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; price?: string }>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const titleErrorId = useId();
  const priceErrorId = useId();
  // FE-SHOP-SHIPPING-CREATE-DOUBLE-SUBMIT-001: `submitting` is state-backed,
  // so two same-tick submits both read it as `false` before either update
  // commits -- a synchronous ref guard closes that race.
  const submittingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const nextFieldErrors: typeof fieldErrors = {};
    if (!title.trim()) nextFieldErrors.title = "عنوان الزامی است.";
    if (!priceDisplay.trim()) nextFieldErrors.price = "هزینه الزامی است.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError("لطفاً خطاهای مشخص‌شده را اصلاح کنید.");
      (nextFieldErrors.title ? titleRef : priceRef).current?.focus();
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = { title, price_amount: Number(priceDisplay) * 10, is_default: isDefault };
      if (initial) await cmsUpdateShippingMethod(initial.id, payload);
      else await cmsCreateShippingMethod(payload);
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
            setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          required
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? titleErrorId : undefined}
        />
        {fieldErrors.title ? (
          <p id={titleErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
            {fieldErrors.title}
          </p>
        ) : null}
      </Field>
      <Field label="هزینه (تومان)" required>
        <TextInput
          ref={priceRef}
          type="number"
          value={priceDisplay}
          onChange={(event) => {
            setPriceDisplay(event.target.value);
            setFieldErrors((prev) => ({ ...prev, price: undefined }));
          }}
          required
          aria-invalid={Boolean(fieldErrors.price)}
          aria-describedby={fieldErrors.price ? priceErrorId : undefined}
        />
        {fieldErrors.price ? (
          <p id={priceErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
            {fieldErrors.price}
          </p>
        ) : null}
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
