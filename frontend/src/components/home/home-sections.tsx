import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";

const sections = [
  {
    title: "درباره مدرسه",
    description: "معرفی مدرسه، رویکرد آموزشی و فضای تربیتی بعثت.",
    href: "/about",
  },
  {
    title: "واحدهای آموزشی",
    description: "آشنایی با بخش‌ها و واحدهای آموزشی مدرسه.",
    href: "/units",
  },
  {
    title: "اخبار و اطلاعیه‌ها",
    description: "پیگیری تازه‌ترین خبرها و اطلاعیه‌های مدرسه.",
    href: "/news",
  },
  {
    title: "گالری تصاویر",
    description: "نمایش تصاویر برنامه‌ها، رویدادها و فضای مدرسه.",
    href: "/gallery",
  },
];

export function HomeSections() {
  return (
    <section className="py-16">
      <Container>
        <Reveal mode="lazy" reserveClassName="min-h-36">
          <SectionHeader
            eyebrow="بخش‌های سایت"
            title="مسیرهای اصلی دسترسی"
            description="بخش‌های اصلی وب‌سایت برای دسترسی ساده‌تر خانواده‌ها، دانش‌آموزان و مخاطبان مدرسه طراحی شده‌اند."
          />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {sections.map((section, index) => (
            <Reveal
              key={section.title}
              mode="lazy"
              delay={index * 80}
              reserveClassName="min-h-56"
            >
              <article className="h-full rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <h3 className="text-lg font-bold text-slate-950">{section.title}</h3>

                <p className="mt-4 min-h-20 text-sm leading-7 text-slate-600">
                  {section.description}
                </p>

                <Link href={section.href} className="mt-6 inline-flex text-sm font-bold text-emerald-700">
                  مشاهده
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
