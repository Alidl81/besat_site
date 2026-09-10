import type { JSONContent } from "@tiptap/core";

// CMS-TABLE-FORGED-COLWIDTH-001-R1: mirrors backend/apps/content/rich_text.py's
// _safe_colwidth()/_sanitize_table_colwidths() bound exactly. The backend now
// sanitizes every editor_json it hands back (both at write time and, since the
// R1 reopen, at every read too), but this editor is not the only place a
// document's JSON could ever originate from -- pasted/imported content,
// undo history, or a future data source that skips the API entirely could
// still carry a forged colwidth. Codex demonstrated that a single forged
// value (e.g. 999999) reaches ProseMirror's own table plugin as a literal
// inline pixel width, blowing a table out past 1,000,000px wide inside a
// 390px editor viewport -- clamping here too, right where this editor
// hydrates a document, closes that regardless of where the document came
// from, the same "don't trust a single boundary" reasoning already applied
// to _safe_url()/isSafeExternalHttpUrl() on both sides of this app.
const MIN_COLWIDTH_PX = 1;
const MAX_COLWIDTH_PX = 2000;

function safeColwidth(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const width = Math.trunc(value);
  return width >= MIN_COLWIDTH_PX && width <= MAX_COLWIDTH_PX ? width : null;
}

function sanitizeNode(node: unknown): void {
  if (!node || typeof node !== "object") return;
  const candidate = node as JSONContent;

  if (candidate.type === "tableCell" || candidate.type === "tableHeader") {
    const attrs = candidate.attrs as Record<string, unknown> | undefined;
    if (attrs && "colwidth" in attrs) {
      const raw = attrs.colwidth;
      attrs.colwidth = Array.isArray(raw) ? raw.map(safeColwidth) : null;
    }
  }

  for (const child of candidate.content ?? []) {
    sanitizeNode(child);
  }
}

/**
 * Clamps every tableCell/tableHeader colwidth entry in a TipTap JSON
 * document in place (and returns it, for convenient use in a memo/effect).
 * Never throws -- an already-malformed document should render as best it
 * can, not crash the editor a second way.
 */
export function sanitizeStoredTiptapDocument<T extends JSONContent | null | undefined>(doc: T): T {
  if (doc && typeof doc === "object") {
    for (const node of doc.content ?? []) {
      sanitizeNode(node);
    }
  }
  return doc;
}
