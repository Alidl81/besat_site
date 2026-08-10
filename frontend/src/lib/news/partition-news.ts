import type { PublicNewsItem } from "@/types/public-content";

function byPriority(a: PublicNewsItem, b: PublicNewsItem) {
  return (
    b.priority - a.priority ||
    Date.parse(b.published_at) - Date.parse(a.published_at)
  );
}

/**
 * Disjoint classification: featured takes precedence when both flags are
 * true, so every item belongs to exactly one section. Priority only orders
 * within a section — it never moves an item across the boundary.
 */
export function partitionNews(items: PublicNewsItem[]) {
  const featured = items.filter((item) => item.is_featured).sort(byPriority);
  const important = items
    .filter((item) => item.is_important && !item.is_featured)
    .sort(byPriority);
  const ordinary = items
    .filter((item) => !item.is_featured && !item.is_important)
    .sort(byPriority);

  return { featured, important, ordinary };
}
