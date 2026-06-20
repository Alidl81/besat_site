import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";

const rules = [
  "هر عدد یا آمار باید منبع تأییدشده داشته باشد.",
  "برای محتوای ناموجود، متن ساختگی نمایش داده نمی‌شود.",
  "فرانت از ابتدا برای اتصال به API طراحی می‌شود.",
];

export function ContentRulesSection() {
  return (
    <section className="bg-white py-16">
      <Container>
        <SectionHeader
          eyebrow="قانون پروژه"
          title="کنترل دقت محتوا"
          description="این قوانین برای جلوگیری از ورود اطلاعات اشتباه یا ساختگی به نسخه نهایی سایت رعایت می‌شوند."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {rules.map((rule, index) => (
            <div key={rule} className="rounded-3xl bg-slate-50 p-6">
              <div className="mb-5 flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                {index + 1}
              </div>
              <p className="leading-8 text-slate-700">{rule}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
