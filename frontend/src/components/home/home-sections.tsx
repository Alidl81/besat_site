import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";

const departments = [
  "علوم انسانی",
  "زبان‌های خارجی",
  "علوم تجربی",
  "هنر و خلاقیت",
  "ریاضیات",
  "فرهنگ دینی",
];

const schoolSections = [
  {
    title: "واحدهای آموزشی",
    text: "دسترسی به بخش‌های آموزشی و مسیرهای مرتبط با مدرسه.",
    href: "/units",
  },
  {
    title: "دپارتمان‌ها",
    text: "آشنایی با دپارتمان‌ها و زمینه‌های آموزشی مدرسه.",
    href: "/departments",
  },
  {
    title: "اخبار و اطلاعیه‌ها",
    text: "پیگیری خبرها و اطلاعیه‌های مدرسه بعثت.",
    href: "/news",
  },
];

export function HomeSections() {
  return (
    <section className="bg-slate-50 py-14 md:py-16">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal mode="lazy" reserveClassName="min-h-96">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm font-bold text-emerald-700">بخش‌های مدرسه</p>
                  <h2 className="text-2xl font-black text-[#0f2f4a]">مسیرهای اصلی دسترسی</h2>
                </div>

                <Link href="/units" className="text-sm font-bold text-emerald-700">
                  مشاهده همه
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {schoolSections.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-3xl border border-slate-200 bg-white p-5 text-right transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <h3 className="text-base font-black text-[#0f2f4a]">{item.title}</h3>
                    <p className="mt-3 min-h-20 text-sm leading-7 text-slate-600">{item.text}</p>
                    <span className="mt-4 inline-flex text-sm font-bold text-emerald-700">مشاهده</span>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal mode="lazy" reserveClassName="min-h-96" delay={100}>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm font-bold text-emerald-700">دپارتمان‌ها</p>
                  <h2 className="text-2xl font-black text-[#0f2f4a]">حوزه‌های آموزشی</h2>
                </div>

                <Link href="/departments" className="text-sm font-bold text-emerald-700">
                  مشاهده
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
