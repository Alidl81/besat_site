import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";

export function HomeContactBanner() {
  return (
    <section className="bg-slate-50 pb-14 md:pb-16">
      <Container>
        <Reveal mode="lazy" reserveClassName="min-h-48">
          <div className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-sm">
            <div className="grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div className="text-right">
                <p className="mb-3 text-sm font-bold text-emerald-700">ثبت‌نام و ارتباط</p>
                <h2 className="text-2xl font-black text-[#0f2f4a] md:text-3xl">
                  آماده ساختن آینده‌ای روشن برای فرزند خود هستید؟
                </h2>
                <p className="mt-4 max-w-2xl leading-8 text-slate-600">
                  برای ارتباط با مدرسه و ارسال درخواست، از بخش‌های تماس و پیش‌ثبت‌نام استفاده کنید.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link
                  href="/registration"
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
                >
                  ثبت‌نام آنلاین
                </Link>

                <Link
                  href="/contact"
                  className="rounded-xl border border-emerald-200 px-6 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  تماس با ما
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
