"use client";

import { type FormEvent, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { CrudSection, EmptyState, Field, GhostButton, Modal, PrimaryButton, Select, StatusBadge, TextArea, TextInput } from "@/components/crud/crud-ui";
import { MediaPickerDialog } from "@/components/cms/media-picker-dialog";
import { emptySeoDraft, seoDraftFrom, seoDraftToPayload, SeoPanel, type SeoDraft } from "@/components/cms/seo-panel";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { RichEditor, type EditorDocumentStats, type EditorOutlineItem } from "@/components/editor/rich-editor";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { formatPrice, toDisplayAmount } from "@/lib/shop/money";
import { panelService } from "@/services/panel-service";
import {
  cmsCreateProduct,
  cmsDeleteProduct,
  cmsGetCategories,
  cmsGetProduct,
  cmsGetProducts,
  cmsRunProductWorkflowAction,
  cmsUpdateProduct,
  cmsUploadProductGalleryImage,
  type ProductWorkflowAction,
} from "@/services/shop-cms-service";
import type { CMSProductDetail, CMSProductListItem, ProductImage, ProductType } from "@/types/shop";

const TYPE_LABELS: Record<ProductType, string> = {
  physical: "کالای فیزیکی",
  online_course: "دوره آنلاین",
  in_person_course: "دوره حضوری",
};

const WORKFLOW_ACTIONS: { action: ProductWorkflowAction; label: string; from: string[] }[] = [
  { action: "submit-review", label: "ارسال برای بررسی", from: ["draft", "rejected"] },
  { action: "approve", label: "تأیید", from: ["waiting_review"] },
  { action: "reject", label: "رد", from: ["waiting_review", "approved"] },
  { action: "publish", label: "انتشار", from: ["approved"] },
  { action: "archive", label: "آرشیو", from: ["draft", "waiting_review", "approved", "published", "rejected"] },
  { action: "restore", label: "بازگردانی به پیش‌نویس", from: ["archived"] },
];

export function ShopProductsManager({ mode }: { mode: "admin" | "media" }) {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetProducts(), []);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const products = data?.results ?? [];

  async function handleWorkflowAction(product: CMSProductListItem, action: ProductWorkflowAction) {
    setBusyId(product.id);
    setActionError(null);
    try {
      await cmsRunProductWorkflowAction(product.id, action);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(product: CMSProductListItem) {
    if (!window.confirm(`آیا از حذف «${product.title}» مطمئن هستید؟`)) return;
    setBusyId(product.id);
    setActionError(null);
    try {
      await cmsDeleteProduct(product.id);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CrudSection
      title={mode === "admin" ? "محصولات فروشگاه" : "محتوای محصولات فروشگاه"}
      description={
        mode === "admin"
          ? "مدیریت کامل محصولات، قیمت، موجودی و انتشار"
          : "ویرایش عنوان، توضیحات، تصاویر و سئوی محصولات (بدون دسترسی به قیمت و موجودی)"
      }
      action={
        <PrimaryButton type="button" onClick={() => setEditingId("new")}>
          <PanelIcon name="plus" className="ml-1.5 inline size-4" />
          محصول جدید
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
      ) : products.length === 0 ? (
        <EmptyState text="محصولی ثبت نشده است." />
      ) : (
        <div className="overflow-x-auto">
          <table className="panel-table w-full">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>نوع</th>
                {mode === "admin" ? <th>قیمت</th> : null}
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const availableActions = WORKFLOW_ACTIONS.filter(
                  (item) => item.from.includes(product.status) && (mode === "admin" || item.action === "submit-review"),
                );
                return (
                  <tr key={product.id}>
                    <td className="font-black">{product.title}</td>
                    <td>{TYPE_LABELS[product.product_type]}</td>
                    {mode === "admin" ? (
                      <td>
                        {product.sale_price_amount ? (
                          <span>
                            <span className="ml-1 text-xs text-slate-400 line-through">{formatPrice(product.price_amount)}</span>
                            {formatPrice(product.sale_price_amount)}
                          </span>
                        ) : (
                          formatPrice(product.price_amount)
                        )}
                      </td>
                    ) : null}
                    <td><StatusBadge status={product.status} /></td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {availableActions.map((item) => (
                          <button
                            key={item.action}
                            type="button"
                            disabled={busyId === product.id}
                            onClick={() => handleWorkflowAction(product, item.action)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {item.label}
                          </button>
                        ))}
                        <button type="button" onClick={() => setEditingId(product.id)} className="panel-icon-button" aria-label={`ویرایش ${product.title}`}>
                          <PanelIcon name="edit" className="size-4" />
                        </button>
                        {mode === "admin" ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            disabled={busyId === product.id}
                            className="panel-icon-button hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`حذف ${product.title}`}
                          >
                            <PanelIcon name="trash" className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === "new" ? "محصول جدید" : "ویرایش محصول"}
        size="xl"
      >
        {editingId !== null ? (
          <ProductForm
            mode={mode}
            productId={editingId === "new" ? null : editingId}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              reload();
            }}
          />
        ) : null}
      </Modal>
    </CrudSection>
  );
}

function ProductForm({
  mode,
  productId,
  onCancel,
  onSaved,
}: {
  mode: "admin" | "media";
  productId: number | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { data: existing, loading: loadingExisting } = usePanelRequest<CMSProductDetail | null>(
    () => (productId ? cmsGetProduct(productId) : Promise.resolve(null)),
    [productId],
  );
  const { data: categoriesData } = usePanelRequest(() => cmsGetCategories(), []);

  const [productType, setProductType] = useState<ProductType>("physical");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [priceDisplay, setPriceDisplay] = useState<string>("");
  const [salePriceDisplay, setSalePriceDisplay] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [sku, setSku] = useState("");
  const [inventoryQty, setInventoryQty] = useState<number>(0);
  const [maxPurchaseQty, setMaxPurchaseQty] = useState<string>("");
  const [instructorName, setInstructorName] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [accessDestination, setAccessDestination] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [locationDetail, setLocationDetail] = useState("");

  const [descriptionJson, setDescriptionJson] = useState<JSONContent | null>(null);
  const [outline, setOutline] = useState<EditorOutlineItem[]>([]);
  const [stats, setStats] = useState<EditorDocumentStats>({ blocks: 0, characters: 0, words: 0, readingMinutes: 0 });
  const [seoDraft, setSeoDraft] = useState<SeoDraft>(emptySeoDraft);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [featuredImagePickerOpen, setFeaturedImagePickerOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>([]);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(!productId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing && !hydrated) {
    setProductType(existing.product_type);
    setTitle(existing.title);
    setCategoryId(existing.category ? String(existing.category) : "");
    setShortDescription(existing.short_description ?? "");
    setDescription(existing.description ?? "");
    setPriceDisplay(existing.price_amount !== null ? String(toDisplayAmount(existing.price_amount)) : "");
    setSalePriceDisplay(existing.sale_price_amount !== null ? String(toDisplayAmount(existing.sale_price_amount)) : "");
    setIsFeatured(existing.is_featured);
    if (existing.physical_detail) {
      setSku(existing.physical_detail.sku);
      setInventoryQty(existing.physical_detail.inventory_qty);
      setMaxPurchaseQty(existing.physical_detail.max_purchase_quantity ? String(existing.physical_detail.max_purchase_quantity) : "");
    }
    if (existing.course_detail) {
      setInstructorName(existing.course_detail.instructor_name ?? "");
      setCapacity(existing.course_detail.capacity ? String(existing.course_detail.capacity) : "");
      setStartDate(existing.course_detail.start_date ?? "");
      setAccessDestination(existing.course_detail.access_destination_value ?? "");
      setScheduleText(existing.course_detail.schedule_text ?? "");
      setLocationDetail(existing.course_detail.location_detail ?? "");
    }
    setSeoDraft(seoDraftFrom(existing.seo));
    setFeaturedImageUrl(existing.featured_image ?? "");
    setGalleryImages(existing.gallery_images ?? []);
    setHydrated(true);
  }

  const categories = categoriesData?.results ?? [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const basePayload = {
        ...(productId ? {} : { product_type: productType }),
        title,
        category: categoryId ? Number(categoryId) : null,
        short_description: shortDescription || null,
        description: description || null,
        featured_image_url: featuredImageUrl || undefined,
        is_featured: isFeatured,
        ...seoDraftToPayload(seoDraft),
      };

      const financialPayload =
        mode === "admin"
          ? {
              price_amount: priceDisplay ? Number(priceDisplay) * 10 : null,
              sale_price_amount: salePriceDisplay ? Number(salePriceDisplay) * 10 : null,
              ...(productType === "physical"
                ? {
                    physical_detail: {
                      sku,
                      inventory_qty: Number(inventoryQty) || 0,
                      max_purchase_quantity: maxPurchaseQty ? Number(maxPurchaseQty) : null,
                    },
                  }
                : {
                    course_detail: {
                      instructor_name: instructorName || null,
                      capacity: capacity ? Number(capacity) : null,
                      start_date: startDate || null,
                      ...(productType === "online_course"
                        ? { access_destination_value: accessDestination || null }
                        : { schedule_text: scheduleText || null, location_detail: locationDetail || null }),
                    },
                  }),
            }
          : {};

      const payload = { ...basePayload, ...financialPayload };

      if (productId) {
        await cmsUpdateProduct(productId, payload);
      } else {
        await cmsCreateProduct(payload);
      }
      onSaved();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  if (productId && loadingExisting && !hydrated) {
    return <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="عنوان" required>
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="نوع محصول" required>
          <Select
            value={productType}
            onChange={(event) => setProductType(event.target.value as ProductType)}
            disabled={Boolean(productId)}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="دسته‌بندی">
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">بدون دسته‌بندی</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.title}</option>
          ))}
        </Select>
      </Field>

      <Field label="توضیح کوتاه">
        <TextArea value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} rows={2} />
      </Field>

      <Field label="توضیحات کامل">
        <div className="besat-editor-shell rounded-2xl border border-slate-200">
          <RichEditor
            value={description}
            onChange={setDescription}
            onJsonChange={setDescriptionJson}
            mode="simple"
            onOutlineChange={setOutline}
            onStatsChange={setStats}
            onUploadMedia={(file) => panelService.uploadMedia(file, { altText: file.name })}
            placeholder="توضیحات کامل محصول را اینجا بنویسید..."
          />
        </div>
      </Field>

      <Field label="تصویر شاخص">
        <div className="flex items-center gap-3">
          {featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featuredImageUrl} alt="پیش‌نمایش تصویر شاخص" className="size-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-400">
              بدون تصویر
            </div>
          )}
          <GhostButton type="button" onClick={() => setFeaturedImagePickerOpen(true)}>
            {featuredImageUrl ? "جایگزینی تصویر" : "انتخاب تصویر"}
          </GhostButton>
        </div>
        <MediaPickerDialog
          open={featuredImagePickerOpen}
          value={featuredImageUrl}
          onSelect={(url) => {
            setFeaturedImageUrl(url);
            setFeaturedImagePickerOpen(false);
          }}
          onClose={() => setFeaturedImagePickerOpen(false)}
        />
      </Field>

      <Field label="گالری تصاویر">
        {productId ? (
          <div className="grid gap-3">
            {galleryImages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {galleryImages.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={image.id} src={image.image ?? ""} alt={image.alt_text ?? ""} className="size-16 rounded-xl object-cover" />
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400">هنوز تصویری در گالری ثبت نشده است.</p>
            )}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploadingGalleryImage(true);
                cmsUploadProductGalleryImage(productId, file, { altText: title })
                  .then((image) => setGalleryImages((current) => [...current, image]))
                  .catch((reason) => setError(getApiErrorMessage(reason)))
                  .finally(() => {
                    setUploadingGalleryImage(false);
                    if (galleryInputRef.current) galleryInputRef.current.value = "";
                  });
              }}
            />
            <GhostButton type="button" disabled={uploadingGalleryImage} onClick={() => galleryInputRef.current?.click()}>
              {uploadingGalleryImage ? "در حال بارگذاری…" : "افزودن تصویر به گالری"}
            </GhostButton>
          </div>
        ) : (
          <p className="text-xs font-bold text-slate-400">برای افزودن تصویر به گالری، ابتدا محصول را ذخیره کنید.</p>
        )}
      </Field>

      <SeoPanel
        draft={seoDraft}
        onChange={(key, value) => setSeoDraft((current) => ({ ...current, [key]: value }))}
        title={title}
        slug={existing?.slug ?? ""}
        bodyJson={descriptionJson}
        outline={outline}
        wordCount={stats.words}
        fieldErrors={{}}
        urlPrefix="/shop"
      />

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
        <span className="text-sm font-black text-[#062452]">محصول ویژه</span>
        <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
      </label>

      {mode === "admin" ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="قیمت (تومان)" required>
              <TextInput type="number" value={priceDisplay} onChange={(event) => setPriceDisplay(event.target.value)} required />
            </Field>
            <Field label="قیمت ویژه (تومان، اختیاری)">
              <TextInput type="number" value={salePriceDisplay} onChange={(event) => setSalePriceDisplay(event.target.value)} />
            </Field>
          </div>

          {productType === "physical" ? (
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="کد کالا (SKU)" required>
                <TextInput dir="ltr" value={sku} onChange={(event) => setSku(event.target.value)} required />
              </Field>
              <Field label="موجودی انبار">
                <TextInput type="number" value={inventoryQty} onChange={(event) => setInventoryQty(Number(event.target.value))} />
              </Field>
              <Field label="حداکثر تعداد خرید">
                <TextInput type="number" value={maxPurchaseQty} onChange={(event) => setMaxPurchaseQty(event.target.value)} placeholder="بدون محدودیت" />
              </Field>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="مدرس">
                <TextInput value={instructorName} onChange={(event) => setInstructorName(event.target.value)} />
              </Field>
              <Field label="ظرفیت">
                <TextInput type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="بدون محدودیت" />
              </Field>
              <Field label="تاریخ شروع">
                <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </Field>
              {productType === "online_course" ? (
                <Field label="لینک/مقصد دسترسی (پس از پرداخت نمایش داده می‌شود)" className="md:col-span-2">
                  <TextInput dir="ltr" value={accessDestination} onChange={(event) => setAccessDestination(event.target.value)} />
                </Field>
              ) : (
                <>
                  <Field label="زمان‌بندی">
                    <TextInput value={scheduleText} onChange={(event) => setScheduleText(event.target.value)} placeholder="مثال: پنجشنبه‌ها ساعت ۱۶" />
                  </Field>
                  <Field label="محل برگزاری">
                    <TextInput value={locationDetail} onChange={(event) => setLocationDetail(event.target.value)} />
                  </Field>
                </>
              )}
            </div>
          )}
        </>
      ) : null}

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
