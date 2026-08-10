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
  it("is disjoint: featured takes precedence when both flags are true", () => {
    const sections = partitionNews([
      item(1, { is_featured: true, is_important: true, priority: 4 }),
      item(2, { is_important: true }),
      item(3, {}),
    ]);
    expect(sections.featured.map((news) => news.id)).toEqual([1]);
    expect(sections.important.map((news) => news.id)).toEqual([2]);
    expect(sections.ordinary.map((news) => news.id)).toEqual([3]);
  });

  it("never lets priority move an item across a section boundary", () => {
    const sections = partitionNews([
      item(1, { is_important: true, priority: 0 }),
      item(2, { priority: 99 }),
    ]);
    expect(sections.important.map((news) => news.id)).toEqual([1]);
    expect(sections.ordinary.map((news) => news.id)).toEqual([2]);
  });

  it("orders each section by priority, then recency, without a cap", () => {
    const sections = partitionNews([
      item(1, { is_featured: true, priority: 1 }),
      item(2, { is_featured: true, priority: 8 }),
      item(3, { is_featured: true, priority: 8, published_at: "2026-08-01" }),
    ]);
    expect(sections.featured.map((news) => news.id)).toEqual([3, 2, 1]);
  });

  it("returns empty ordinary/important/featured sections when there is no matching item", () => {
    const sections = partitionNews([item(1, {})]);
    expect(sections.featured).toEqual([]);
    expect(sections.important).toEqual([]);
    expect(sections.ordinary.map((news) => news.id)).toEqual([1]);
  });
});
