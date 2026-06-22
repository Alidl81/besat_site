import Link from "next/link";
import { BesatLogoMark } from "@/components/shared/besat-logo";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-right text-sm font-black text-[#062452]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition duration-500 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

export function PreregistrationCard() {
  return (
    <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#062452] p-8 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.28),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.14),transparent_32%)]" />
        <div className="absolute bottom-0 left-0 h-40 w-72 rounded-tr-[6rem] bg-white/10" />

        <div className="relative z-10 flex h-full min-h-[34rem] flex-col">
          <div className="flex items-center gap-4">
            <BesatLogoMark size="xl" priority className="" />

            <div>
              <p className="text-xl font-black text-white">مدرسه بعثت</p>
              <p className="mt-1 text-sm font-bold text-white/65">پیش‌ثبت‌نام آنلاین</p>
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-sm font-black text-emerald-300">پیش‌ثبت‌نام</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.5] text-white">
              ثبت درخواست پیش‌ثبت‌نام
            </h1>
          </div>
        </div>
      </section>

      <section className="p-6 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
          <div className="text-right">
            <p className="text-lg font-black text-[#062452]">مدرسه بعثت</p>
            <p className="mt-1 text-xs font-bold text-slate-500">پیش‌ثبت‌نام آنلاین</p>
          </div>

          <BesatLogoMark size="lg" priority className="bg-white ring-slate-200" />
        </div>

        <div className="text-right">
          <p className="mb-3 text-sm font-black text-emerald-700">پیش‌ثبت‌نام</p>
          <h2 className="text-3xl font-black leading-[1.4] text-[#062452]">
            پیش‌ثبت‌نام آنلاین
          </h2>
        </div>

        <form className="mt-8 space-y-5">
          <Field id="fullName" label="نام و نام خانوادگی دانش‌آموز" autoComplete="name" />
          <Field id="parentPhone" label="شماره تماس والدین" type="tel" autoComplete="tel" />
          <Field id="requestedGrade" label="پایه یا واحد مورد نظر" />

          <button
            type="button"
            className="w-full rounded-2xl bg-[#12395b] px-5 py-3 text-sm font-black text-white transition duration-500 hover:-translate-y-0.5 hover:bg-[#0d2f4d]"
          >
            ثبت درخواست پیش‌ثبت‌نام
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-[#062452] transition duration-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            بازگشت به سایت
          </Link>
        </div>
      </section>
    </div>
  );
}



