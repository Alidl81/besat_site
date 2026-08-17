"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PanoramaViewer } from "@/components/virtual-tour/panorama-viewer";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import {
  getPublicDepartments,
  getPublicUnits,
} from "@/services/public-content-service";
import { getPublicTourDoorScenes } from "@/services/virtual-tour-service";
import type {
  PublicDepartment,
  PublicSchoolUnit,
} from "@/types/public-content";
import type { TourSceneDetail } from "@/types/virtual-tour";

type Wing = "lobby" | "units" | "departments";

type Destination = {
  id: string;
  type: "unit" | "department";
  title: string;
  slug: string;
  description: string;
  preview: string;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function Door({ destination, onOpen, index }: { destination: Destination; onOpen: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${index * 55}ms` }}
      className="besat-lobby-door group relative mx-auto w-full max-w-[220px] text-right text-white"
    >
      <span className="besat-lobby-door-frame block rounded-t-[1.3rem] border border-[#d7b77d]/55 bg-[linear-gradient(135deg,#77572d,#d4ac6b_40%,#6b4b28)] p-2 shadow-[0_25px_50px_rgba(0,0,0,.32)]">
        <span className="besat-lobby-door-leaf relative block aspect-[.72] overflow-hidden rounded-t-[.95rem] border border-[#efd39c]/35 bg-[#102a43]">
          <img src={destination.preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-72 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-95" draggable={false} />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,20,36,.12),rgba(5,20,36,.52)_58%,rgba(5,20,36,.96))]" />
          <span className="absolute inset-x-3 top-3 rounded-md border border-white/18 bg-[#06182d]/62 px-2 py-1.5 text-center text-[10px] font-black backdrop-blur-sm">
            {destination.type === "unit" ? "واحد آموزشی" : "دپارتمان تخصصی"}
          </span>
          <span className="absolute inset-x-4 bottom-6 text-center">
            <strong className="block text-sm font-black leading-7 sm:text-base">{destination.title}</strong>
            <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-[#f2cf8d]">ورود به فضا <ArrowIcon /></span>
          </span>
          <span className="absolute bottom-1/2 left-3 size-2.5 rounded-full border border-[#6b451f] bg-[#f2c978] shadow-[0_0_12px_rgba(242,201,120,.7)]" />
        </span>
      </span>
      <span className="mx-auto block h-2 w-[115%] -translate-x-[6.5%] rounded-[50%] bg-black/35 blur-sm transition duration-500 group-hover:scale-x-90" />
    </button>
  );
}

function WingDoor({
  label,
  eyebrow,
  image,
  onOpen,
}: {
  label: string;
  eyebrow: string;
  image: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="group relative mx-auto w-full max-w-[330px] text-white">
      <span className="block rounded-t-[2rem] border border-[#e5c78f]/50 bg-[linear-gradient(135deg,#5e4325,#d0a663_45%,#5c4023)] p-3 shadow-[0_35px_80px_rgba(0,0,0,.38)]">
        <span className="relative block aspect-[.82] overflow-hidden rounded-t-[1.45rem] border border-white/18 bg-[#0a2540]">
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-72 transition duration-1000 group-hover:scale-110 group-hover:opacity-92" draggable={false} />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,18,34,.06),rgba(4,18,34,.88))]" />
          <span className="absolute inset-x-5 bottom-10 text-center">
            <span className="text-xs font-black text-[#f1c97f]">{eyebrow}</span>
            <strong className="mt-2 block text-2xl font-black sm:text-3xl">{label}</strong>
            <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-white/22 bg-white/10 px-4 text-[11px] font-black backdrop-blur-md">باز کردن در <ArrowIcon /></span>
          </span>
          <span className="absolute bottom-1/2 left-4 size-3 rounded-full border border-[#6b451f] bg-[#f2c978] shadow-[0_0_16px_rgba(242,201,120,.85)]" />
        </span>
      </span>
      <span className="mx-auto block h-3 w-[112%] -translate-x-[5.5%] rounded-[50%] bg-black/38 blur-md transition duration-500 group-hover:scale-x-90" />
    </button>
  );
}

export function VirtualTourLobby() {
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [wing, setWing] = useState<Wing>("lobby");
  const [selected, setSelected] = useState<Destination | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<TourSceneDetail[] | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getPublicUnits(), getPublicDepartments()])
      .then(([unitRecords, departmentRecords]) => {
        if (!mounted) return;
        setUnits(unitRecords);
        setDepartments(departmentRecords);
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    Promise.resolve()
      .then(() => {
        if (mounted) setLoadingScenes(true);
        return getPublicTourDoorScenes(selected.type, selected.slug);
      })
      .then((scenes) => {
        if (mounted) setSelectedScenes(scenes);
      })
      .catch(() => {
        if (mounted) setSelectedScenes([]);
      })
      .finally(() => {
        if (mounted) setLoadingScenes(false);
      });
    return () => { mounted = false; };
  }, [selected]);

  const unitDestinations = useMemo<Destination[]>(() => units.filter((unit) => unit.cover_image).map((unit) => ({
    id: String(unit.id),
    type: "unit",
    title: unit.title,
    slug: unit.slug,
    description: unit.description ?? "",
    preview: unit.cover_image as string,
  })), [units]);

  const departmentDestinations = useMemo<Destination[]>(() => departments.filter((department) => department.cover_image).map((department) => ({
    id: String(department.id),
    type: "department",
    title: department.title,
    slug: department.slug,
    description: department.description ?? "",
    preview: department.cover_image as string,
  })), [departments]);

  const destinations = wing === "units" ? unitDestinations : departmentDestinations;

  if (selected) {
    return (
      <main dir="rtl" className="min-h-dvh bg-[#06182d] text-white">
        <div className="relative min-h-dvh">
          {loadingScenes ? (
            <div className="flex min-h-dvh items-center justify-center bg-[#06182d] text-white">
              <span className="mx-auto block size-11 animate-spin rounded-full border-2 border-white/20 border-t-[#e2ae5b]" />
            </div>
          ) : selectedScenes && selectedScenes.length > 0 ? (
            <PanoramaViewer scenes={selectedScenes} title={selected.title} />
          ) : (
            <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-24 text-center">
              <img src={selected.preview} alt={selected.title} className="besat-tour-preview-drift absolute inset-0 h-full w-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,18,34,.55),rgba(4,18,34,.82))]" />
              <div className="relative z-10 max-w-xl rounded-[2rem] border border-white/14 bg-[#06182d]/72 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
                <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-[#e2ae5b]/45 bg-[#e2ae5b]/12 text-xl font-black text-[#efc675]" dir="ltr">360°</span>
                <p className="mt-6 text-xs font-black text-[#efc675]">زیرساخت این صحنه آماده است</p>
                <h1 className="mt-2 text-3xl font-black">{selected.title}</h1>
                <p className="mt-4 text-sm font-bold leading-8 text-white/72">{selected.description}</p>
                <div className="mt-6 rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs font-bold leading-7 text-white/72">
                  برای فعال‌شدن نمای تعاملی واقعی، تصویر پانورامای ۲:۱ این فضا باید به پروژه اضافه شود.
                </div>
              </div>
            </div>
          )}
          <button type="button" onClick={() => setSelected(null)} className="fixed right-5 top-5 z-50 inline-flex h-11 items-center gap-2 rounded-xl border border-white/16 bg-[#06182d]/76 px-4 text-xs font-black text-white shadow-xl backdrop-blur-xl transition hover:bg-[#143c63] sm:right-8 sm:top-8">
            <CloseIcon /> بازگشت به درها
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="besat-tour-room relative min-h-dvh overflow-hidden bg-[#071b31] text-white">
      <div className="besat-tour-room-ceiling absolute inset-x-0 top-0 h-[28%]" />
      <div className="besat-tour-room-floor absolute inset-x-0 bottom-0 h-[48%]" />
      <div className="absolute inset-y-0 left-0 w-[22%] bg-[linear-gradient(90deg,rgba(2,11,22,.78),transparent)]" />
      <div className="absolute inset-y-0 right-0 w-[22%] bg-[linear-gradient(270deg,rgba(2,11,22,.78),transparent)]" />
      <div className="absolute left-1/2 top-[17%] h-px w-[72%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(226,174,91,.55),transparent)]" />

      <header className="relative z-20 mx-auto flex w-full max-w-[1500px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/14 bg-white/[.07] px-4 text-xs font-black backdrop-blur-xl transition hover:bg-white/12">
          <ArrowIcon /> بازگشت به سایت
        </Link>
        <div className="flex items-center gap-3 text-right">
          <BesatLogoMark size="sm" tone="light" className="!h-14 !w-14" />
          <span className="hidden sm:block">
            <strong className="block text-sm font-black">تور مجازی بعثت</strong>
            <span className="mt-1 block text-[9px] font-bold text-white/55">لابی واحدها و دپارتمان‌ها</span>
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-86px)] w-full max-w-[1450px] flex-col px-5 pb-10 sm:px-8">
        {wing === "lobby" ? (
          <section className="besat-room-content flex flex-1 flex-col items-center justify-center py-8">
            <p className="text-xs font-black text-[#efc675] sm:text-sm">به لابی مجازی مجتمع بعثت خوش آمدید</p>
            <h1 className="mt-3 text-center text-3xl font-black leading-[1.5] sm:text-4xl lg:text-5xl">کدام مسیر را می‌خواهید ببینید؟</h1>
            <p className="mt-3 max-w-xl text-center text-sm font-bold leading-8 text-white/62">یکی از دو در اصلی را باز کنید؛ در مرحله بعد تمام فضاهای همان بخش روبه‌روی شما قرار می‌گیرند.</p>
            <div className="mt-9 grid w-full max-w-[790px] grid-cols-2 items-end gap-5 sm:gap-12">
              <WingDoor label="واحدهای آموزشی" eyebrow={`${unitDestinations.length || 12} فضای آموزشی`} image="/images/official/units/unit-07.jpg" onOpen={() => setWing("units")} />
              <WingDoor label="دپارتمان‌ها" eyebrow={`${departmentDestinations.length || 5} فضای تخصصی`} image="/images/official/units/unit-06.jpg" onOpen={() => setWing("departments")} />
            </div>
          </section>
        ) : (
          <section key={wing} className="besat-room-content flex flex-1 flex-col py-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black text-[#efc675]">راهروی انتخاب فضا</p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">{wing === "units" ? "واحدهای آموزشی بعثت" : "دپارتمان‌های تخصصی بعثت"}</h1>
              </div>
              <button type="button" onClick={() => setWing("lobby")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.07] px-4 text-xs font-black backdrop-blur-md transition hover:bg-white/13">
                <ArrowIcon /> بازگشت به لابی
              </button>
            </div>

            <div className="besat-door-gallery mt-8 grid flex-1 grid-cols-2 items-end gap-x-4 gap-y-8 overflow-y-auto pb-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-6">
              {destinations.map((destination, index) => (
                <Door key={destination.id} destination={destination} index={index} onOpen={() => setSelected(destination)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
