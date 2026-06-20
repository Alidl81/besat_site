import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";

const sections = [
  {
    title: "درباره مدرسه",
    description: "متن رسمی معرفی مدرسه بعد از تأیید، از بک‌اند دریافت و در این بخش نمایش داده می‌شود.",
  },
  {
    title: "واحدهای آموزشی",
    description: "لیست واحدها بدون حدس و فقط بر اساس داده تأییدشده مدرسه نمایش داده خواهد شد.",
  },
  {
    title: "اخبار و اطلاعیه‌ها",
    description: "خبرها و اطلاعیه‌ها از پنل مدیریت Django ثبت می‌شوند و در سایت نمایش داده می‌شوند.",
  },
  {
    title: "گالری تصاویر",
    description: "تصاویر رسمی مدرسه بعد از تأیید و بارگذاری در بک‌اند در این بخش قرار می‌گیرند.",
  },
];

export function VerifiedSectionsPreview() {
  return (
    <section className="py-16">
      <Container>
        <SectionHeader
          eyebrow="ساختار محتوایی"
          title="بخش‌های اصلی سایت"
          description="در این مرحله فقط ساختار UI را آماده می‌کنیم و محتوای واقعی بعداً از API بک‌اند دریافت می‌شود."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950">{section.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{section.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
