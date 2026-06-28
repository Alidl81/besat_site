import type { Metadata } from "next";
import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "تماس با ما | مدرسه بعثت",
};

const contactInfo = [
  {
    icon: "📞",
    label: "شماره تماس",
    value: "۰۵۱-۳۸۶۸۱۹۹۹",
    href: "tel:05138681999",
  },
  {
    icon: "📍",
    label: "نشانی",
    value: "مشهد، بلوار معلم، معلم ۶۹، مجتمع آموزشی بعثت",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Container className="py-14 md:py-20">
          <div className="max-w-3xl text-right">
            <p className="mb-4 text-sm font-black text-emerald-700">تماس با ما</p>
            <h1 className="text-3xl font-black leading-[1.4] tracking-tight text-[#0f2f4a] md:text-5xl">
              راه‌های ارتباطی مدرسه بعثت
            </h1>
            <p className="mt-5 text-base leading-9 text-slate-600 md:text-lg">
              از طریق فرم زیر یا راه‌های ارتباطی موجود با ما در تماس باشید.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-14 md:py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
            {/* اطلاعات تماس */}
            <div className="space-y-5">
              <h2 className="text-xl font-black text-[#062452]">اطلاعات تماس</h2>

              {contactInfo.map((item) => (
                <div
                  key={item.label}
                  className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4 text-right">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-400">{item.label}</p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="mt-1 block text-sm font-black text-[#062452] transition hover:text-emerald-700"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-black leading-7 text-[#062452]">
                          {item.value}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* شبکه‌های اجتماعی */}
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-black text-[#062452]">شبکه‌های اجتماعی</p>
                <div className="flex gap-3">
                  <a
                    href="https://eitaa.com/besatpr"
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-[#062452] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <img src="/icons/social/eitaa.svg" alt="ایتا" className="size-5" />
                    <span>ایتا</span>
                  </a>
                  <a
                    href="https://t.me/besat_hs"
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-[#062452] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <img src="/icons/social/telegram.svg" alt="تلگرام" className="size-5" />
                    <span>تلگرام</span>
                  </a>
                </div>
              </div>
            </div>

            {/* فرم تماس */}
            <ContactForm />
          </div>
        </Container>
      </section>
    </PublicPageLayout>
  );
}
