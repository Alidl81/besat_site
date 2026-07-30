"use client";

import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { BesatLogoMark } from "@/components/shared/besat-logo";
import { getPublicSiteSettings } from "@/services/public-content-service";
import type { PublicSiteSettings } from "@/types/public-content";

const quickLinks = [
  ["واحدهای آموزشی", "/units"],
  ["اخبار", "/news"],
  ["افتخارات", "/achievements"],
  ["گالری", "/gallery"],
  ["درباره ما", "/about"],
  ["تماس با ما", "/contact"],
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

  const social = [
    ["ایتا", settings?.eitaa_url],
    ["تلگرام", settings?.telegram_url],
    ["اینستاگرام", settings?.instagram_url],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <footer dir="rtl" className="mt-auto bg-[#071524] text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_0.8fr_1fr] lg:py-10">
        <section className="text-right">
          <div className="flex items-center gap-3">
            <BesatLogoMark size="md" tone="light" />
            <div>
              <h2 className="text-lg font-black">{settings?.school_name || "مجتمع آموزشی بعثت"}</h2>
              {settings?.slogan ? <p className="mt-1 text-xs font-bold text-white/70">{settings.slogan}</p> : null}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {social.map(([label, href]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-black text-white transition hover:bg-white/10">
                {label}
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ))}
          </div>
        </section>

        <nav aria-label="پیوندهای پاورقی" className="grid grid-cols-2 content-start gap-x-5 gap-y-2 text-right">
          {quickLinks.map(([label, href]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center text-sm font-bold text-white/80 transition hover:text-white">
              {label}
            </Link>
          ))}
        </nav>

        <section className="space-y-3 text-right">
          {settings?.phone_primary ? (
            <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="flex min-h-11 items-center gap-3 text-sm font-bold text-white/85">
              <Phone aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
              <span dir="ltr">{settings.phone_primary}</span>
            </a>
          ) : null}
          {settings?.email ? (
            <a href={`mailto:${settings.email}`} className="flex min-h-11 items-center gap-3 text-sm font-bold text-white/85">
              <Mail aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
              <span dir="ltr">{settings.email}</span>
            </a>
          ) : null}
          {settings?.address ? (
            <p className="flex items-start gap-3 text-sm font-bold leading-7 text-white/85">
              <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-cyan-300" />
              {settings.address}
            </p>
          ) : null}
        </section>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-xs font-bold text-white/60">
        همه حقوق این وب‌سایت برای مجتمع آموزشی بعثت محفوظ است.
      </div>
    </footer>
  );
}
