"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function PanoramaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12s1.2 6.5 3.6 9" />
      <path d="m17.5 8.5 2.5 2.4-2.5 2.4M6.5 15.5 4 13.1l2.5-2.4" />
    </svg>
  );
}

export function HomeVirtualTourSection() {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    router.prefetch("/virtual-tour");
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [router]);

  const enterTour = () => {
    if (opening) return;
    setOpening(true);
    timeoutRef.current = window.setTimeout(() => router.push("/virtual-tour"), 820);
  };

  return (
    <div
      data-opening={opening}
      className="besat-tour-entry group relative isolate min-h-[520px] w-full overflow-hidden bg-[#06182d] text-white sm:min-h-[560px] lg:min-h-[600px]"
    >
      <img
        src="/images/official/units/unit-05.jpg"
        alt="فضای آموزشی مجتمع بعثت"
        className="besat-tour-backdrop absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,16,31,.72),rgba(5,27,49,.4),rgba(3,16,31,.76))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,178,94,.18),transparent_32%),linear-gradient(180deg,rgba(4,18,34,.42),transparent_48%,rgba(4,18,34,.58))]" />

      <div className="besat-tour-shutter besat-tour-shutter-top" aria-hidden="true">
        <span className="besat-tour-shutter-handle" />
      </div>
      <div className="besat-tour-shutter besat-tour-shutter-bottom" aria-hidden="true">
        <span className="besat-tour-shutter-handle" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[520px] w-full max-w-[1100px] flex-col items-center justify-center px-5 py-28 text-center sm:min-h-[560px] lg:min-h-[600px]">
        <span className="besat-tour-orbit relative flex size-24 items-center justify-center rounded-full border border-white/45 bg-[#06182d]/58 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-md sm:size-28">
          <span className="absolute inset-2 rounded-full border border-dashed border-[#f0c77e]/55" />
          <span className="text-2xl font-black sm:text-3xl" dir="ltr">360°</span>
        </span>
        <p className="mt-7 flex items-center gap-3 text-xs font-black text-[#f0c77e] sm:text-sm">
          <span className="h-px w-8 bg-[#f0c77e]" />
          یک قدم تا حضور در بعثت
          <span className="h-px w-8 bg-[#f0c77e]" />
        </p>
        <h2 className="mt-3 text-3xl font-black leading-[1.55] sm:text-4xl lg:text-[2.75rem]">تور مجازی واحدها و دپارتمان‌های بعثت</h2>
        <p className="mt-4 max-w-2xl text-sm font-bold leading-8 text-white/78 sm:text-base sm:leading-9">
          وارد لابی مجازی شوید، درِ فضای موردنظر را انتخاب کنید و مسیر بازدید همان واحد یا دپارتمان را ادامه دهید.
        </p>
        <button
          type="button"
          onClick={enterTour}
          disabled={opening}
          className="mt-7 inline-flex h-13 min-w-[190px] items-center justify-center gap-2.5 rounded-xl bg-[#e2ae5b] px-7 text-sm font-black text-[#09223d] shadow-[0_18px_40px_rgba(226,174,91,.25)] transition-all duration-500 hover:-translate-y-1 hover:scale-[1.025] hover:bg-[#f0c77e] disabled:cursor-wait"
        >
          <PanoramaIcon />
          {opening ? "در حال ورود..." : "ورود به تور مجازی"}
        </button>
      </div>

      <div className="absolute bottom-7 left-7 z-10 hidden items-center gap-2 text-[11px] font-bold text-white/58 sm:flex" dir="ltr">
        <span className="size-1.5 animate-pulse rounded-full bg-[#e2ae5b]" />
        INTERACTIVE 360 EXPERIENCE
      </div>
    </div>
  );
}
