import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import type { PublicSchoolUnit } from "@/types/public-content";

export function UnitRegistrationCta({ unit }: { unit: PublicSchoolUnit }) {
  return (
    <section className="border-y border-slate-200 bg-white py-8 text-right">
      <h2 className="text-2xl font-black text-[#0f2f4a]">پیش‌ثبت‌نام {unit.title}</h2>
      <p className="mt-3 max-w-2xl text-sm font-bold leading-8 text-slate-600">
        درخواست پیش‌ثبت‌نام با شناسه همین واحد ثبت و در پنل مسئول واحد پیگیری می‌شود.
      </p>
      {unit.accepts_registration ? (
        <Link
          href={`/registration?unit=${encodeURIComponent(unit.slug)}`}
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#12395b] px-6 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        >
          شروع پیش‌ثبت‌نام
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <p role="status" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-5 text-sm font-black text-amber-900">
          <LockKeyhole aria-hidden="true" className="size-4" />
          پیش‌ثبت‌نام این واحد بسته است
        </p>
      )}
    </section>
  );
}

