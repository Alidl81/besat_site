import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { EmptyState } from "@/components/page/empty-state";
import { PageHero } from "@/components/page/page-hero";
import {
  getAnnouncements,
  type AnnouncementItem,
  type PaginatedResponse,
} from "@/lib/api/public-api";

export const metadata: Metadata = {
  title: "اطلاعیه‌ها | مدرسه بعثت",
};

function normalizeAnnouncementsResponse(
  response: AnnouncementItem[] | PaginatedResponse<AnnouncementItem>,
): AnnouncementItem[] {
  return Array.isArray(response) ? response : response.results;
}

async function loadAnnouncements(): Promise<AnnouncementItem[]> {
  try {
    const response = await getAnnouncements();
    return normalizeAnnouncementsResponse(response);
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

export default async function AnnouncementsPage() {
  const announcements = await loadAnnouncements();

  return (
    <PublicPageLayout>
      <PageHero
        eyebrow="اطلاعیه‌ها"
        title="اطلاعیه‌های مدرسه بعثت"
        description="اطلاعیه‌های منتشرشده مدرسه در این بخش نمایش داده می‌شود."
      />

      <section className="bg-[#f8fafc] py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {announcements.length === 0 ? (
            <EmptyState title="اطلاعیه‌ای برای نمایش وجود ندارد." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {announcements.map((item) => (
                <article
                  key={item.id}
                  className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 text-right shadow-sm transition duration-500 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_45px_rgba(15,23,42,0.10)]"
                >
                  <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    📢
                  </div>

                  <h2 className="text-base font-black leading-[1.7] text-[#062452]">
                    {item.title}
                  </h2>

                  {item.summary ? (
                    <p className="mt-3 text-sm font-bold leading-7 text-slate-500 line-clamp-3">
                      {item.summary}
                    </p>
                  ) : null}

                  {item.published_at ? (
                    <p className="mt-4 text-xs font-black text-slate-400">
                      {formatDate(item.published_at)}
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
