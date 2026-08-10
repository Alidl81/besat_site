"use client";

import Link from "next/link";
import {
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

function telHref(value: string) {
  const normalized = value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const phone = normalized.replace(/[^\d+]/g, "");

  return phone ? `tel:${phone}` : undefined;
}

function hasContactDetails(
  source: Pick<
    PublicSchoolUnit,
    | "address"
    | "phone"
    | "phone_secondary"
    | "email"
    | "office_hours"
    | "map_url"
  >,
) {
  return Boolean(
    source.address ||
      source.phone ||
      source.phone_secondary ||
      source.email ||
      source.office_hours ||
      source.map_url,
  );
}

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
  const external = Boolean(href?.startsWith("http://") || href?.startsWith("https://"));
  const className =
    "flex min-h-12 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right transition hover:border-[#d9aa62] hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 motion-reduce:transition-none";
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3f8] text-[#0b4b7a]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-slate-500">{label}</span>
        <span
          dir={ltr ? "ltr" : undefined}
          className={`mt-1 block break-words text-sm font-black leading-7 text-[#0f2f4a] ${
            ltr ? "text-left" : ""
          }`}
        >
          {value}
        </span>
      </span>
      {href ? <ExternalLink aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#b97827]" /> : null}
    </>
  );

  return href ? (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={`${label}: ${value}`}
      className={className}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function UnitDetails({ unit }: { unit: PublicSchoolUnit }) {
  const hasDetails = hasContactDetails(unit);

  return (
    <article
      aria-live="polite"
      className="rounded-[1.5rem] border border-[#dbe7f0] bg-[#f8fbfd] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#b97827]">واحد انتخاب‌شده</p>
          <h3 className="mt-1 text-xl font-black text-[#0f2f4a]">{unit.title}</h3>
          {unit.subtitle ? (
            <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{unit.subtitle}</p>
          ) : null}
        </div>
        {unit.accepts_registration ? (
          <Link
            href={`/registration?unit=${encodeURIComponent(unit.slug)}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-[#d9aa62] bg-amber-50 px-4 text-sm font-black text-[#82490a] transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 motion-reduce:transition-none"
          >
            پیش‌ثبت‌نام این واحد
          </Link>
        ) : null}
      </div>

      {hasDetails ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {unit.address ? (
            <ContactLine
              icon={<MapPin aria-hidden="true" className="size-5" />}
              label="نشانی"
              value={unit.address}
            />
          ) : null}
          {unit.phone ? (
            <ContactLine
              icon={<Phone aria-hidden="true" className="size-5" />}
              label="تلفن"
              value={unit.phone}
              href={telHref(unit.phone)}
              ltr
            />
          ) : null}
          {unit.phone_secondary ? (
            <ContactLine
              icon={<Phone aria-hidden="true" className="size-5" />}
              label="تلفن دوم"
              value={unit.phone_secondary}
              href={telHref(unit.phone_secondary)}
              ltr
            />
          ) : null}
          {unit.email ? (
            <ContactLine
              icon={<Mail aria-hidden="true" className="size-5" />}
              label="ایمیل"
              value={unit.email}
              href={`mailto:${unit.email}`}
              ltr
            />
          ) : null}
          {unit.office_hours ? (
            <ContactLine
              icon={<Clock3 aria-hidden="true" className="size-5" />}
              label="ساعات پاسخ‌گویی"
              value={unit.office_hours}
            />
          ) : null}
          {unit.map_url ? (
            <ContactLine
              icon={<MapPin aria-hidden="true" className="size-5" />}
              label="موقعیت"
              value="مشاهده موقعیت روی نقشه"
              href={unit.map_url}
            />
          ) : null}
        </div>
      ) : (
        <p role="status" className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-7 text-slate-600">
          اطلاعات تماس این واحد هنوز برای نمایش عمومی ثبت نشده است. برای پیگیری، پیام خود را از فرم این صفحه ارسال کنید.
        </p>
      )}
    </article>
  );
}

export function ContactPageContent() {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getContactInfo(), getPublicUnits()])
      .then(([contactInfo, schoolUnits]) => {
        if (cancelled) {
          return;
        }

        const firstWithContact = schoolUnits.find((unit) => hasContactDetails(unit));

        setError("");
        setContact(contactInfo);
        setUnits(schoolUnits);
        setSelectedUnitId((current) =>
          schoolUnits.some((unit) => String(unit.id) === current)
            ? current
            : String(firstWithContact?.id ?? schoolUnits[0]?.id ?? ""),
        );
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(getApiErrorMessage(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  const selectedUnit = useMemo(
    () => units.find((unit) => String(unit.id) === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );
  const contactUnits = useMemo(
    () => units.filter((unit) => hasContactDetails(unit)),
    [units],
  );
  const hasPrimaryDetails = Boolean(
    contact?.address ||
      contact?.phone ||
      contact?.phone_secondary ||
      contact?.email ||
      contact?.working_hours ||
      contact?.map_url,
  );

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[1.75rem] border border-rose-200 bg-white p-8 text-center shadow-sm"
      >
        <h2 className="text-xl font-black text-[#0f2f4a]">
          دریافت اطلاعات تماس انجام نشد
        </h2>
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setContact(null);
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
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="در حال دریافت اطلاعات تماس"
        className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="h-[32rem] animate-pulse rounded-[1.75rem] bg-slate-200 motion-reduce:animate-none" />
        <div className="h-[32rem] animate-pulse rounded-[1.75rem] bg-slate-200 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <section
          aria-labelledby="complex-contact-title"
          className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,35,57,0.08)] sm:p-8"
        >
          <p className="text-sm font-black text-[#b97827]">ارتباط با مجموعه</p>
          <h2 id="complex-contact-title" className="mt-2 text-2xl font-black text-[#0f2f4a]">
            {contact.title || "راه‌های ارتباط با مجتمع"}
          </h2>
          {contact.description ? (
            <p className="mt-3 max-w-prose text-sm font-bold leading-8 text-slate-600">
              {contact.description}
            </p>
          ) : null}

          {hasPrimaryDetails ? (
            <div className="mt-6 grid gap-3">
              {contact.address ? (
                <ContactLine
                  icon={<MapPin aria-hidden="true" className="size-5" />}
                  label="نشانی مجموعه"
                  value={contact.address}
                />
              ) : null}
              {contact.phone ? (
                <ContactLine
                  icon={<Phone aria-hidden="true" className="size-5" />}
                  label="تلفن مجموعه"
                  value={contact.phone}
                  href={telHref(contact.phone)}
                  ltr
                />
              ) : null}
              {contact.phone_secondary ? (
                <ContactLine
                  icon={<Phone aria-hidden="true" className="size-5" />}
                  label="تلفن دوم"
                  value={contact.phone_secondary}
                  href={telHref(contact.phone_secondary)}
                  ltr
                />
              ) : null}
              {contact.email ? (
                <ContactLine
                  icon={<Mail aria-hidden="true" className="size-5" />}
                  label="ایمیل"
                  value={contact.email}
                  href={`mailto:${contact.email}`}
                  ltr
                />
              ) : null}
              {contact.working_hours ? (
                <ContactLine
                  icon={<Clock3 aria-hidden="true" className="size-5" />}
                  label="ساعات پاسخ‌گویی"
                  value={contact.working_hours}
                />
              ) : null}
              {contact.map_url ? (
                <ContactLine
                  icon={<MapPin aria-hidden="true" className="size-5" />}
                  label="موقعیت مجموعه"
                  value="مشاهده موقعیت روی نقشه"
                  href={contact.map_url}
                />
              ) : null}
            </div>
          ) : (
            <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-600">
              اطلاعات تماس مجموعه هنوز برای نمایش عمومی ثبت نشده است. می‌توانید پیام خود را از فرم این صفحه ارسال کنید.
            </p>
          )}

          <aside className="mt-6 rounded-2xl border border-[#f0dfc5] bg-[#fffaf1] p-4 text-sm font-bold leading-7 text-[#67420e]">
            برای پیگیری دقیق‌تر، واحد مرتبط و موضوع پیام را وارد کنید. از فرم همین صفحه برای درخواست‌های عمومی، پیشنهاد، انتقاد، شکایت یا بازخورد استفاده کنید.
          </aside>
        </section>

        <section
          aria-labelledby="unit-directory-title"
          className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,35,57,0.08)] sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[#b97827]">واحدهای آموزشی</p>
              <h2 id="unit-directory-title" className="mt-2 text-2xl font-black text-[#0f2f4a]">
                انتخاب واحد و مشاهده جزئیات
              </h2>
            </div>
            <label className="w-full sm:w-[min(100%,19rem)]">
              <span className="sr-only">انتخاب واحد آموزشی</span>
              <select
                value={selectedUnitId}
                onChange={(event) => setSelectedUnitId(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-[#0f2f4a] outline-none transition focus:border-[#b97827] focus:ring-4 focus:ring-amber-100 motion-reduce:transition-none"
              >
                {units.length === 0 ? <option value="">واحدی برای انتخاب وجود ندارد</option> : null}
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {contactUnits.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {contactUnits.map((unit) => {
                const selected = String(unit.id) === selectedUnitId;

                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => setSelectedUnitId(String(unit.id))}
                    aria-pressed={selected}
                    className={`min-h-16 rounded-2xl border px-4 py-3 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 motion-reduce:transition-none ${
                      selected
                        ? "border-[#d39d4c] bg-amber-50 text-[#6d3d08]"
                        : "border-slate-200 bg-white text-[#0f2f4a] hover:border-[#d9aa62] hover:bg-amber-50/40"
                    }`}
                  >
                    <span className="block text-sm font-black">{unit.title}</span>
                    {unit.address ? (
                      <span className="mt-1 block line-clamp-1 text-xs font-bold text-slate-500">
                        {unit.address}
                      </span>
                    ) : unit.phone ? (
                      <span dir="ltr" className="mt-1 block text-left text-xs font-bold text-slate-500">
                        {unit.phone}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : units.length ? (
            <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-600">
              اطلاعات تماس واحدها هنوز برای نمایش عمومی ثبت نشده است. واحد مورد نظر را از فهرست انتخاب کنید و پیام خود را از فرم پایین صفحه بفرستید.
            </p>
          ) : (
            <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-600">
              واحد آموزشی قابل‌نمایش از سرویس دریافت نشد.
            </p>
          )}

          {selectedUnit ? <div className="mt-6"><UnitDetails unit={selectedUnit} /></div> : null}
        </section>
      </div>

      <ContactForm
        key={selectedUnit ? String(selectedUnit.id) : "no-unit"}
        units={units}
        selectedUnitId={selectedUnit ? String(selectedUnit.id) : undefined}
      />
    </div>
  );
}
