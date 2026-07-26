"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DepartmentRecord } from "@/lib/data/domain-types";
import { departmentsRepository } from "@/lib/data/repositories";

const fallbackImages = [
  "/images/official/hero/besat-hs-banner-03.jpg",
  "/images/official/units/unit-03.jpg",
  "/images/official/units/unit-05.jpg",
];

export function HomeDepartmentsSection() {
  const [departments, setDepartments] = useState<DepartmentRecord[] | null>(null);

  useEffect(() => {
    let mounted = true;
    departmentsRepository
      .list()
      .then((items) => {
        if (!mounted) return;
        setDepartments(items.filter((item) => item.is_active).sort((a, b) => a.order - b.order).slice(0, 5));
      })
      .catch(() => setDepartments([]));
    return () => {
      mounted = false;
    };
  }, []);

  if (departments === null) {
    return (
      <section className="min-h-[20rem] bg-white px-5 py-16 sm:px-8" aria-hidden="true">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mb-7 h-9 w-64 animate-pulse rounded-full bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-48 animate-pulse rounded-[1.15rem] bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (departments.length === 0) return null;

  return (
    <section dir="rtl" className="bg-white px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-7 flex items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-3 text-xs font-black text-[#c98c3d]">
              <span className="h-px w-8 bg-[#c98c3d]" />
              آموزش فراتر از کلاس درس
            </p>
            <h2 className="text-2xl font-black text-[#0a2848] sm:text-3xl">دپارتمان‌های تخصصی بعثت</h2>
          </div>
          <Link href="/departments" className="hidden items-center gap-2 text-xs font-black text-[#0a2848] transition hover:text-[#c98c3d] sm:inline-flex">
            مشاهده همه
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {departments.map((department, index) => (
            <Link
              key={department.id}
              data-stagger-item
              style={{ animationDelay: `${index * 85}ms` }}
              href="/departments"
              className="group grid min-h-[145px] grid-cols-[0.92fr_1.08fr] overflow-hidden rounded-[1.15rem] border border-[#e2e5e8] bg-white shadow-[0_10px_26px_rgba(8,30,55,0.055)] transition duration-300 hover:-translate-y-1 hover:border-[#d8aa65]/50 hover:shadow-[0_18px_36px_rgba(8,30,55,0.1)] sm:min-h-[165px] lg:grid-cols-1 lg:grid-rows-[105px_1fr]"
            >
              <div className="relative overflow-hidden">
                <img
                  src={department.cover_image || fallbackImages[index % fallbackImages.length]}
                  alt={department.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071b31]/28 to-transparent" />
              </div>
              <div className="flex flex-col justify-center p-4 text-right">
                <h3 className="text-sm font-black leading-6 text-[#0a2848]">{department.title}</h3>
                <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500 line-clamp-2">
                  {department.description || "برنامه‌های تخصصی و مهارت‌محور مجتمع بعثت"}
                </p>
                <span className="mt-3 text-[10px] font-black text-[#c98c3d]">بیشتر ←</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
