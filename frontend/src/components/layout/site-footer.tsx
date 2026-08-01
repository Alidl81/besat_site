"use client";

import Link from "next/link";
import {
  ArrowUpLeft,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { getPublicSiteSettings } from "@/services/public-content-service";
import type { PublicSiteSettings } from "@/types/public-content";

const quickLinks = [
  ["واحدهای آموزشی", "/units"],
  ["دپارتمان‌ها", "/departments"],
  ["اخبار", "/news"],
  ["افتخارات", "/achievements"],
  ["گالری", "/gallery"],
  ["درباره ما", "/about"],
] as const;

export function SiteFooter() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicSiteSettings()
      .then((response) => {
        if (!cancelled) setSettings(response);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const socialLinks = [
    ["ایتا", settings?.eitaa_url],
    ["تلگرام", settings?.telegram_url],
    ["اینستاگرام", settings?.instagram_url],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <footer dir="rtl" className="relative mt-auto overflow-hidden bg-[#071524] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(43,111,159,0.24),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_28%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.8fr_1fr]">
          <section className="border-b border-white/10 p-6 text-right lg:border-b-0 lg:border-l lg:p-7">
            <div className="flex items-center gap-4">
              <BesatLogoMark size="md" tone="light" />
              <div>
                <h2 className="text-xl font-black leading-9">
                  {settings?.school_name || "مجتمع آموزشی بعثت"}
                </h2>
                {settings?.slogan ? (
                  <p className="mt-1 text-xs font-bold text-white/55">
                    {settings.slogan}
                  </p>
                ) : null}
              </div>
            </div>

            {settings?.intro_text ? (
              <p className="mt-5 max-w-xl text-sm font-bold leading-8 text-white/70">
                {settings.intro_text}
              </p>
            ) : null}

            {socialLinks.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-white/80 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-white"
                  >
                    {label}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <nav
            aria-label="پیوندهای پاورقی"
            className="border-b border-white/10 p-6 text-right lg:border-b-0 lg:border-l lg:p-7"
          >
            <h3 className="text-base font-black">دسترسی سریع</h3>
            <div className="mt-4 grid grid-cols-2 gap-1">
              {quickLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="group inline-flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-sm font-bold text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                >
                  {label}
                  <ArrowUpLeft
                    aria-hidden="true"
                    className="size-3.5 text-white/25 transition group-hover:text-cyan-300"
                  />
                </Link>
              ))}
            </div>
          </nav>

          <section className="p-6 text-right lg:p-7">
            <h3 className="text-base font-black">ارتباط با مجموعه</h3>
            <div className="mt-4 grid gap-2">
              {settings?.phone_primary ? (
                <a
                  href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`}
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white/80 transition hover:bg-white/[0.09]"
                >
                  <Phone aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
                  <span dir="ltr">{settings.phone_primary}</span>
                </a>
              ) : null}

              {settings?.email ? (
                <a
                  href={`mailto:${settings.email}`}
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white/80 transition hover:bg-white/[0.09]"
                >
                  <Mail aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
                  <span dir="ltr" className="min-w-0 truncate">{settings.email}</span>
                </a>
              ) : null}

              {settings?.address ? (
                <p className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold leading-7 text-white/80">
                  <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-cyan-300" />
                  {settings.address}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-5 text-center text-xs font-bold text-white/45 sm:flex-row sm:text-right">
          <p>همه حقوق این وب‌سایت برای مجتمع آموزشی بعثت محفوظ است.</p>
          <div className="flex gap-2">
            <Link
              href="/contact"
              className="rounded-xl px-3 py-2 transition hover:bg-white/[0.07] hover:text-white"
            >
              تماس با ما
            </Link>
            <Link
              href="/registration"
              className="rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-500"
            >
              پیش‌ثبت‌نام
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
