import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { AppLink } from "@/components/shared/app-link";

export function HomeContactBanner() {
  return (
    <section className="pb-16">
      <Container>
        <div className="rounded-[2rem] bg-[#0f2f4a] p-8 text-white md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <SectionHeader
              eyebrow="ارتباط با مدرسه"
              title="راه‌های ارتباطی مدرسه بعثت"
              description="برای دریافت اطلاعات بیشتر، می‌توانید از بخش تماس با ما اقدام کنید."
            />

            <div className="flex md:justify-end">
              <AppLink href="/contact" variant="secondary">
                تماس با ما
              </AppLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
