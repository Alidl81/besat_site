import { describe, expect, it } from "vitest";
import { partitionNews } from "@/lib/news/partition-news";
import type { PublicNewsItem } from "@/types/public-content";

function item(
  id: number,
  values: Partial<PublicNewsItem> = {},
): PublicNewsItem {
  return {
    id,
    title: `خبر ${id}`,
    slug: `news-${id}`,
    summary: null,
    cover_image: null,
    published_at: `2026-07-${String(id).padStart(2, "0")}`,
    category: null,
    scope: "school",
    unit: null,
    status: "published",
    is_featured: false,
    is_important: false,
    priority: 0,
    is_published: true,
    ...values,
  };
}

describe("partitionNews", () => {
  it("deduplicates across featured, important and unit sections", () => {
    const sections = partitionNews([
      item(1, { is_featured: true, is_important: true, priority: 4 }),
      item(2, { is_important: true }),
      item(3, {
        scope: "unit",
        unit: { id: 1, title: "واحد", slug: "unit" },
      }),
    ]);
    expect(sections.featured.map((news) => news.id)).toEqual([1, 2]);
    expect(sections.important.map((news) => news.id)).toEqual([]);
    expect(sections.units.map((news) => news.id)).toEqual([3]);
  });

  it("treats positive backend priority as hot and orders slider candidates", () => {
    const sections = partitionNews([
      item(1, { is_featured: true, priority: 1 }),
      item(2, { is_featured: true, priority: 8 }),
      item(3, { priority: 8 }),
    ]);
    expect(sections.featured.map((news) => news.id)).toEqual([3, 2, 1]);
  });
});
