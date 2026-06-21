import Link from "next/link";
import { Container } from "@/components/shared/container";

const quickLinks = [
  { label: "صفحه اصلی", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "واحدهای آموزشی", href: "/units" },
  { label: "اخبار و اطلاعیه‌ها", href: "/news" },
  { label: "گالری تصاویر", href: "/gallery" },
];

const relatedLinks = [
  { label: "دپارتمان‌ها", href: "/departments" },
  { label: "تماس با ما", href: "/contact" },
  { label: "پیش‌ثبت‌نام", href: "/registration" },
];

const contactLinks = [
  { label: "ارسال پیام", href: "/contact" },
  { label: "درخواست پیش‌ثبت‌نام", href: "/registration" },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
    >
      <span>{label}</span>
      <span className="text-emerald-300 opacity-60 transition group-hover:opacity-100">↗</span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#061727] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.16),transparent_28%)]" />

      <Container className="relative py-10 md:py-14">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl shadow-slate-950/30 backdrop-blur">
          <div className="grid divide-y divide-white/10 lg:grid-cols-[1.2fr_0.85fr_1fr_0.95fr] lg:divide-x lg:divide-x-reverse lg:divide-y-0">
            <div className="p-6 md:p-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-xl font-black text-emerald-300">
                  ب
                </div>

                <div>
                  <p className="text-xl font-black">مدرسه بعثت</p>
                  <p className="mt-1 text-sm text-slate-400">پیوند آموزش و بصیریت دینی</p>
                </div>
              </div>

              <p className="max-w-md text-sm leading-8 text-slate-300">
                پایگاه اطلاع‌رسانی مدرسه بعثت برای معرفی مدرسه، دسترسی به بخش‌های آموزشی، اطلاعیه‌ها، گالری و راه‌های ارتباطی.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
                  <p className="text-lg font-black text-emerald-300">آموزش</p>
                  <p className="mt-1 text-xs text-slate-400">مسیر رشد</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
                  <p className="text-lg font-black text-emerald-300">تربیت</p>
                  <p className="mt-1 text-xs text-slate-400">نگاه دینی</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
                  <p className="text-lg font-black text-emerald-300">همراهی</p>
                  <p className="mt-1 text-xs text-slate-400">با خانواده</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black">دسترسی سریع</h2>
                  <p className="mt-1 text-xs text-slate-500">بخش‌های سایت</p>
                </div>
                <span className="text-xl text-sky-300">◌</span>
              </div>

              <div className="grid gap-3">
                {quickLinks.map((item) => (
                  <FooterLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black">مسیرهای مرتبط</h2>
                  <p className="mt-1 text-xs text-slate-500">صفحات کاربردی</p>
                </div>
                <span className="text-xl text-emerald-300">✦</span>
              </div>

              <div className="grid gap-3">
                {relatedLinks.map((item) => (
                  <FooterLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black">ارتباط با مدرسه</h2>
                  <p className="mt-1 text-xs text-slate-500">راه‌های ارسال درخواست</p>
                </div>
                <span className="text-xl text-sky-300">☏</span>
              </div>

              <div className="grid gap-3">
                {contactLinks.map((item) => (
                  <FooterLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>

              <div className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-sm font-bold text-emerald-200">برای ارتباط مستقیم</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  از فرم تماس با ما استفاده کنید تا پیام شما ثبت شود.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black">شبکه‌های ارتباطی</h2>
                <p className="mt-1 text-xs text-slate-500">مسیرهای ارتباط با مدرسه</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                ↟
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
              >
                فرم تماس
              </Link>

              <Link
                href="/registration"
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
              >
                پیش‌ثبت‌نام
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-black">مدرسه بعثت</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                  این وب‌سایت برای دسترسی ساده‌تر خانواده‌ها، دانش‌آموزان و مخاطبان مدرسه طراحی شده است.
                </p>
              </div>

              <Link
                href="/contact"
                className="inline-flex shrink-0 justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
              >
                ارتباط با ما
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-7 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
          تمامی حقوق برای مدرسه بعثت محفوظ است.
        </div>
      </Container>
    </footer>
  );
}
