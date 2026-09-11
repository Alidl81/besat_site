"use client";

import { useEffect, useState } from "react";
import { CircularExplorer } from "@/components/circular/circular-explorer";
import type { CircularItem } from "@/components/circular/circular-selector";
import { PublicUnitsDirectory } from "@/components/units/public-units-directory";
import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";
import type { PublicSchoolUnit } from "@/types/public-content";
import {
  getPublicDepartments,
  getPublicUnits,
} from "@/services/public-content-service";

type ExplorerSectionProps = {
  variant: "unit" | "department";
  initialSlug?: string | null;
};

export function UnitsExplorerSection({ variant, initialSlug }: ExplorerSectionProps) {
  const [items, setItems] = useState<CircularItem[] | null>(null);
  const [units, setUnits] = useState<PublicSchoolUnit[] | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});
  // FE-UNITS-EXPLORER-LOAD-ERROR-001: `.catch(() => setItems([]))`
  // collapsed a genuine load failure (a 503, a network drop) into the
  // exact same "nothing to show" empty state as a catalog that
  // legitimately has zero units/departments -- a live probe found a
  // forced-503 outage rendered the normal empty-catalog text with no
  // alert and no retry button, silently telling a visitor there simply
  // is nothing here instead of that the page failed to load. Tracked
  // separately from `items` so the two states can no longer collapse
  // into each other.
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    const request =
      variant === "unit" ? getPublicUnits() : getPublicDepartments();

    // react-hooks/set-state-in-effect forbids a setState call directly in
    // the effect body -- deferring this reset behind its own microtask
    // (kept independent of the data-fetch chain below, since TypeScript
    // can't chain a further `.then()` off a union of two differently-
    // typed promises -- getPublicUnits()/getPublicDepartments() resolve
    // to different element types) satisfies the rule without changing
    // behavior.
    Promise.resolve().then(() => {
      if (active) setLoadError(false);
    });

    request.then((items) => {
      if (!active) return;
      const descs: Record<string, string | null> = {};

      items.forEach((x) => {
        descs[String(x.id)] = x.description;
      });

      setDescriptions(descs);
      if (variant === "unit") {
        setUnits(items as PublicSchoolUnit[]);
      } else {
        setUnits(null);
      }
      setItems(
        items.map((x) => ({
          id: String(x.id),
          title: variant === "unit" ? getOfficialUnitShortTitle(x) : x.title,
          slug: x.slug,
        })),
      );
    }).catch(() => {
      if (active) setLoadError(true);
    });

    return () => {
      active = false;
    };
  }, [variant, retryToken]);

  if (loadError) {
    return (
      <section className="bg-[#f8fafc] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="rounded-[2rem] border border-dashed border-rose-200 bg-white p-10 shadow-sm">
            <p role="alert" className="text-sm font-bold leading-8 text-rose-700">
              {variant === "unit"
                ? "بارگذاری واحدهای آموزشی با خطا مواجه شد."
                : "بارگذاری بخش‌ها با خطا مواجه شد."}
            </p>
            <button
              type="button"
              onClick={() => setRetryToken((token) => token + 1)}
              className="besat-accent-button mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-black"
            >
              تلاش دوباره
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (items === null) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center bg-[#f8fafc]">
        <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="bg-[#f8fafc] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">
              ○
            </div>
            <p className="text-sm font-bold leading-8 text-slate-500">
              موردی برای نمایش وجود ندارد.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "unit") {
    return (
      <PublicUnitsDirectory
        units={units ?? []}
        initialSlug={initialSlug}
      />
    );
  }

  return (
    <CircularExplorer
      items={items}
      descriptions={descriptions}
      variant={variant}
      initialSlug={initialSlug}
    />
  );
}
