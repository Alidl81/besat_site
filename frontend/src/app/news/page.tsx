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
  if (Array.isArray(response)) {
    return response;
  }

  return response.results;
}

async function loadNews() {
  try {
    const response = await getNews();
    return normalizeNewsResponse(response);
  } catch {
    return [];
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
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-right shadow-[0_16px_45px_rgba(15,23,42,0.06)]"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="mb-4 h-48 w-full rounded-[1.25rem] object-cover"
                    />
                  ) : null}

                  <h2 className="text-lg font-black leading-8 text-[#062452]">
                    {item.title}
                  </h2>

                  {item.summary ? (
                    <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
                      {item.summary}
                    </p>
                  ) : null}

                  {item.published_at ? (
                    <p className="mt-4 text-xs font-black text-slate-400">
                      {new Intl.DateTimeFormat("fa-IR").format(
                        new Date(item.published_at),
                      )}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}
