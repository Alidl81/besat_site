"use client";

import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorIcon, type EditorIconName } from "@/components/editor/editor-icons";
import type { EditorOutlineItem } from "@/components/editor/rich-editor";
import { MediaPickerDialog } from "@/components/cms/media-picker-dialog";
import { analyzeContentSeo, seoCheckSummary, type SeoCheckStatus } from "@/lib/seo/seo-analysis";
import type { ContentSeoMetadata } from "@/types/panel-api";
import type { ApiFieldErrors } from "@/lib/api/client";

export type SeoDraft = {
  focusKeyphrase: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  isIndexable: boolean;
  isFollowable: boolean;
  isCornerstone: boolean;
};

export const emptySeoDraft: SeoDraft = {
  focusKeyphrase: "",
  seoTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImageUrl: "",
  isIndexable: true,
  isFollowable: true,
  isCornerstone: false,
};

export function seoDraftFrom(seo: ContentSeoMetadata | null | undefined): SeoDraft {
  return {
    focusKeyphrase: seo?.focus_keyphrase ?? "",
    seoTitle: seo?.seo_title ?? "",
    metaDescription: seo?.meta_description ?? "",
    canonicalUrl: seo?.canonical_url ?? "",
    ogTitle: seo?.og_title ?? "",
    ogDescription: seo?.og_description ?? "",
    ogImageUrl: seo?.og_image_url ?? "",
    isIndexable: seo?.is_indexable ?? true,
    isFollowable: seo?.is_followable ?? true,
    isCornerstone: seo?.is_cornerstone ?? false,
  };
}

export function seoDraftToPayload(draft: SeoDraft) {
  return {
    focus_keyphrase: draft.focusKeyphrase.trim() || null,
    seo_title: draft.seoTitle.trim() || null,
    meta_description: draft.metaDescription.trim() || null,
    canonical_url: draft.canonicalUrl.trim() || null,
    og_title: draft.ogTitle.trim() || null,
    og_description: draft.ogDescription.trim() || null,
    og_image_url: draft.ogImageUrl.trim() || null,
    is_indexable: draft.isIndexable,
    is_followable: draft.isFollowable,
    is_cornerstone: draft.isCornerstone,
  };
}

const statusMeta: Record<SeoCheckStatus, { icon: EditorIconName; label: string; className: string }> = {
  good: { icon: "circle-check", label: "خوب", className: "is-good" },
  improvement: { icon: "alert-triangle", label: "قابل بهبود", className: "is-improvement" },
  problem: { icon: "alert-circle", label: "مشکل", className: "is-problem" },
};

function SnippetPreview({
  title,
  description,
  slug,
  siteOrigin,
}: {
  title: string;
  description: string;
  slug: string;
  siteOrigin: string;
}) {
  return (
    <div className="besat-seo-snippet" dir="ltr">
      <p className="besat-seo-snippet-url">{siteOrigin}/news/{slug || "…"}</p>
      <p className="besat-seo-snippet-title">{title || "عنوان سئو نمایش داده می‌شود"}</p>
      <p className="besat-seo-snippet-description">
        {description || "توضیحات متا در این قسمت نمایش داده می‌شود تا کاربران پیش از ورود، محتوای صفحه را ببینند."}
      </p>
    </div>
  );
}

export function SeoPanel({
  draft,
  onChange,
  title,
  slug,
  bodyJson,
  outline,
  wordCount,
  fieldErrors,
  siteOrigin = "besat.example.com",
}: {
  draft: SeoDraft;
  onChange: <K extends keyof SeoDraft>(key: K, value: SeoDraft[K]) => void;
  title: string;
  slug: string;
  bodyJson: JSONContent | null;
  outline: EditorOutlineItem[];
  wordCount: number;
  fieldErrors: ApiFieldErrors;
  siteOrigin?: string;
}) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const checks = useMemo(
    () =>
      analyzeContentSeo({
        title,
        slug,
        seoTitle: draft.seoTitle,
        metaDescription: draft.metaDescription,
        focusKeyphrase: draft.focusKeyphrase,
        bodyJson,
        outline,
        wordCount,
      }),
    [title, slug, draft.seoTitle, draft.metaDescription, draft.focusKeyphrase, bodyJson, outline, wordCount],
  );

  const summary = seoCheckSummary(checks);
  const effectiveSeoTitle = draft.seoTitle || title;

  return (
    <details className="besat-editor-setting-group" open>
      <summary>
        <EditorIcon name="search" className="size-4" />
        سئو و اشتراک‌گذاری
        <span className="besat-seo-summary-counts" aria-hidden="true">
          {summary.problem > 0 ? <b className="is-problem">{summary.problem}</b> : null}
          {summary.improvement > 0 ? <b className="is-improvement">{summary.improvement}</b> : null}
          <b className="is-good">{summary.good}</b>
        </span>
        <EditorIcon name="chevron-down" />
      </summary>
      <div className="besat-editor-setting-body">
        <SnippetPreview
          title={effectiveSeoTitle}
          description={draft.metaDescription}
          slug={slug}
          siteOrigin={siteOrigin}
        />

        <label>
          <span>عبارت کلیدی کانونی</span>
          <input
            value={draft.focusKeyphrase}
            onChange={(event) => onChange("focusKeyphrase", event.target.value)}
            className="panel-input"
            placeholder="مثلاً: پیش‌ثبت‌نام بعثت"
          />
          <FieldErrors errors={fieldErrors} field="focus_keyphrase" />
        </label>

        <label>
          <span>
            عنوان سئو <small>({effectiveSeoTitle.length} نویسه)</small>
          </span>
          <input
            value={draft.seoTitle}
            onChange={(event) => onChange("seoTitle", event.target.value)}
            className="panel-input"
            placeholder={title}
          />
          <FieldErrors errors={fieldErrors} field="seo_title" />
        </label>

        <label>
          <span>
            اسلاگ <small>(فقط نمایشی؛ به‌صورت خودکار از عنوان ساخته می‌شود)</small>
          </span>
          <input value={slug} readOnly disabled dir="ltr" className="panel-input text-left" />
        </label>

        <label>
          <span>
            توضیحات متا <small>({draft.metaDescription.length} نویسه)</small>
          </span>
          <textarea
            value={draft.metaDescription}
            onChange={(event) => onChange("metaDescription", event.target.value)}
            className="panel-input min-h-24"
          />
          <FieldErrors errors={fieldErrors} field="meta_description" />
        </label>

        <label>
          <span>نشانی canonical</span>
          <input
            value={draft.canonicalUrl}
            onChange={(event) => onChange("canonicalUrl", event.target.value)}
            dir="ltr"
            className="panel-input text-left"
            placeholder="https://..."
          />
          <FieldErrors errors={fieldErrors} field="canonical_url" />
        </label>

        <label>
          <span>عنوان اشتراک‌گذاری (OG)</span>
          <input
            value={draft.ogTitle}
            onChange={(event) => onChange("ogTitle", event.target.value)}
            className="panel-input"
            placeholder={effectiveSeoTitle}
          />
          <FieldErrors errors={fieldErrors} field="og_title" />
        </label>

        <label>
          <span>توضیح اشتراک‌گذاری (OG)</span>
          <textarea
            value={draft.ogDescription}
            onChange={(event) => onChange("ogDescription", event.target.value)}
            className="panel-input min-h-24"
            placeholder={draft.metaDescription}
          />
          <FieldErrors errors={fieldErrors} field="og_description" />
        </label>

        <div>
          <span>تصویر اشتراک‌گذاری اجتماعی</span>
          {draft.ogImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.ogImageUrl} alt="پیش‌نمایش تصویر اشتراک‌گذاری" className="besat-editor-cover-preview" />
          ) : (
            <p className="besat-editor-cover-empty">تصویری انتخاب نشده؛ تصویر شاخص محتوا استفاده خواهد شد.</p>
          )}
          <button type="button" onClick={() => setMediaPickerOpen(true)} className="panel-secondary-button w-full">
            <EditorIcon name="image" className="size-4" />
            {draft.ogImageUrl ? "جایگزینی تصویر" : "انتخاب تصویر"}
          </button>
          <FieldErrors errors={fieldErrors} field="og_image_url" />
        </div>

        <label className="besat-editor-switch">
          <input
            type="checkbox"
            checked={draft.isIndexable}
            onChange={(event) => onChange("isIndexable", event.target.checked)}
          />
          <span aria-hidden="true" />
          <b>نمایه‌سازی در موتورهای جستجو مجاز باشد</b>
        </label>

        <label className="besat-editor-switch">
          <input
            type="checkbox"
            checked={draft.isFollowable}
            onChange={(event) => onChange("isFollowable", event.target.checked)}
          />
          <span aria-hidden="true" />
          <b>دنبال‌کردن پیوندهای این صفحه مجاز باشد</b>
        </label>

        <label className="besat-editor-switch">
          <input
            type="checkbox"
            checked={draft.isCornerstone}
            onChange={(event) => onChange("isCornerstone", event.target.checked)}
          />
          <span aria-hidden="true" />
          <b>محتوای محوری (cornerstone)</b>
        </label>

        <ul className="besat-seo-checklist" aria-label="تحلیل سئو">
          {checks.map((item) => {
            const meta = statusMeta[item.status];
            return (
              <li key={item.id} className={`besat-seo-check ${meta.className}`}>
                <EditorIcon name={meta.icon} className="size-4" />
                <div>
                  <p>
                    <b>{item.title}</b>
                    <span className="besat-seo-check-status">{meta.label}</span>
                  </p>
                  <small>{item.description}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <MediaPickerDialog
        open={mediaPickerOpen}
        value={draft.ogImageUrl}
        onSelect={(url) => {
          onChange("ogImageUrl", url);
          setMediaPickerOpen(false);
        }}
        onClose={() => setMediaPickerOpen(false)}
      />
    </details>
  );
}

function FieldErrors({ errors, field }: { errors: ApiFieldErrors; field: string }) {
  const messages = errors[field];
  if (!messages?.length) return null;
  return (
    <small role="alert" className="mt-1 block text-xs font-bold text-rose-600">
      {messages.join(" ")}
    </small>
  );
}
