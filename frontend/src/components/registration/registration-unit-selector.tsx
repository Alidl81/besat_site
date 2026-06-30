"use client";

import { useEffect, useMemo } from "react";
import {
  CircularSelector,
  type CircularItem,
} from "@/components/circular/circular-selector";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";
import { getOfficialUnitShortTitle } from "@/lib/units/unit-display";

type RegistrationUnitSelectorProps = {
  units: SchoolUnitRecord[] | null;
  selectedUnitId: string;
  onSelect: (unitId: string) => void;
  display?: "all" | "desktop" | "mobile";
};

export function RegistrationUnitSelector({
  units,
  selectedUnitId,
  onSelect,
  display = "all",
}: RegistrationUnitSelectorProps) {
  const activeUnits = useMemo(() => units ?? [], [units]);

  const circularItems: CircularItem[] = useMemo(
    () =>
      activeUnits.map((unit) => ({
        id: unit.id,
        title: getOfficialUnitShortTitle(unit),
        slug: unit.slug,
      })),
    [activeUnits],
  );

  useEffect(() => {
    if (activeUnits.length === 0 || selectedUnitId) {
      return;
    }

    onSelect(activeUnits[0].id);
  }, [activeUnits, selectedUnitId, onSelect]);

  if (units === null) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-5 text-right text-sm font-black text-white/75">
        در حال دریافت واحدها...
      </div>
    );
  }

  if (activeUnits.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-5 text-right text-sm font-black text-white/75">
        موردی برای نمایش وجود ندارد.
      </div>
    );
  }

  return (
    <>
      {display !== "desktop" ? (
        <div className="lg:hidden">
          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              واحد مورد نظر
            </span>

            <select
              value={selectedUnitId}
              onChange={(event) => onSelect(event.target.value)}
              required
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            >
              <option value="">واحد را انتخاب کنید</option>
              {activeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getOfficialUnitShortTitle(unit)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {display !== "mobile" ? (
        <div className={display === "desktop" ? "block" : "hidden lg:block"}>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] px-3 py-4">
            <div className="mb-3 text-right">
              <p className="text-sm font-black text-emerald-300">
                واحد مورد نظر
              </p>
              <p className="mt-1 text-xs font-bold leading-6 text-white/70">
                واحد را از گردونه انتخاب کنید.
              </p>
            </div>

            <CircularSelector
              items={circularItems}
              activeId={selectedUnitId || activeUnits[0]?.id}
              onSelect={onSelect}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
