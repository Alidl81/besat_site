"use client";

import { useEffect, useMemo, useState } from "react";
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

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-5 transition-transform duration-300 ease-out ${
        isOpen ? "rotate-180" : "rotate-0"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function RegistrationUnitSelector({
  units,
  selectedUnitId,
  onSelect,
  display = "all",
}: RegistrationUnitSelectorProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const activeUnits = useMemo(() => {
    const sourceUnits = units ?? [];
    const seenTitles = new Set<string>();

    return sourceUnits.filter((unit) => {
      const title = getOfficialUnitShortTitle(unit);

      if (seenTitles.has(title)) {
        return false;
      }

      seenTitles.add(title);
      return true;
    });
  }, [units]);

  const selectedUnit = useMemo(
    () => activeUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [activeUnits, selectedUnitId],
  );

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

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMobileOpen((current) => !current)}
                aria-expanded={isMobileOpen}
                className={`relative flex h-[3.7rem] w-full items-center justify-between rounded-2xl border bg-white px-4 pl-14 pr-4 text-right text-sm font-black text-[#062452] outline-none transition-all duration-300 ease-out ${
                  isMobileOpen
                    ? "border-emerald-400 shadow-[0_14px_35px_rgba(16,185,129,0.14)]"
                    : "border-slate-200 shadow-sm"
                }`}
              >
                <span>
                  {selectedUnit
                    ? getOfficialUnitShortTitle(selectedUnit)
                    : "واحد را انتخاب کنید"}
                </span>

                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#062452]">
                  <ChevronIcon isOpen={isMobileOpen} />
                </span>
              </button>

              <div
                className={`mt-2 overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-out ${
                  isMobileOpen
                    ? "max-h-[24rem] translate-y-0 border-slate-200 opacity-100 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                    : "max-h-0 translate-y-1 border-transparent opacity-0 shadow-none"
                }`}
              >
                <div className="max-h-[22rem] overflow-y-auto overscroll-contain py-2">
                  {activeUnits.map((unit) => {
                    const isActive = unit.id === selectedUnitId;
                    const title = getOfficialUnitShortTitle(unit);

                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => {
                          onSelect(unit.id);
                          setIsMobileOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-4 py-3 text-right text-sm font-black transition duration-200 ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-[#062452] hover:bg-slate-50"
                        }`}
                      >
                        <span>{title}</span>

                        {isActive ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.65rem] font-black text-emerald-700">
                            انتخاب شده
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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
