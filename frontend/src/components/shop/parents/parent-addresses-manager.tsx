"use client";

import { useState } from "react";
import { CrudSection, EmptyState, Modal, PrimaryButton } from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { AddressForm, type AddressFormValues } from "@/components/shop/address-form";
import { createAddress, deleteAddress, getMyAddresses, updateAddress } from "@/services/shop-account-service";

export function ParentAddressesManager() {
  const { data: addresses, loading, error, reload } = usePanelRequest(() => getMyAddresses(), []);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const list = addresses ?? [];
  const editingAddress = typeof editingId === "number" ? list.find((address) => address.id === editingId) : null;

  async function handleCreate(values: AddressFormValues) {
    await createAddress(values);
    setEditingId(null);
    reload();
  }

  async function handleUpdate(values: AddressFormValues) {
    if (typeof editingId !== "number") return;
    await updateAddress(editingId, values);
    setEditingId(null);
    reload();
  }

  async function handleDelete(id: number) {
    if (!window.confirm("آیا از حذف این آدرس مطمئن هستید؟")) return;
    setBusyId(id);
    setDeleteError(null);
    try {
      await deleteAddress(id);
      reload();
    } catch (reason) {
      setDeleteError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CrudSection
      title="آدرس‌های من"
      description="آدرس‌های ذخیره‌شده برای ارسال کالاهای فیزیکی"
      action={
        <PrimaryButton type="button" onClick={() => setEditingId("new")}>
          <PanelIcon name="plus" className="ml-1.5 inline size-4" />
          آدرس جدید
        </PrimaryButton>
      }
    >
      {deleteError ? (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
          {deleteError}
        </p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : list.length === 0 ? (
        <EmptyState text="هنوز آدرسی ثبت نکرده‌اید." />
      ) : (
        <ul className="grid gap-3">
          {list.map((address) => (
            <li key={address.id} className="panel-card flex flex-wrap items-start justify-between gap-4 p-4">
              <div>
                <p className="font-black text-[#062452]">
                  {address.recipient_full_name}
                  {address.is_default ? (
                    <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">
                      پیش‌فرض
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  {address.province}، {address.city}، {address.address_line1}
                </p>
                <p dir="ltr" className="mt-1 text-left text-xs font-bold text-slate-400">{address.phone}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(address.id)}
                  className="panel-icon-button"
                  aria-label={`ویرایش آدرس ${address.recipient_full_name}`}
                >
                  <PanelIcon name="edit" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(address.id)}
                  disabled={busyId === address.id}
                  className="panel-icon-button hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`حذف آدرس ${address.recipient_full_name}`}
                >
                  <PanelIcon name="trash" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === "new" ? "آدرس جدید" : "ویرایش آدرس"}
      >
        <AddressForm
          key={editingId ?? "new"}
          initialValues={editingAddress ?? undefined}
          onSubmit={editingId === "new" ? handleCreate : handleUpdate}
          onCancel={() => setEditingId(null)}
        />
      </Modal>
    </CrudSection>
  );
}
