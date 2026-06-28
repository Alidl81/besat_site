"use client";

import { useRef, useState } from "react";

type CsvRow = Record<string, string>;

type ExcelImportProps<T extends { id: string; created_at: string; updated_at: string }> = {
  /** ستون‌های مورد انتظار در CSV — برای راهنمای کاربر */
  columns: { key: string; label: string; required?: boolean }[];
  /** نگاشت ردیف CSV به موجودیت */
  mapRow: (row: CsvRow) => Omit<T, "id" | "created_at" | "updated_at"> | null;
  /** callback ذخیره هر ردیف */
  onImport: (rows: Omit<T, "id" | "created_at" | "updated_at">[]) => Promise<void>;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

export function ExcelImport<T extends { id: string; created_at: string; updated_at: string }>({
  columns,
  mapRow,
  onImport,
}: ExcelImportProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "preview" | "importing" | "done" | "error">("idle");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [message, setMessage] = useState("");

  function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      setState("error");
      setMessage("لطفاً فایل را با فرمت CSV آپلود کنید. در Excel: File → Save As → CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setState("error");
        setMessage("فایل خالی است یا ساختار درستی ندارد.");
        return;
      }
      setRows(parsed);
      setState("preview");
      setMessage("");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    setState("importing");
    const valid = rows.map(mapRow).filter((r): r is Omit<T, "id" | "created_at" | "updated_at"> => r !== null);
    if (valid.length === 0) {
      setState("error");
      setMessage("هیچ ردیف معتبری در فایل یافت نشد. ستون‌های اجباری را بررسی کنید.");
      return;
    }
    try {
      await onImport(valid);
      setState("done");
      setMessage(`${valid.length} ردیف با موفقیت وارد شد.`);
      setRows([]);
    } catch {
      setState("error");
      setMessage("خطا در وارد کردن داده‌ها.");
    }
  }

  const required = columns.filter((c) => c.required);
  const optional = columns.filter((c) => !c.required);

  return (
    <div className="space-y-4 text-right">
      {/* راهنما */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-black text-[#062452]">راهنمای ورود گروهی با Excel</p>
        <ol className="mt-3 space-y-2 text-sm font-bold text-slate-600">
          <li>۱. در Excel یک فایل بسازید با ستون‌های زیر.</li>
          <li>
            ۲. ستون‌های <span className="text-rose-600">اجباری</span>:{" "}
            {required.map((c) => (
              <code key={c.key} className="mr-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">
                {c.label}
              </code>
            ))}
          </li>
          {optional.length > 0 ? (
            <li>
              ۳. ستون‌های اختیاری:{" "}
              {optional.map((c) => (
                <code key={c.key} className="mr-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                  {c.label}
                </code>
              ))}
            </li>
          ) : null}
          <li>۴. فایل را با فرمت <strong>CSV (UTF-8)</strong> ذخیره کنید.</li>
          <li>۵. فایل CSV را اینجا آپلود کنید.</li>
        </ol>

        {/* دانلود نمونه */}
        <button
          type="button"
          onClick={() => {
            const header = columns.map((c) => c.label).join(",");
            const sample = columns.map((c) => (c.required ? "مقدار نمونه" : "")).join(",");
            const csv = `${header}\n${sample}`;
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#062452] transition hover:bg-emerald-50 hover:text-emerald-700"
        >
          <span>⬇</span>
          <span>دانلود فایل نمونه</span>
        </button>
      </div>

      {/* آپلود */}
      <div
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files);
        }}
      >
        <span className="text-3xl">📂</span>
        <p className="mt-2 text-sm font-black text-[#062452]">فایل CSV را اینجا بکشید یا کلیک کنید</p>
        <p className="mt-1 text-xs font-bold text-slate-400">فقط فرمت CSV (UTF-8) قابل قبول است</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files)}
        />
      </div>

      {/* پیام */}
      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            state === "error"
              ? "bg-rose-50 text-rose-700"
              : state === "done"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-50 text-slate-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      {/* پیش‌نمایش */}
      {state === "preview" && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-[#062452]">
              {rows.length} ردیف آماده وارد شدن
            </p>
            <button
              type="button"
              onClick={() => { setState("idle"); setRows([]); }}
              className="text-xs font-black text-slate-400 hover:text-rose-600"
            >
              لغو
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-max text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {Object.keys(rows[0]).map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-black text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 text-xs font-bold text-slate-600">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 ? (
              <p className="p-3 text-center text-xs font-bold text-slate-400">
                ... و {rows.length - 5} ردیف دیگر
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={state !== "preview"}
            className="besat-navy-button flex h-12 w-full items-center justify-center rounded-2xl bg-[#12395b] text-sm font-black transition hover:bg-[#0d2f4d] disabled:opacity-70"
          >
            وارد کردن {rows.length} ردیف
          </button>
        </div>
      ) : null}

      {state === "importing" ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="size-6 animate-spin rounded-full border-3 border-slate-200 border-t-emerald-500" />
          <span className="text-sm font-black text-slate-500">در حال وارد کردن...</span>
        </div>
      ) : null}
    </div>
  );
}
