import { AppLink } from "@/components/shared/app-link";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";

export function HomeContactBanner() {
  return (
    <section className="pb-16">
      <Container>
        <Reveal mode="lazy" reserveClassName="min-h-48">
          <div className="rounded-[2rem] bg-[#0f2f4a] p-8 text-right text-white md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="mb-3 text-sm font-bold text-emerald-200">ارتباط با مدرسه</p>
                <h2 className="text-2xl font-black md:text-3xl">راه‌های ارتباطی مدرسه بعثت</h2>
                <p className="mt-4 max-w-2xl leading-8 text-slate-200">
                  برای دریافت اطلاعات بیشتر، می‌توانید از بخش تماس با ما اقدام کنید.
                </p>
              </div>

              <div className="flex md:justify-end">
                <AppLink href="/contact" variant="secondary">
                  تماس با ما
                </AppLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
