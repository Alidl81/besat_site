"use client";

import { useEffect, useState } from "react";
import { RichEditor } from "@/components/editor/rich-editor";
import { staticPagesRepository } from "@/lib/data/repositories";
import type { StaticPageRecord } from "@/lib/data/domain-types";

type StaticPageEditorProps = {
  slug: string;
};

export function StaticPageEditor({ slug }: StaticPageEditorProps) {
  const [page, setPage] = useState<StaticPageRecord | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    staticPagesRepository.list().then((all) => {
      const found = all.find((p) => p.slug === slug) ?? null;
      if (found) {
        setPage(found);
        setBodyHtml(found.body_html);
        setTitle(found.title);
        setMetaDescription(found.meta_description ?? "");
      }
    });
  }, [slug]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      if (page) {
        await staticPagesRepository.update(page.id, {
          title,
          body_html: bodyHtml,
          meta_description: metaDescription || null,
        });
        setMessage({ ok: true, text: "صفحه با موفقیت ذخیره شد." });
      } else {
        const newPage = await staticPagesRepository.create({
          slug,
          title,
          body_html: bodyHtml,
          meta_description: metaDescription || null,
          is_published: true,
        });
        setPage(newPage);
        setMessage({ ok: true, text: "صفحه ایجاد و ذخیره شد." });
      }
    } catch {
      setMessage({ ok: false, text: "خطا در ذخیره صفحه." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {/* هدر */}
      <div className="flex flex-col gap-4 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-right shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-xl font-black text-[#062452]">ویرایش صفحه درباره ما</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">
            محتوای این صفحه در سایت عمومی نمایش داده می‌شود.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/about"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-[#062452] transition hover:bg-slate-50"
          >
            <span>👁</span>
            <span>مشاهده در سایت</span>
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="besat-navy-button inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#12395b] px-5 text-sm font-black transition hover:bg-[#0d2f4d] disabled:opacity-70"
          >
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-right text-sm font-black ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* فیلدها */}
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-5">
          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              عنوان صفحه <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              توضیحات متا (برای موتور جستجو)
            </span>
            <input
              type="text"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="توضیح کوتاه برای نمایش در نتایج جستجو"
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          <div className="text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              محتوای صفحه <span className="text-rose-500">*</span>
            </span>
            <RichEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="محتوای صفحه درباره ما را اینجا بنویسید..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
