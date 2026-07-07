import Link from "next/link";

type PublicContentTabsProps = {
  active: "news";
};

const tabs = [
  { key: "news", label: "اخبار", href: "/news" },
] as const;

export function PublicContentTabs({ active }: PublicContentTabsProps) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm">
      <nav className="grid gap-2 sm:grid-cols-2">
        {tabs.map((tab) => {
          const isActive = tab.key === active;

          return (
            <Link
              key={tab.key}
              href={tab.href}
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
