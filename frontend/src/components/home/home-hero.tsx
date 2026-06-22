import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";

const featureCards = [
  { title: "معرفی مدرسه", href: "/about", icon: "◇" },
  { title: "واحدهای آموزشی", href: "/units", icon: "□" },
  { title: "اخبار و اطلاعیه‌ها", href: "/news", icon: "○" },
  { title: "تماس با ما", href: "/contact", icon: "△" },
];

export function HomeHero() {
  return (
    <section className="relative bg-white">
      <Container className="pt-5">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0f2f4a]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_32%),linear-gradient(90deg,rgba(15,47,74,0.94),rgba(15,47,74,0.82),rgba(15,47,74,0.64))]" />
          <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] md:block" />

          <div className="relative grid min-h-[430px] items-center gap-10 px-6 py-12 md:px-12 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal mode="immediate">
              <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-white/15">
                مدرسه بعثت
              </p>

              <h1 className="max-w-2xl text-4xl font-black leading-[1.35] tracking-tight text-white md:text-5xl">
                مدرسه‌ای برای زندگی، علم و ایمان
              </h1>

              <p className="mt-5 max-w-xl text-base leading-9 text-slate-200">
                پایگاه اطلاع‌رسانی مدرسه بعثت برای معرفی مدرسه، دسترسی به واحدهای آموزشی، اخبار، گالری و راه‌های ارتباطی.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/about"
                  className="rounded-xl besat-green-button bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
                >
                  بیشتر درباره ما
                </Link>

                <Link
                  href="/units"
                  className="rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  مشاهده واحدها
                </Link>
              </div>
            </Reveal>

            <Reveal mode="immediate" delay={120}>
              <div className="relative hidden min-h-[270px] rounded-[1.75rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-slate-950/20 md:block">
                <div className="absolute inset-4 rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.05))]" />
                <div className="relative grid h-full min-h-[238px] grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-white/20" />
                  <div className="rounded-3xl bg-white/10" />
                  <div className="rounded-3xl bg-white/20" />
                  <div className="col-span-2 rounded-3xl bg-white/10" />
                  <div className="rounded-3xl bg-emerald-400/30" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal mode="lazy" reserveClassName="min-h-28">
          <div className="relative z-10 -mt-10 grid gap-4 px-2 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-lg shadow-slate-200/70 transition hover:-translate-y-1 hover:border-emerald-200"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-black text-emerald-700">
                  {item.icon}
                </div>
                <h2 className="text-base font-black text-[#0f2f4a]">{item.title}</h2>
                <p className="mt-2 text-sm font-semibold text-emerald-700">مشاهده</p>
              </Link>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

