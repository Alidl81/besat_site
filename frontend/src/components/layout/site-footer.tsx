import Link from "next/link";
import { BesatLogoMark } from "@/components/shared/besat-logo";

type FooterLink = {
  label: string;
  href: string;
  description?: string;
  iconSrc?: string;
};

type FooterContact = {
  label: string;
  value: string;
  href?: string;
};

const quickLinks: FooterLink[] = [
  { label: "واحدها", href: "/units" },
  { label: "دپارتمان‌ها", href: "/departments" },
  { label: "اخبار", href: "/news" },
  { label: "گالری", href: "/gallery" },
];

const relatedWebsites: FooterLink[] = [
  {
    label: "روابط عمومی مدارس بعثت",
    href: "https://besat-r.com",
    description: "پایگاه اطلاع‌رسانی مدارس بعثت",
  },
  {
    label: "دبیرستان بعثت",
    href: "https://www.besat-hs.ir",
    description: "وب‌سایت رسمی دبیرستان بعثت",
  },
  {
    label: "کانون زبان بعثت",
    href: "https://besatkids.com",
    description: "مرکز تخصصی زبان بعثت",
  },
];

const contactItems: FooterContact[] = [
  {
    label: "شماره تماس",
    value: "۰۵۱-۳۸۶۸۱۹۹۹",
    href: "tel:05138681999",
  },
  {
    label: "نشانی",
    value: "مشهد، بلوار معلم، معلم ۶۹، مجتمع آموزشی بعثت",
  },
];

const socialLinks: FooterLink[] = [
  {
    label: "ایتا",
    href: "https://eitaa.com/besatpr",
    description: "روابط عمومی مدارس بعثت",
    iconSrc: "/icons/social/eitaa.svg",
  },
  {
    label: "تلگرام",
    href: "https://t.me/besat_hs",
    description: "دبیرستان بعثت",
    iconSrc: "/icons/social/telegram.svg",
  },
];

function isExternalLink(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function FooterSmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  if (isExternalLink(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 5.18 2 2 0 0 1 5.06 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.61a2 2 0 0 1-.45 2.11L9 10.65a16 16 0 0 0 4.35 4.35l1.21-1.21a2 2 0 0 1 2.11-.45c.84.28 1.71.48 2.61.6A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer dir="rtl" className="relative overflow-hidden bg-[#071524] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_30%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl lg:grid-cols-[1.35fr_0.85fr_1.1fr_1.15fr]">
          <section className="border-b border-white/10 p-6 text-right lg:border-b-0 lg:border-l lg:p-8">
            <div className="flex items-start justify-start gap-4">
              <BesatLogoMark size="md" />
              <div>
                <h2 className="text-2xl font-black leading-10">
                  مدرسه بعثت
                </h2>
                <p className="mt-1 text-sm font-bold text-white/55">
                  مجموعه آموزشی، تربیتی و فرهنگی
                </p>
              </div>
            </div>

            <p className="mt-8 max-w-xl text-sm font-bold leading-9 text-white/72">
              در مدرسه بعثت، آموزش تنها انتقال دانش نیست؛ مسیر رشد، مسئولیت‌پذیری
              و آماده‌سازی نسل آینده با نگاهی روشن و انسانی است.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 text-center">
                <p className="text-2xl font-black">+۳۲</p>
                <p className="mt-2 text-xs font-bold text-white/55">سال سابقه</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 text-center">
                <p className="text-lg font-black leading-8">پیش‌دبستانی تا دبیرستان</p>
                <p className="mt-2 text-xs font-bold text-white/55">مسیر آموزشی</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 text-center">
                <p className="text-lg font-black leading-8">دخترانه و پسرانه</p>
                <p className="mt-2 text-xs font-bold text-white/55">مدارس بعثت</p>
              </div>
            </div>
          </section>

          <section className="border-b border-white/10 p-6 text-right lg:border-b-0 lg:border-l lg:p-8">
            <div className="flex items-center justify-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <LinkIcon />
              </span>
              <div>
                <h3 className="text-lg font-black">دسترسی سریع</h3>
                <p className="mt-1 text-xs font-bold text-white/40">بخش‌های سایت</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              {quickLinks.map((item) => (
                <FooterSmartLink
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold text-white/72 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <span>{item.label}</span>
                  <span className="text-white/25 transition group-hover:text-cyan-300">
                    <ArrowIcon />
                  </span>
                </FooterSmartLink>
              ))}
            </div>
          </section>

          <section className="border-b border-white/10 p-6 text-right lg:border-b-0 lg:border-l lg:p-8">
            <div className="flex items-center justify-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <LinkIcon />
              </span>
              <div>
                <h3 className="text-lg font-black">وب‌سایت‌های مرتبط</h3>
                <p className="mt-1 text-xs font-bold text-white/40">لینک‌های وابسته</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {relatedWebsites.map((item) => (
                <FooterSmartLink
                  key={item.href}
                  href={item.href}
                  className="group rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-black text-white">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-2 block text-xs font-bold leading-6 text-white/45">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-white/30 transition group-hover:text-cyan-300">
                      <ArrowIcon />
                    </span>
                  </span>
                </FooterSmartLink>
              ))}
            </div>
          </section>

          <section className="p-6 text-right lg:p-8">
            <div className="flex items-center justify-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                <PhoneIcon />
              </span>
              <div>
                <h3 className="text-lg font-black">ارتباط با مدرسه</h3>
                <p className="mt-1 text-xs font-bold text-white/40">اطلاعات تماس</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {contactItems.map((item) => {
                const content = (
                  <span className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
                    <span className="text-right">
                      <span className="block text-xs font-bold text-white/42">
                        {item.label}
                      </span>
                      <span className="mt-2 block text-sm font-black leading-7 text-white">
                        {item.value}
                      </span>
                    </span>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-cyan-300">
                      {item.label.includes("نشانی") ? <PinIcon /> : <PhoneIcon />}
                    </span>
                  </span>
                );

                if (item.href) {
                  return (
                    <FooterSmartLink
                      key={item.label}
                      href={item.href}
                      className="block transition hover:scale-[1.01]"
                    >
                      {content}
                    </FooterSmartLink>
                  );
                }

                return <div key={item.label}>{content}</div>;
              })}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-right">
                <h3 className="text-lg font-black">شبکه‌های اجتماعی</h3>
                <p className="mt-1 text-xs font-bold text-white/40">همراه ما باشید</p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/[0.08] text-cyan-300">
                <ArrowIcon />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {socialLinks.map((item) => (
                <FooterSmartLink
                  key={item.href}
                  href={item.href}
                  className="group flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-sm font-black text-white transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
                >
                  {item.iconSrc ? (
                    <img
                      src={item.iconSrc}
                      alt={item.label}
                      className="size-6 object-contain drop-shadow-sm"
                      draggable={false}
                    />
                  ) : (
                    <span>{item.label.slice(0, 2)}</span>
                  )}
                </FooterSmartLink>
              ))}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black">برای ارتباط مستقیم</h3>
                <p className="mt-1 text-xs font-bold text-white/40">
                  از صفحه تماس با ما یا پیش‌ثبت‌نام استفاده کنید.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] px-5 text-sm font-black text-white transition hover:bg-white/[0.12]"
                >
                  تماس با ما
                </Link>
                <Link
                  href="/registration"
                  className="besat-green-button inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black transition hover:bg-emerald-700"
                >
                  پیش‌ثبت‌نام
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs font-bold text-white/38">
          همه حقوق این وب‌سایت برای مدرسه بعثت محفوظ است.
        </div>
      </div>
    </footer>
  );
}
