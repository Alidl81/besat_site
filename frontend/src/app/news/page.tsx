import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { EmptyState } from "@/components/page/empty-state";
import { PageHero } from "@/components/page/page-hero";
import { getNews, type NewsItem, type PaginatedResponse } from "@/lib/api/public-api";

export const metadata: Metadata = {
  title: "اخبار | مدرسه بعثت",
};

function normalizeNewsResponse(
  response: NewsItem[] | PaginatedResponse<NewsItem>,
): NewsItem[] {
  return Array.isArray(response) ? response : response.results;
}

async function loadNews(): Promise<NewsItem[]> {
  try {
    const response = await getNews();
    return normalizeNewsResponse(response);
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return "";
  }
}

export default async function NewsPage() {
  const newsItems = await loadNews();

  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="اخبار"
        title="اخبار مدرسه بعثت"
        description="آخرین خبرهای منتشرشده مدرسه در این بخش نمایش داده می‌شود."
      />

      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {newsItems.length === 0 ? (
            <EmptyState title="خبری برای نمایش وجود ندارد." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {newsItems.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-right shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
                >
                  {item.image ? (
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-[#143e61]/10 via-[#0d3157]/5 to-emerald-50" />
                  )}

                  <div className="p-5">
                    {item.category ? (
                      <span className="mb-3 inline-block rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        {item.category.title}
                      </span>
                    ) : null}

                    <h2 className="text-base font-black leading-[1.7] text-[#062452] line-clamp-2">
                      {item.title}
                    </h2>

                    {item.summary ? (
                      <p className="mt-2 text-sm font-bold leading-7 text-slate-500 line-clamp-2">
                        {item.summary}
                      </p>
                    ) : null}

                    {item.published_at ? (
                      <p className="mt-4 text-xs font-black text-slate-400">
                        {formatDate(item.published_at)}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}
