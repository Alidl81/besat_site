"use client";

import { Clock3, Mail, MapPin, Phone, RefreshCw, School } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { UnitRegistrationCta } from "@/components/units/unit-registration-cta";
import { UnitScopedTabs } from "@/components/units/unit-scoped-tabs";
import { ApiError, getApiErrorMessage } from "@/lib/api/client";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import { getPublicUnit } from "@/services/public-content-service";
import type { PublicSchoolUnit } from "@/types/public-content";

export function UnitOverview({ slug }: { slug: string }) {
  const [unit, setUnit] = useState<PublicSchoolUnit | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPublicUnit(slug)
      .then((response) => {
        if (!cancelled) {
          setError("");
          setNotFound(false);
          setUnit(response);
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 404) setNotFound(true);
        else setError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, version]);

  if (error || notFound) {
    return (
      <PublicPageLayout>
        <main className="bg-slate-50 py-20">
          <Container>
            <div role={error ? "alert" : undefined} className="rounded-lg border border-slate-200 bg-white p-10 text-center">
              <School aria-hidden="true" className="mx-auto size-10 text-slate-400" />
              <h1 className="mt-4 text-2xl font-black text-[#0f2f4a]">
                {notFound ? "واحد آموزشی پیدا نشد" : "دریافت اطلاعات واحد انجام نشد"}
              </h1>
              {error ? <p className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
              {error ? (
                <button type="button" onClick={() => {
                  setUnit(null);
                  setError("");
                  setNotFound(false);
                  setVersion((value) => value + 1);
                }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white">
                  <RefreshCw aria-hidden="true" className="size-4" />
                  تلاش دوباره
                </button>
              ) : null}
            </div>
          </Container>
        </main>
      </PublicPageLayout>
    );
  }

  if (!unit) {
    return (
      <PublicPageLayout>
        <main aria-busy="true" className="min-h-[32rem] animate-pulse bg-slate-100 motion-reduce:animate-none" />
      </PublicPageLayout>
    );
  }

  const image = safePublicMediaUrl(unit.cover_image);
  return (
    <PublicPageLayout>
      <header className="border-b border-slate-200 bg-white">
        <Container className="grid items-center gap-8 py-14 md:py-20 lg:grid-cols-[1fr_0.8fr]">
          <div className="text-right">
            <p className="mb-4 text-sm font-black text-blue-700">واحد آموزشی</p>
            <h1 className="text-3xl font-black leading-[1.4] text-[#0f2f4a] md:text-5xl">{unit.title}</h1>
            {unit.subtitle ? <p className="mt-4 text-lg font-black text-slate-600">{unit.subtitle}</p> : null}
            {unit.description ? <p className="mt-5 text-base font-bold leading-9 text-slate-600">{unit.description}</p> : null}
          </div>
          {image ? (
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
              <img src={image} alt="" loading="eager" className="size-full object-cover" />
            </div>
          ) : null}
        </Container>
      </header>

      <main className="bg-slate-50 py-8">
        <Container className="space-y-8">
          <UnitScopedTabs slug={slug} active="overview" />
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {unit.grade_range ? <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-black text-slate-500">پایه‌های تحصیلی</p><p className="mt-2 text-sm font-black text-[#0f2f4a]">{unit.grade_range}</p></div> : null}
            {unit.age_range ? <div className="rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs font-black text-slate-500">بازه سنی</p><p className="mt-2 text-sm font-black text-[#0f2f4a]">{unit.age_range}</p></div> : null}
            {unit.address ? <div className="rounded-lg border border-slate-200 bg-white p-5"><MapPin aria-hidden="true" className="size-5 text-blue-700" /><p className="mt-2 text-sm font-black leading-7 text-[#0f2f4a]">{unit.address}</p></div> : null}
            {unit.phone ? <a href={`tel:${unit.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-slate-200 bg-white p-5"><Phone aria-hidden="true" className="size-5 text-blue-700" /><p dir="ltr" className="mt-2 text-left text-sm font-black text-[#0f2f4a]">{unit.phone}</p></a> : null}
            {unit.email ? <a href={`mailto:${unit.email}`} className="rounded-lg border border-slate-200 bg-white p-5"><Mail aria-hidden="true" className="size-5 text-blue-700" /><p dir="ltr" className="mt-2 text-left text-sm font-black text-[#0f2f4a]">{unit.email}</p></a> : null}
            {unit.office_hours ? <div className="rounded-lg border border-slate-200 bg-white p-5"><Clock3 aria-hidden="true" className="size-5 text-blue-700" /><p className="mt-2 text-sm font-black text-[#0f2f4a]">{unit.office_hours}</p></div> : null}
          </section>
          <UnitRegistrationCta unit={unit} />
        </Container>
      </main>
    </PublicPageLayout>
  );
}
