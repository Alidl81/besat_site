"use client";

import {
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ContactForm } from "@/components/contact/contact-form";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  getContactInfo,
  getPublicUnits,
} from "@/services/public-content-service";
import type {
  ContactInfo,
  PublicSchoolUnit,
} from "@/types/public-content";

function ContactLine({
  icon,
  label,
  value,
  href,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string | null;
  ltr?: boolean;
}) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-500">{label}</span>
        <span dir={ltr ? "ltr" : undefined} className={`mt-1 block text-sm font-black leading-7 text-[#0f2f4a] ${ltr ? "text-left" : ""}`}>
          {value}
        </span>
      </span>
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-blue-300">
      {content}
    </a>
  ) : (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">{content}</div>
  );
}

function UnitContact({ unit }: { unit: PublicSchoolUnit }) {
  const hasContact = unit.address || unit.phone || unit.phone_secondary || unit.email || unit.office_hours || unit.map_url;
  if (!hasContact) return null;
  return (
    <article className="border-b border-slate-200 py-6 last:border-b-0">
      <h3 className="text-lg font-black text-[#0f2f4a]">{unit.title}</h3>
      <div className="mt-4 grid gap-3">
        {unit.address ? <ContactLine icon={<MapPin aria-hidden="true" className="size-5" />} label="نشانی" value={unit.address} /> : null}
        {unit.phone ? <ContactLine icon={<Phone aria-hidden="true" className="size-5" />} label="تلفن" value={unit.phone} href={`tel:${unit.phone.replace(/[^\d+]/g, "")}`} ltr /> : null}
        {unit.phone_secondary ? <ContactLine icon={<Phone aria-hidden="true" className="size-5" />} label="تلفن دوم" value={unit.phone_secondary} href={`tel:${unit.phone_secondary.replace(/[^\d+]/g, "")}`} ltr /> : null}
        {unit.email ? <ContactLine icon={<Mail aria-hidden="true" className="size-5" />} label="ایمیل" value={unit.email} href={`mailto:${unit.email}`} ltr /> : null}
        {unit.office_hours ? <ContactLine icon={<Clock3 aria-hidden="true" className="size-5" />} label="ساعات پاسخ‌گویی" value={unit.office_hours} /> : null}
        {unit.map_url ? <ContactLine icon={<ExternalLink aria-hidden="true" className="size-5" />} label="نقشه" value="مشاهده موقعیت روی نقشه" href={unit.map_url} /> : null}
      </div>
    </article>
  );
}

export function ContactPageContent() {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getContactInfo(), getPublicUnits()])
      .then(([contactInfo, schoolUnits]) => {
        if (cancelled) return;
        setError("");
        setContact(contactInfo);
        setUnits(schoolUnits);
      })
      .catch((reason) => {
        if (!cancelled) setError(getApiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-white p-8 text-center">
        <h2 className="text-xl font-black text-[#0f2f4a]">دریافت اطلاعات تماس انجام نشد</h2>
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
        <button type="button" onClick={() => {
          setContact(null);
          setError("");
          setVersion((value) => value + 1);
        }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#12395b] px-5 text-sm font-black text-white">
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div aria-busy="true" aria-label="در حال دریافت اطلاعات تماس" className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="h-[32rem] animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
        <div className="h-[32rem] animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-[#0f2f4a]">اطلاعات تماس</h2>
        {contact.description ? <p className="mt-3 text-sm font-bold leading-8 text-slate-600">{contact.description}</p> : null}
        <div className="mt-5 grid gap-3">
          {contact.address ? <ContactLine icon={<MapPin aria-hidden="true" className="size-5" />} label="نشانی مجتمع" value={contact.address} /> : null}
          {contact.phone ? <ContactLine icon={<Phone aria-hidden="true" className="size-5" />} label="تلفن مجتمع" value={contact.phone} href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} ltr /> : null}
          {contact.phone_secondary ? <ContactLine icon={<Phone aria-hidden="true" className="size-5" />} label="تلفن دوم" value={contact.phone_secondary} href={`tel:${contact.phone_secondary.replace(/[^\d+]/g, "")}`} ltr /> : null}
          {contact.email ? <ContactLine icon={<Mail aria-hidden="true" className="size-5" />} label="ایمیل" value={contact.email} href={`mailto:${contact.email}`} ltr /> : null}
          {contact.working_hours ? <ContactLine icon={<Clock3 aria-hidden="true" className="size-5" />} label="ساعات پاسخ‌گویی" value={contact.working_hours} /> : null}
          {contact.map_url ? <ContactLine icon={<ExternalLink aria-hidden="true" className="size-5" />} label="نقشه" value="مشاهده موقعیت روی نقشه" href={contact.map_url} /> : null}
        </div>

        {units.some((unit) => unit.address || unit.phone || unit.email) ? (
          <div className="mt-8 border-t border-slate-200 pt-2">
            <h2 className="py-5 text-xl font-black text-[#0f2f4a]">واحدهای آموزشی</h2>
            {units.map((unit) => <UnitContact key={unit.id} unit={unit} />)}
          </div>
        ) : null}
      </section>
      <ContactForm units={units} />
    </div>
  );
}
