import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { AboutPageContent } from "@/components/about/about-page-content";

export const metadata: Metadata = {
  title: "درباره ما | مدرسه بعثت",
  description: "مجتمع تربیتی آموزشی بعثت با بیش از ۳۲ سال سابقه در مقاطع مختلف تحصیلی.",
};

// آمار واقعی (ثابت — از سایت besat-r.com)
const stats = [
  { value: "+۳۲", label: "سال سابقه درخشان" },
  { value: "+۳۰۰۰", label: "دانش‌آموز" },
  { value: "~۵۰۰", label: "آموزگار، دبیر و کادر" },
  { value: "۱۳", label: "واحد و دپارتمان" },
];

const honors = [
  "کسب مدال برنز المپیاد جهانی IJSO در کشور تایلند",
  "مقام جهانی در مسابقات فیراکاپ ۲۰۲۴ برزیل توسط دانش‌آموزان بعثتی",
  "قبولی دانش‌آموزان در رشته‌های پزشکی، دندانپزشکی و مهندسی دانشگاه‌های برتر کشور",
  "کسب مدال در المپیادهای علمی کشوری و بین‌المللی",
];

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-emerald-700">درباره ما</p>
            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              مجتمع تربیتی آموزشی بعثت
            </h1>
            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              با بیش از ۳۲ سال سابقه درخشان در عرصه تعلیم و تربیت
            </p>
          </div>
        </Container>
      </section>

      {/* آمار */}
      <section className="border-b border-slate-200 bg-white py-10">
        <Container>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[1.75rem] border border-slate-200 bg-[#f8fafc] p-6 text-center">
                <div className="text-3xl font-black text-emerald-600">{stat.value}</div>
                <p className="mt-2 text-xs font-bold leading-6 text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* محتوای قابل ویرایش */}
      <AboutPageContent />

      {/* افتخارات */}
      <section className="bg-[#f8fafc] py-14 md:py-16">
        <Container>
          <div className="mb-8 text-right">
            <p className="mb-2 text-sm font-black text-emerald-600">افتخارات</p>
            <h2 className="text-3xl font-black text-[#062452]">برخی از افتخارات بعثت</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {honors.map((honor) => (
              <div key={honor} className="flex items-start gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-right shadow-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg">🏆</span>
                <p className="text-sm font-bold leading-7 text-slate-600">{honor}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* تماس */}
      <section className="bg-white py-14 md:py-16">
        <Container>
          <div className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-8 text-right shadow-sm sm:p-10">
            <h2 className="text-2xl font-black text-[#062452]">ارتباط با ما</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">📍</span>
                <div>
                  <p className="text-xs font-black text-slate-400">نشانی</p>
                  <p className="mt-1 text-sm font-black leading-7 text-[#062452]">
                    مشهد، بلوار معلم، معلم ۶۹، مجتمع آموزشی بعثت
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">📞</span>
                <div>
                  <p className="text-xs font-black text-slate-400">تلفن</p>
                  <a href="tel:05138681999" className="mt-1 block text-sm font-black text-[#062452] transition hover:text-emerald-700">
                    ۰۵۱-۳۸۶۸۱۹۹۹ (داخلی ۴۰۰)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </PublicPageLayout>
  );
}
