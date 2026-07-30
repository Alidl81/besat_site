import type { PublicNewsItem } from "@/types/public-content";

export function partitionNews(items: PublicNewsItem[]) {
  const used = new Set<number>();
  const take = (
    predicate: (item: PublicNewsItem) => boolean,
    limit: number,
  ) =>
    items
      .filter((item) => !used.has(item.id) && predicate(item))
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          Date.parse(b.published_at) - Date.parse(a.published_at),
      )
      .slice(0, limit)
      .map((item) => {
        used.add(item.id);
        return item;
      });

  return {
    featured: take(
      (item) => item.is_featured || item.is_important || item.priority > 0,
      6,
    ),
    important: take((item) => item.is_important, 6),
    units: take((item) => item.unit !== null, 9),
  };
}
