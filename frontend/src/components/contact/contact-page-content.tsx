"use client";

import {
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ContactForm } from "@/components/contact/contact-form";
import { ContactUnitSelector } from "@/components/contact/contact-unit-selector";
import { getApiErrorMessage } from "@/lib/api/client";
import { getContactInfo, getPublicUnits } from "@/services/public-content-service";
import type { ContactInfo, PublicSchoolUnit } from "@/types/public-content";

function telHref(value: string) {
  const primaryNumber = value.split(/\(|\[|داخلی/i, 1)[0];
  const normalized = primaryNumber.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const phone = normalized.replace(/[^\d+]/g, "");

  return phone ? `tel:${phone}` : undefined;
}

function ContactLine({
  icon,
  label,
  value,
  href,
  ltr = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  ltr?: boolean;
}) {
  const external = Boolean(href?.startsWith("http://") || href?.startsWith("https://"));

  return (
    <div className="flex items-start gap-3 border-t border-[#e4e6e5] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#edf3f8] text-[#0b4b7a]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-slate-500">{label}</span>
        {href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            dir={ltr ? "ltr" : undefined}
            className={`mt-1 inline-flex max-w-full items-center gap-2 break-words text-sm font-black leading-7 text-[#0f2f4a] underline decoration-[#d9aa62] decoration-2 underline-offset-4 transition hover:text-[#9d631b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 motion-reduce:transition-none ${ltr ? "text-left" : ""}`}
          >
            {value}
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-[#b97827]" />
          </a>
        ) : (
          <span
            dir={ltr ? "ltr" : undefined}
            className={`mt-1 block break-words text-sm font-black leading-7 text-[#0f2f4a] ${ltr ? "text-left" : ""}`}
          >
            {value}
          </span>
        )}
      </span>
    </div>
  );
}

export function ContactPageContent() {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [units, setUnits] = useState<PublicSchoolUnit[] | null>(null);
  const [unitsError, setUnitsError] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getContactInfo()
      .then((contactInfo) => {
        if (cancelled) return;
        setError("");
        setContact(contactInfo);
      })
      .catch((reason) => {
        if (!cancelled) setError(getApiErrorMessage(reason));
      });

    getPublicUnits()
      .then((publicUnits) => {
        if (cancelled) return;
        setUnitsError(false);
        setUnits(publicUnits);
      })
      .catch(() => {
        if (cancelled) return;
        setUnitsError(true);
        setUnits([]);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  if (error) {
    return (
      <div role="alert" className="rounded-[1.5rem] border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-black text-[#0f2f4a]">دریافت اطلاعات تماس انجام نشد</h2>
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setContact(null);
            setUnits(null);
            setUnitsError(false);
            setError("");
            setVersion((value) => value + 1);
          }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12395b] px-5 text-sm font-black text-white transition hover:bg-[#0d2f4d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div role="status" aria-busy="true" aria-label="در حال دریافت اطلاعات تماس" className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="h-[25rem] animate-pulse rounded-[1.5rem] bg-slate-200 motion-reduce:animate-none" />
        <div className="h-[25rem] animate-pulse rounded-[1.5rem] bg-slate-200 motion-reduce:animate-none" />
      </div>
    );
  }

  const hasDetails = Boolean(contact.address || contact.phone || contact.phone_secondary || contact.email);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid min-w-0 gap-6">
        <section aria-labelledby="central-contact-title" className="rounded-[1.5rem] border border-[#e0e4e6] bg-white p-6 shadow-[0_14px_40px_rgba(15,35,57,0.06)] sm:p-8">
          <p className="text-xs font-black tracking-[0.16em] text-[#8a641f]">ارتباط مستقیم</p>
          <h2 id="central-contact-title" className="mt-3 text-2xl font-black leading-[1.45] text-[#0f2f4a]">با مجتمع بعثت در تماس باشید</h2>
          <p className="mt-3 text-sm font-bold leading-8 text-slate-600">
            برای پرسش، پیشنهاد یا پیگیری، از راه‌های ارتباطی رسمی زیر استفاده کنید. پیام‌های عمومی نیز از فرم همین صفحه دریافت می‌شوند.
          </p>

          {hasDetails ? (
            <div className="mt-7">
              {contact.address ? (
                <ContactLine icon={<MapPin aria-hidden="true" className="size-4" />} label="نشانی مجموعه" value={contact.address} />
              ) : null}
              {contact.phone ? (
                <ContactLine icon={<Phone aria-hidden="true" className="size-4" />} label="تلفن مجموعه" value={contact.phone} href={telHref(contact.phone)} ltr />
              ) : null}
              {contact.phone_secondary ? (
                <ContactLine icon={<Phone aria-hidden="true" className="size-4" />} label="تلفن دوم" value={contact.phone_secondary} href={telHref(contact.phone_secondary)} ltr />
              ) : null}
              {contact.email ? (
                <ContactLine icon={<Mail aria-hidden="true" className="size-4" />} label="ایمیل" value={contact.email} href={`mailto:${contact.email}`} ltr />
              ) : null}
            </div>
          ) : (
            <p role="status" className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold leading-7 text-slate-600">
              اطلاعات تماس عمومی هنوز ثبت نشده است؛ پیام خود را از فرم روبه‌رو ارسال کنید.
            </p>
          )}
        </section>

        <ContactUnitSelector units={units} error={unitsError} />
      </div>

      <ContactForm />
    </div>
  );
}
