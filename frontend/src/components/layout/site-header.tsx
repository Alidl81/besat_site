import { Container } from "@/components/shared/container";
import { AppLink } from "@/components/shared/app-link";

const navItems = [
  { label: "صفحه اصلی", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "واحدها", href: "/units" },
  { label: "اخبار", href: "/news" },
  { label: "گالری", href: "/gallery" },
  { label: "تماس", href: "/contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0f2f4a] text-sm font-bold text-white">
            ب
          </div>

          <div>
            <p className="text-base font-bold text-slate-950">مدرسه بعثت</p>
            <p className="text-xs text-slate-500">نسخه در حال توسعه</p>
          </div>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-emerald-700">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <AppLink href="/registration">پیش‌ثبت‌نام</AppLink>
        </div>
      </Container>
    </header>
  );
}
