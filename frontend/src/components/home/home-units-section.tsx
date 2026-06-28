"use client";

import { useEffect, useState } from "react";
import { HomeUnitsCarousel } from "@/components/home/home-units-carousel";
import { unitsRepository } from "@/lib/data/repositories";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";

export function HomeUnitsSection() {
  const [units, setUnits] = useState<SchoolUnitRecord[] | null>(null);

  useEffect(() => {
    unitsRepository.list().then((all) => {
      const active = all
        .filter((u) => u.is_active)
        .sort((a, b) => a.order - b.order);
      setUnits(active);
    });
  }, []);

  if (units === null) {
    // در حال بارگذاری — فضای رزرو برای جلوگیری از پرش layout
    return <div className="bg-white py-16" />;
  }

  if (units.length === 0) return null;

  return <HomeUnitsCarousel units={units} />;
}
