import Link from "next/link";

type UnitScopedTabsProps = {
  slug: string;
  active: "overview" | "news" | "achievements" | "gallery";
};

const tabs = [
  { key: "overview", label: "معرفی واحد", tab: "overview" },
  { key: "news", label: "اخبار واحد", tab: "news" },
  { key: "achievements", label: "افتخارات واحد", tab: "achievements" },
  { key: "gallery", label: "گالری واحد", tab: "gallery" },
] as const;

export function UnitScopedTabs({ slug, active }: UnitScopedTabsProps) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm">
      <nav aria-label="ناوبری واحد" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;

          return (
            <Link
              key={tab.key}
              href={`/units?unit=${encodeURIComponent(slug)}${tab.tab === "overview" ? "" : `&tab=${tab.tab}`}`}
              className={`besat-tab-link rounded-2xl px-4 py-3 text-center text-sm font-black ${
                isActive ? "besat-tab-link-active" : ""
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
