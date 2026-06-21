import Link from "next/link";
import { AppLink } from "@/components/shared/app-link";
import { Container } from "@/components/shared/container";

const quickLinks = [
  { label: "درباره مدرسه", href: "/about" },
  { label: "واحدهای آموزشی", href: "/units" },
  { label: "اخبار و اطلاعیه‌ها", href: "/news" },
  { label: "گالری تصاویر", href: "/gallery" },
];

export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container className="grid min-h-[560px] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-6 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            مدرسه بعثت
          </div>

          <h1 className="max-w-3xl text-4xl font-black leading-[1.35] tracking-tight text-slate-950 md:text-5xl">
            پیوند آموزش و بصیریت دینی
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-9 text-slate-600 md:text-lg">
            پایگاه اطلاع‌رسانی مدرسه بعثت برای دسترسی به معرفی مدرسه، واحدهای آموزشی، اخبار، اطلاعیه‌ها و راه‌های ارتباطی.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <AppLink href="/about">آشنایی با مدرسه</AppLink>
            <AppLink href="/contact" variant="secondary">
              تماس با ما
            </AppLink>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] bg-[#0f2f4a] p-6 shadow-2xl shadow-slate-200">
            <div className="rounded-[1.5rem] bg-white p-6">
              <p className="mb-6 text-lg font-bold text-slate-950">دسترسی سریع</p>

              <div className="grid gap-3">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
