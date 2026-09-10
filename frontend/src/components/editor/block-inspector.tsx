"use client";

import type { ReactNode } from "react";
import { EditorIcon } from "@/components/editor/editor-icons";
import {
  CALLOUT_TONES,
  EMBED_ASPECTS,
  IMAGE_RADII,
  QUOTE_STYLES,
  TABLE_DENSITIES,
  TABLE_THEMES,
  type ActiveBlockContext,
  type CalloutTone,
} from "@/components/editor/rich-editor";

type BlockInspectorProps = {
  block: ActiveBlockContext;
  onReplaceImage: () => void;
};

const TABLE_THEME_LABELS: Record<(typeof TABLE_THEMES)[number], string> = {
  minimal: "مینیمال",
  bordered: "حاشیه‌دار",
  striped: "راه‌راه",
  "accent-header": "تیتر رنگی",
  soft: "ملایم",
  compact: "فشرده",
  formal: "رسمی",
};

const TABLE_DENSITY_LABELS: Record<(typeof TABLE_DENSITIES)[number], string> = {
  compact: "فشرده",
  normal: "معمولی",
  comfortable: "راحت",
};

const QUOTE_STYLE_LABELS: Record<(typeof QUOTE_STYLES)[number], string> = {
  classic: "کلاسیک",
  accent: "تاکیدی",
  minimal: "مینیمال",
};

const CALLOUT_TONE_LABELS: Record<CalloutTone, string> = {
  note: "یادداشت",
  info: "اطلاعات",
  success: "موفقیت",
  warning: "هشدار",
  important: "مهم",
};

const IMAGE_RADIUS_LABELS: Record<(typeof IMAGE_RADII)[number], string> = {
  none: "بدون گردی",
  sm: "کم",
  md: "متوسط",
  lg: "زیاد",
};

const EMBED_ASPECT_LABELS: Record<(typeof EMBED_ASPECTS)[number], string> = {
  "16:9": "۱۶:۹",
  "4:3": "۴:۳",
  "1:1": "۱:۱",
};

const KIND_LABELS: Record<ActiveBlockContext["kind"], string> = {
  table: "تنظیمات جدول",
  image: "تنظیمات تصویر",
  gallery: "تنظیمات گالری",
  media: "تنظیمات رسانه",
  quote: "تنظیمات نقل‌قول",
  callout: "تنظیمات متن برجسته",
  embed: "تنظیمات ویدئو",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="besat-inspector-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="besat-inspector-segmented" role="group">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "is-active" : ""}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="besat-editor-switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <b>{label}</b>
    </label>
  );
}

function InspectorHeader({ block }: { block: ActiveBlockContext }) {
  return (
    <header className="besat-inspector-header">
      <h3>{KIND_LABELS[block.kind]}</h3>
      <div className="besat-inspector-actions">
        <button type="button" disabled={!block.canMoveUp} onClick={block.moveUp} aria-label="انتقال به بالا" title="انتقال به بالا">
          <EditorIcon name="chevron-up" />
        </button>
        <button type="button" disabled={!block.canMoveDown} onClick={block.moveDown} aria-label="انتقال به پایین" title="انتقال به پایین">
          <EditorIcon name="chevron-down" />
        </button>
        <button type="button" onClick={block.duplicate} aria-label="تکثیر بلوک" title="تکثیر">
          <EditorIcon name="duplicate" />
        </button>
        <button type="button" onClick={block.remove} aria-label="حذف بلوک" title="حذف" className="is-danger">
          <EditorIcon name="trash" />
        </button>
      </div>
    </header>
  );
}

function TableInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { theme?: string; density?: string; striped?: boolean; fullWidth?: boolean; caption?: string };
  const table = block.table;
  if (!table) return null;

  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <h4>ساختار</h4>
        <div className="besat-inspector-grid">
          <button type="button" onClick={table.addRowBefore}>افزودن ردیف بالا</button>
          <button type="button" onClick={table.addRowAfter}>افزودن ردیف پایین</button>
          <button type="button" onClick={table.deleteRow} className="is-danger">حذف ردیف</button>
          <button type="button" onClick={table.addColumnBefore}>افزودن ستون قبل</button>
          <button type="button" onClick={table.addColumnAfter}>افزودن ستون بعد</button>
          <button type="button" onClick={table.deleteColumn} className="is-danger">حذف ستون</button>
          <button type="button" onClick={table.mergeCells}>ادغام سلول‌ها</button>
          <button type="button" onClick={table.splitCell}>جداسازی سلول</button>
          <button type="button" onClick={table.toggleHeaderRow}>ردیف تیتر</button>
          <button type="button" onClick={table.toggleHeaderColumn}>ستون تیتر</button>
        </div>
        <button type="button" onClick={table.deleteTable} className="besat-inspector-danger-button">حذف جدول</button>
      </section>

      <section className="besat-inspector-section">
        <h4>ظاهر جدول</h4>
        <Field label="طرح‌بندی">
          <div className="besat-inspector-swatch-grid">
            {TABLE_THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                className={`besat-inspector-swatch besat-table-preview besat-table-preview--${theme} ${attrs.theme === theme ? "is-active" : ""}`}
                onClick={() => block.updateAttrs({ theme })}
                aria-pressed={attrs.theme === theme}
              >
                {TABLE_THEME_LABELS[theme]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="تراکم">
          <SegmentedControl
            value={(attrs.density as (typeof TABLE_DENSITIES)[number]) ?? "normal"}
            options={TABLE_DENSITIES}
            labels={TABLE_DENSITY_LABELS}
            onChange={(density) => block.updateAttrs({ density })}
          />
        </Field>
        <ToggleField label="راه‌راه" checked={Boolean(attrs.striped)} onChange={(striped) => block.updateAttrs({ striped })} />
        <ToggleField
          label="عرض کامل"
          checked={attrs.fullWidth !== false}
          onChange={(fullWidth) => block.updateAttrs({ fullWidth })}
        />
      </section>

      <section className="besat-inspector-section">
        <h4>محتوا</h4>
        <Field label="عنوان جدول (اختیاری)">
          <input
            className="panel-input"
            value={attrs.caption ?? ""}
            onChange={(event) => block.updateAttrs({ caption: event.target.value })}
            placeholder="مثلاً: برنامه هفتگی کلاس‌ها"
          />
        </Field>
        <Field label="چیدمان عمودی سلول جاری">
          <div className="besat-inspector-segmented" role="group">
            <button type="button" onClick={() => table.setCellVerticalAlign("top")}>بالا</button>
            <button type="button" onClick={() => table.setCellVerticalAlign("middle")}>وسط</button>
            <button type="button" onClick={() => table.setCellVerticalAlign("bottom")}>پایین</button>
          </div>
        </Field>
      </section>
    </div>
  );
}

function ImageInspector({ block, onReplaceImage }: { block: ActiveBlockContext; onReplaceImage: () => void }) {
  const attrs = block.attrs as {
    width?: string | null;
    align?: string;
    alt?: string;
    caption?: string;
    link?: string;
    radius?: string;
    lightbox?: boolean;
  };
  const widthNumber = Number.parseInt(String(attrs.width ?? ""), 10);

  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <button type="button" onClick={onReplaceImage} className="panel-secondary-button w-full">
          <EditorIcon name="upload" className="size-4" />
          جایگزینی تصویر
        </button>
        <Field label="عرض (پیکسل) — همچنین با دستگیره‌های گوشه تصویر در بوم قابل تغییر است">
          <input
            className="panel-input"
            type="number"
            min={120}
            max={900}
            dir="ltr"
            value={Number.isFinite(widthNumber) ? widthNumber : ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next > 0) block.updateAttrs({ width: `${Math.round(next)}px` });
            }}
          />
        </Field>
        <Field label="چینش">
          <SegmentedControl
            value={(attrs.align as "left" | "center" | "right") ?? "center"}
            options={["right", "center", "left"] as const}
            labels={{ right: "راست", center: "وسط", left: "چپ" }}
            onChange={(align) => block.updateAttrs({ align })}
          />
        </Field>
      </section>

      <section className="besat-inspector-section">
        <h4>محتوا</h4>
        <Field label="متن جایگزین (Alt)">
          <input className="panel-input" value={attrs.alt ?? ""} onChange={(event) => block.updateAttrs({ alt: event.target.value })} />
        </Field>
        <Field label="زیرنویس">
          <input className="panel-input" value={attrs.caption ?? ""} onChange={(event) => block.updateAttrs({ caption: event.target.value })} />
        </Field>
        <Field label="لینک (اختیاری)">
          <input
            className="panel-input"
            dir="ltr"
            value={attrs.link ?? ""}
            onChange={(event) => block.updateAttrs({ link: event.target.value })}
            placeholder="https://example.com"
          />
        </Field>
      </section>

      <section className="besat-inspector-section">
        <h4>نمایش</h4>
        <Field label="گردی گوشه">
          <SegmentedControl
            value={(attrs.radius as (typeof IMAGE_RADII)[number]) ?? "none"}
            options={IMAGE_RADII}
            labels={IMAGE_RADIUS_LABELS}
            onChange={(radius) => block.updateAttrs({ radius })}
          />
        </Field>
        <ToggleField
          label="نمایش تمام‌صفحه (لایت‌باکس)"
          checked={Boolean(attrs.lightbox)}
          onChange={(lightbox) => block.updateAttrs({ lightbox })}
        />
      </section>
    </div>
  );
}

function GalleryInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { columns?: string; gap?: string; aspect?: string; captions?: boolean; lightbox?: boolean };

  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <Field label="تعداد ستون">
          <SegmentedControl
            value={(attrs.columns as "2" | "3" | "4" | "auto") ?? "auto"}
            options={["2", "3", "4", "auto"] as const}
            labels={{ "2": "۲", "3": "۳", "4": "۴", auto: "خودکار" }}
            onChange={(columns) => block.updateAttrs({ columns })}
          />
        </Field>
        <Field label="فاصله">
          <SegmentedControl
            value={(attrs.gap as "compact" | "normal" | "comfortable") ?? "normal"}
            options={["compact", "normal", "comfortable"] as const}
            labels={{ compact: "فشرده", normal: "معمولی", comfortable: "راحت" }}
            onChange={(gap) => block.updateAttrs({ gap })}
          />
        </Field>
        <Field label="نسبت تصویر">
          <SegmentedControl
            value={(attrs.aspect as "natural" | "square" | "4:3" | "16:9") ?? "natural"}
            options={["natural", "square", "4:3", "16:9"] as const}
            labels={{ natural: "طبیعی", square: "مربع", "4:3": "۴:۳", "16:9": "۱۶:۹" }}
            onChange={(aspect) => block.updateAttrs({ aspect })}
          />
        </Field>
        <ToggleField label="نمایش زیرنویس‌ها" checked={attrs.captions !== false} onChange={(captions) => block.updateAttrs({ captions })} />
        <ToggleField label="نمایش تمام‌صفحه (لایت‌باکس)" checked={attrs.lightbox !== false} onChange={(lightbox) => block.updateAttrs({ lightbox })} />
      </section>
      <p className="besat-inspector-hint">برای افزودن/حذف/جابجایی تصاویر و ویرایش عنوان هر تصویر، از نوار ابزار روی خود گالری در بوم استفاده کنید.</p>
    </div>
  );
}

function MediaInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { title?: string; alt?: string; caption?: string; credit?: string };
  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <Field label="عنوان">
          <input className="panel-input" value={attrs.title ?? ""} onChange={(event) => block.updateAttrs({ title: event.target.value })} />
        </Field>
        <Field label="متن جایگزین (Alt)">
          <input className="panel-input" value={attrs.alt ?? ""} onChange={(event) => block.updateAttrs({ alt: event.target.value })} />
        </Field>
        <Field label="زیرنویس">
          <input className="panel-input" value={attrs.caption ?? ""} onChange={(event) => block.updateAttrs({ caption: event.target.value })} />
        </Field>
        <Field label="منبع/اعتبار">
          <input className="panel-input" value={attrs.credit ?? ""} onChange={(event) => block.updateAttrs({ credit: event.target.value })} />
        </Field>
      </section>
    </div>
  );
}

function QuoteInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { text?: string; author?: string; source?: string; style?: string };
  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <Field label="سبک">
          <SegmentedControl
            value={(attrs.style as (typeof QUOTE_STYLES)[number]) ?? "classic"}
            options={QUOTE_STYLES}
            labels={QUOTE_STYLE_LABELS}
            onChange={(style) => block.updateAttrs({ style })}
          />
        </Field>
        <Field label="متن نقل‌قول">
          <textarea
            className="panel-input min-h-24"
            value={attrs.text ?? ""}
            onChange={(event) => block.updateAttrs({ text: event.target.value })}
          />
        </Field>
        <Field label="نویسنده (اختیاری)">
          <input className="panel-input" value={attrs.author ?? ""} onChange={(event) => block.updateAttrs({ author: event.target.value })} />
        </Field>
        <Field label="منبع (اختیاری)">
          <input className="panel-input" value={attrs.source ?? ""} onChange={(event) => block.updateAttrs({ source: event.target.value })} />
        </Field>
      </section>
    </div>
  );
}

function CalloutInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { title?: string; body?: string; cite?: string; tone?: CalloutTone };
  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <Field label="نوع">
          <div className="besat-inspector-swatch-grid">
            {CALLOUT_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                className={`besat-inspector-swatch besat-callout-preview besat-callout-preview--${tone} ${attrs.tone === tone ? "is-active" : ""}`}
                onClick={() => block.updateAttrs({ tone })}
                aria-pressed={attrs.tone === tone}
              >
                {CALLOUT_TONE_LABELS[tone]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="عنوان (اختیاری)">
          <input className="panel-input" value={attrs.title ?? ""} onChange={(event) => block.updateAttrs({ title: event.target.value })} />
        </Field>
        <Field label="متن">
          <textarea
            className="panel-input min-h-24"
            value={attrs.body ?? ""}
            onChange={(event) => block.updateAttrs({ body: event.target.value })}
          />
        </Field>
        <Field label="منبع/امضا (اختیاری)">
          <input className="panel-input" value={attrs.cite ?? ""} onChange={(event) => block.updateAttrs({ cite: event.target.value })} />
        </Field>
      </section>
    </div>
  );
}

function providerLabel(src: string) {
  if (src.includes("youtube-nocookie.com")) return "YouTube";
  if (src.includes("vimeo.com")) return "Vimeo";
  return "نامشخص";
}

function EmbedInspector({ block }: { block: ActiveBlockContext }) {
  const attrs = block.attrs as { src?: string; title?: string; caption?: string; aspect?: string };
  return (
    <div className="besat-inspector-body">
      <section className="besat-inspector-section">
        <Field label="ارائه‌دهنده تشخیص داده‌شده">
          <input className="panel-input" dir="ltr" value={providerLabel(attrs.src ?? "")} disabled readOnly />
        </Field>
        <Field label="عنوان">
          <input className="panel-input" value={attrs.title ?? ""} onChange={(event) => block.updateAttrs({ title: event.target.value })} />
        </Field>
        <Field label="زیرنویس">
          <input className="panel-input" value={attrs.caption ?? ""} onChange={(event) => block.updateAttrs({ caption: event.target.value })} />
        </Field>
        <Field label="نسبت تصویر">
          <SegmentedControl
            value={(attrs.aspect as (typeof EMBED_ASPECTS)[number]) ?? "16:9"}
            options={EMBED_ASPECTS}
            labels={EMBED_ASPECT_LABELS}
            onChange={(aspect) => block.updateAttrs({ aspect })}
          />
        </Field>
      </section>
    </div>
  );
}

export function BlockInspector({ block, onReplaceImage }: BlockInspectorProps) {
  return (
    <section className="besat-inspector" aria-label={KIND_LABELS[block.kind]}>
      <InspectorHeader block={block} />
      {block.kind === "table" ? <TableInspector block={block} /> : null}
      {block.kind === "image" ? <ImageInspector block={block} onReplaceImage={onReplaceImage} /> : null}
      {block.kind === "gallery" ? <GalleryInspector block={block} /> : null}
      {block.kind === "media" ? <MediaInspector block={block} /> : null}
      {block.kind === "quote" ? <QuoteInspector block={block} /> : null}
      {block.kind === "callout" ? <CalloutInspector block={block} /> : null}
      {block.kind === "embed" ? <EmbedInspector block={block} /> : null}
    </section>
  );
}
