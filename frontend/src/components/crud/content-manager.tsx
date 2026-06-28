"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { Field, Select, StatusBadge, TextArea, TextInput } from "@/components/crud/crud-ui";
import { RichEditor } from "@/components/editor/rich-editor";
import { contentRepository } from "@/lib/data/repositories";
import type {
  ContentKind,
  ContentRecord,
  PublishStatus,
  WithoutSystemFields,
} from "@/lib/data/domain-types";

type ContentManagerProps = {
  kind: ContentKind;
  /** اگر مشخص شود، فقط محتوای همین واحد + اسکوپ school نمایش داده می‌شود و محتوای جدید به این واحد بسته می‌شود */
  unitId?: string | null;
  /** نقش سازنده برای ثبت author_role */
  authorRole?: ContentRecord["author_role"];
  /** آیا اجازه انتشار مستقیم دارد (مثلاً همکار رسانه فقط پیش‌نویس/در انتظار بررسی) */
  canPublish?: boolean;
};

function slugify(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .slice(0, 80);
}

export function ContentManager({
  kind,
  unitId = null,
  authorRole = null,
  canPublish = true,
}: ContentManagerProps) {
  const kindLabel = kind === "news" ? "خبر" : "اطلاعیه";

  const columns: Column<ContentRecord>[] = [
    {
      key: "title",
      header: "عنوان",
      render: (item) => <span className="font-black">{item.title}</span>,
    },
    {
      key: "scope",
      header: "دامنه",
      render: (item) => (
        <span className="text-xs font-bold text-slate-500">
          {item.scope === "school" ? "کل مدرسه" : "واحد"}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "date",
      header: "تاریخ",
      render: (item) => (
        <span className="text-xs font-bold text-slate-400">
          {new Intl.DateTimeFormat("fa-IR").format(new Date(item.created_at))}
        </span>
      ),
    },
  ];

  return (
    <CrudManager<ContentRecord>
      title={kind === "news" ? "مدیریت اخبار" : "مدیریت اطلاعیه‌ها"}
      description={`در این بخش ${kindLabel}‌ها را ایجاد، ویرایش و منتشر کنید.`}
      repository={contentRepository}
      filter={(item) => {
        if (item.kind !== kind) return false;
        if (unitId) {
          return item.unit_id === unitId || item.scope === "school";
        }
        return true;
      }}
      columns={columns}
      emptyText={kind === "news" ? "خبری برای نمایش وجود ندارد." : "اطلاعیه‌ای برای نمایش وجود ندارد."}
      addLabel={`${kindLabel} جدید`}
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <ContentForm
          kind={kind}
          unitId={unitId}
          authorRole={authorRole}
          canPublish={canPublish}
          initial={initial}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={submitting}
        />
      )}
    />
  );
}

type ContentFormProps = {
  kind: ContentKind;
  unitId: string | null;
  authorRole: ContentRecord["author_role"];
  canPublish: boolean;
  initial: ContentRecord | null;
  onSubmit: (data: WithoutSystemFields<ContentRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
};

function ContentForm({
  kind,
  unitId,
  authorRole,
  canPublish,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: ContentFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html ?? "");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [scope, setScope] = useState<ContentRecord["scope"]>(
    initial?.scope ?? (unitId ? "unit" : "school"),
  );
  const [status, setStatus] = useState<PublishStatus>(initial?.status ?? "draft");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      kind,
      title,
      slug: initial?.slug || slugify(title) || `item-${Date.now()}`,
      summary: summary || null,
      body_html: bodyHtml,
      cover_image: coverImage || null,
      scope: unitId ? scope : scope,
      unit_id: scope === "unit" ? unitId : null,
      category: category || null,
      status,
      author_role: initial?.author_role ?? authorRole,
      published_at:
        status === "published"
          ? initial?.published_at ?? new Date().toISOString()
          : null,
    });
  }

  const statusOptions: { value: PublishStatus; label: string }[] = canPublish
    ? [
        { value: "draft", label: "پیش‌نویس" },
        { value: "waiting_review", label: "در انتظار بررسی" },
        { value: "published", label: "منتشرشده" },
      ]
    : [
        { value: "draft", label: "پیش‌نویس" },
        { value: "waiting_review", label: "ارسال برای بررسی" },
      ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="عنوان" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="دسته‌بندی">
          <TextInput
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="مثال: علمی، فرهنگی"
          />
        </Field>
      </div>

      <Field label="خلاصه">
        <TextArea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="خلاصه کوتاه برای نمایش در فهرست..."
        />
      </Field>

      <Field label="تصویر شاخص (URL)">
        <TextInput
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="/images/... یا نشانی کامل تصویر"
        />
      </Field>

      <Field label="متن کامل" required>
        <RichEditor
          value={bodyHtml}
          onChange={setBodyHtml}
          placeholder={`متن کامل ${kind === "news" ? "خبر" : "اطلاعیه"} را اینجا بنویسید...`}
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        {unitId ? (
          <Field label="دامنه انتشار">
            <Select value={scope} onChange={(e) => setScope(e.target.value as ContentRecord["scope"])}>
              <option value="unit">فقط این واحد</option>
              <option value="school">کل مدرسه</option>
            </Select>
          </Field>
        ) : (
          <Field label="دامنه انتشار">
            <Select value={scope} onChange={(e) => setScope(e.target.value as ContentRecord["scope"])}>
              <option value="school">کل مدرسه</option>
              <option value="unit">واحد خاص</option>
            </Select>
          </Field>
        )}

        <Field label="وضعیت انتشار">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PublishStatus)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
