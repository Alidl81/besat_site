import { AppLink } from "@/components/shared/app-link";
import { Container } from "@/components/shared/container";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container className="grid min-h-[560px] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-6 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            نسخه جدید وب‌سایت مدرسه
          </div>

          <h1 className="max-w-3xl text-4xl font-black leading-[1.35] tracking-tight text-slate-950 md:text-5xl">
            طراحی دقیق، رسمی و قابل مدیریت برای مدرسه بعثت
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-9 text-slate-600 md:text-lg">
            این نسخه بدون اطلاعات ساختگی توسعه داده می‌شود. محتواهای نهایی فقط بعد از تأیید مدرسه یا دریافت از بک‌اند نمایش داده خواهند شد.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <AppLink href="/about">مشاهده ساختار سایت</AppLink>
            <AppLink href="/contact" variant="secondary">
              ارتباط با مدرسه
            </AppLink>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] bg-[#0f2f4a] p-6 shadow-2xl shadow-slate-200">
            <div className="rounded-[1.5rem] bg-white p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-950">وضعیت محتوا</p>
                  <p className="mt-1 text-sm text-slate-500">اتصال به بک‌اند در مراحل بعد</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Verified Only
                </span>
              </div>

              <div className="space-y-3">
                {[
                  "بدون آمار حدسی",
                  "بدون شماره تماس ساختگی",
                  "بدون خبر نمونه در نسخه نهایی",
                  "آماده اتصال به Django API",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
