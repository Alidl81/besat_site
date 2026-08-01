"use client";

import { useEffect, useState } from "react";
import { HomeUnitsCarousel } from "@/components/home/home-units-carousel";
import { getPublicUnits } from "@/services/public-content-service";
import type { PublicSchoolUnit } from "@/types/public-content";

export function HomeUnitsSection() {
  const [units, setUnits] = useState<PublicSchoolUnit[] | null>(null);

  useEffect(() => {
    let active = true;
    getPublicUnits()
      .then((items) => {
        if (active) setUnits(items);
      })
      .catch(() => {
        if (active) setUnits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (units === null) {
    // در حال بارگذاری — فضای رزرو برای جلوگیری از پرش layout
    return <div className="min-h-[36rem] bg-white py-16" aria-hidden="true" />;
  }

  if (units.length === 0) return null;

  return <HomeUnitsCarousel units={units} />;
}
