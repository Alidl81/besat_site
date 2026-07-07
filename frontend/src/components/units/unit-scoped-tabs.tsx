import Link from "next/link";

type UnitScopedTabsProps = {
  slug: string;
  active: "overview" | "news" | "gallery";
};

const tabs = [
  { key: "overview", label: "معرفی واحد", href: "" },
  { key: "news", label: "اخبار واحد", href: "/news" },
  { key: "gallery", label: "گالری واحد", href: "/gallery" },
] as const;

export function UnitScopedTabs({ slug, active }: UnitScopedTabsProps) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm">
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;

          return (
            <Link
              key={tab.key}
              href={`/units/${slug}${tab.href}`}
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
