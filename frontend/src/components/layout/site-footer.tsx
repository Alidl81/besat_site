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
import {
  getContactInfo,
  getPublicSiteSettings,
} from "@/services/public-content-service";
import type {
  ContactInfo,
  PublicSiteSettings,
} from "@/types/public-content";

const quickLinks = [
  ["واحدهای آموزشی", "/units"],
  ["دپارتمان‌ها", "/departments"],
  ["اخبار", "/news"],
  ["افتخارات", "/achievements"],
  ["گالری", "/gallery"],
  ["درباره ما", "/about"],
] as const;

// Curated, previously-approved set of external Besat-affiliated sites only —
// not an unfiltered link farm.
const relatedSites = [
  ["روابط عمومی مدارس بعثت", "https://besat-r.com"],
  ["دبیرستان بعثت", "https://www.besat-hs.ir"],
  ["کانون زبان بعثت", "https://besatkids.com"],
] as const;

type SiteSettingsWithLegacyPhone = PublicSiteSettings & {
  phone?: string | null;
};

function telHref(value: string) {
  const normalized = value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const phone = normalized.replace(/[^\d+]/g, "");

  return phone ? `tel:${phone}` : undefined;
}

export function SiteFooter() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getPublicSiteSettings().catch(() => null),
      getContactInfo().catch(() => null),
    ]).then(([siteSettings, contactInfo]) => {
      if (cancelled) {
        return;
      }

      setSettings(siteSettings);
      setContact(contactInfo);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const legacyPhone = (settings as SiteSettingsWithLegacyPhone | null)?.phone;
  const phone = settings?.phone_primary ?? legacyPhone ?? contact?.phone ?? null;
  const email = settings?.email ?? contact?.email ?? null;
  const address = settings?.address ?? contact?.address ?? null;
  const socialLinks = [
    ["ایتا", settings?.eitaa_url],
    ["تلگرام", settings?.telegram_url],
    ["اینستاگرام", settings?.instagram_url],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <footer dir="rtl" className="relative mt-auto overflow-hidden bg-[#071524] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(43,111,159,0.24),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(201,140,61,0.1),transparent_28%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.8fr_1fr]">
          <section className="flex flex-col justify-center border-b border-white/10 p-6 text-center sm:p-7 lg:min-h-full lg:border-b-0 lg:border-l lg:text-right">
            <div className="flex items-center justify-center gap-4 lg:justify-start">
              <BesatLogoMark size="md" tone="light" />
              <div className="min-w-0">
                <h2 className="text-xl font-black leading-9">
                  {settings?.school_name || "مجتمع آموزشی بعثت"}
                </h2>
                {settings?.slogan ? (
                  <p className="mt-1 text-xs font-bold leading-6 text-white/60">
                    {settings.slogan}
                  </p>
                ) : null}
              </div>
            </div>

            {settings?.intro_text ? (
              <p className="mt-5 max-w-xl text-sm font-bold leading-8 text-white/72 lg:max-w-none">
                {settings.intro_text}
              </p>
            ) : null}

            {socialLinks.length ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                {socialLinks.map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-xs font-black text-white/85 transition hover:border-[#e2ae5b]/50 hover:bg-[#e2ae5b]/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/30 motion-reduce:transition-none"
                  >
                    {label}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 lg:justify-start">
              {relatedSites.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-white/55 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e2ae5b]/30 motion-reduce:transition-none"
                >
                  {label}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ))}
            </div>
          </section>

          <nav
            aria-label="پیوندهای پاورقی"
            className="border-b border-white/10 p-6 text-right sm:p-7 lg:border-b-0 lg:border-l"
          >
            <h3 className="text-base font-black">دسترسی سریع</h3>
            <div className="mt-4 grid grid-cols-2 gap-1">
              {quickLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="group inline-flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-sm font-bold text-white/75 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 motion-reduce:transition-none"
                >
                  {label}
                  <ArrowUpLeft
                    aria-hidden="true"
                    className="size-3.5 text-white/35 transition group-hover:text-[#e2ae5b] motion-reduce:transition-none"
                  />
                </Link>
              ))}
            </div>
          </nav>

          <section className="p-6 text-right sm:p-7">
            <h3 className="text-base font-black">ارتباط با مجموعه</h3>
            {phone || email || address ? (
              <div className="mt-4 grid gap-2">
                {phone ? (
                  <a
                    href={telHref(phone)}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white/85 transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 motion-reduce:transition-none"
                  >
                    <Phone aria-hidden="true" className="size-5 shrink-0 text-[#e2ae5b]" />
                    <span dir="ltr" className="min-w-0 break-all">{phone}</span>
                  </a>
                ) : null}

                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white/85 transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 motion-reduce:transition-none"
                  >
                    <Mail aria-hidden="true" className="size-5 shrink-0 text-[#e2ae5b]" />
                    <span dir="ltr" className="min-w-0 break-all">{email}</span>
                  </a>
                ) : null}

                {address ? (
                  <p className="flex min-h-12 items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold leading-7 text-white/85">
                    <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-[#e2ae5b]" />
                    <span className="min-w-0 break-words">{address}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p role="status" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold leading-7 text-white/70">
                اطلاعات تماس مجموعه هنوز برای نمایش عمومی ثبت نشده است.
              </p>
            )}
          </section>
        </div>

        <div className="mt-5 border-t border-white/10 pt-5 text-center text-xs font-bold leading-6 text-white/50">
          <p>همه حقوق این وب‌سایت برای مجتمع آموزشی بعثت محفوظ است.</p>
        </div>
      </div>
    </footer>
  );
}
