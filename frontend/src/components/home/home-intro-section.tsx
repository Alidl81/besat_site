import type { ReactNode } from "react";
import { homeIntroContent } from "@/lib/home/home-intro-data";

function PrincipleIcon({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex size-[58px] items-center justify-center rounded-full border border-[#d5e0e8] bg-gradient-to-b from-white to-[#f8fafc] text-[#0a2848] shadow-[0_12px_30px_rgba(8,30,55,0.09)] ring-4 ring-white/80 transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:border-[#d9a254] group-hover:text-[#b7792d] group-hover:shadow-[0_18px_36px_rgba(8,30,55,0.13)]">
      <span aria-hidden="true" className="absolute inset-[5px] rounded-full border border-[#0a2848]/[0.045]" />
      {children}
      <span aria-hidden="true" className="absolute -bottom-1 size-2.5 rounded-full border-2 border-[#fbfaf7] bg-[#d9a254] transition-transform duration-500 group-hover:scale-125" />
    </span>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="relative z-10 size-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="m15 9 6-6M17 3h4v4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="relative z-10 size-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0M19 8.5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="relative z-10 size-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v18H6.5A3.5 3.5 0 0 0 3 23Z" />
      <path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v18h4.5A3.5 3.5 0 0 1 21 23Z" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="relative z-10 size-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="m12 2 2 2.2 3-.4.8 2.9 2.7 1.4-1 2.9 1 2.9-2.7 1.4-.8 2.9-3-.4-2 2.2-2-2.2-3 .4-.8-2.9-2.7-1.4 1-2.9-1-2.9 2.7-1.4.8-2.9 3 .4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const principles = [
  { title: "توسعه مهارت‌ها", subtitle: "و استعدادها", icon: <TargetIcon /> },
  { title: "تربیت اخلاقی", subtitle: "و معنوی", icon: <UserIcon /> },
  { title: "آموزش نوین", subtitle: "با رویکرد اسلامی", icon: <BookIcon /> },
  { title: "بیش از سه دهه", subtitle: "تجربه آموزشی", icon: <BadgeIcon /> },
];

export function HomeIntroSection() {
  const content = homeIntroContent;

  return (
    <section dir="rtl" className="bg-[#fbfaf7] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="text-right">
          <p className="mb-3 flex items-center gap-3 text-sm font-black text-[#c98c3d]">
            <span className="h-px w-8 bg-[#c98c3d]" />
            مجتمع آموزشی بعثت
          </p>
          <h2 className="text-3xl font-black leading-[1.55] text-[#0a2848] sm:text-4xl lg:text-[2.65rem]">
            پیوند آموزش و بصیرت دینی
          </h2>
          <p className="mt-5 max-w-3xl text-sm font-bold leading-8 text-[#5b6876] sm:text-[15px] sm:leading-9">
            ما در بعثت، باور داریم که آموزش تنها انتقال دانش نیست؛ بلکه تربیت انسان‌هایی است که در پرتو ایمان، اخلاق، دانش و مهارت، مسئولیت‌پذیر و اثرگذار در جامعه باشند.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-8 text-[#5b6876] sm:text-[15px] sm:leading-9">
            با بهره‌گیری از کادر مجرب، برنامه‌های آموزشی به‌روز و محیطی پویا و معنوی، در مسیر رشد همه‌جانبه دانش‌آموزان گام برمی‌داریم.
          </p>

          <div role="list" aria-label="ارزش‌های آموزشی بعثت" className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-4">
            {principles.map((item, index) => (
              <article
                key={item.title}
                role="listitem"
                data-stagger-item
                style={{ animationDelay: `${180 + index * 90}ms` }}
                className="group flex min-h-[132px] flex-col items-center justify-start px-2 pt-2 text-center transition-transform duration-500 ease-out hover:-translate-y-1"
              >
                <PrincipleIcon>{item.icon}</PrincipleIcon>
                <h3 className="mt-4 text-[13px] font-black leading-6 text-[#0a2848] sm:text-sm">{item.title}</h3>
                <p className="mt-1 text-[11px] font-bold leading-5 text-[#657486] sm:text-xs">{item.subtitle}</p>
              </article>
            ))}
          </div>
        </div>

        <div data-stagger-item style={{ animationDelay: "80ms" }} className="relative order-first lg:order-last">
          <div className="absolute -left-5 -top-5 hidden h-24 w-24 rounded-tl-[2rem] border-l-2 border-t-2 border-[#d9a254]/55 lg:block" />
          <div className="relative overflow-hidden rounded-[1.45rem] border border-[#e5e1d9] bg-white p-2 shadow-[0_24px_60px_rgba(8,30,55,0.11)]">
            <img
              src={content.imageSrc}
              alt={content.imageAlt || content.title}
              className="aspect-[4/3] w-full rounded-[1.1rem] object-cover transition-transform duration-[1400ms] hover:scale-[1.035]"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-2 rounded-[1.1rem] bg-gradient-to-t from-[#071b31]/25 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
