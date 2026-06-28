"use client";

import { useEffect, useState } from "react";
import { CircularExplorer } from "@/components/circular/circular-explorer";
import type { CircularItem } from "@/components/circular/circular-selector";
import { departmentsRepository, unitsRepository } from "@/lib/data/repositories";

type ExplorerSectionProps = {
  variant: "unit" | "department";
};

export function UnitsExplorerSection({ variant }: ExplorerSectionProps) {
  const [items, setItems] = useState<CircularItem[] | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const repo = variant === "unit" ? unitsRepository : departmentsRepository;
    repo.list().then((all) => {
      const active = all
        .filter((x) => x.is_active)
        .sort((a, b) => a.order - b.order);

      const descs: Record<string, string | null> = {};
      active.forEach((x) => { descs[x.id] = x.description; });
      setDescriptions(descs);
      setItems(active.map((x) => ({ id: x.id, title: x.title, slug: x.slug })));
    });
  }, [variant]);

  if (items === null) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center bg-[#f8fafc]">
        <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="bg-[#f8fafc] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">◌</div>
            <p className="text-sm font-bold leading-8 text-slate-500">موردی برای نمایش وجود ندارد.</p>
          </div>
        </div>
      </section>
    );
  }

  return <CircularExplorer items={items} descriptions={descriptions} variant={variant} />;
}
