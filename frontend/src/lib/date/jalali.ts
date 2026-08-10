import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

export { jalaaliMonthLength };

export type JalaaliDate = { jy: number; jm: number; jd: number };

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

// Persian week starts Saturday, index 0.
export const JALALI_WEEKDAY_NAMES = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
] as const;

export const JALALI_WEEKDAY_SHORT_NAMES = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoDateFromGregorian(gy: number, gm: number, gd: number): string {
  return `${String(gy).padStart(4, "0")}-${pad2(gm)}-${pad2(gd)}`;
}

// Saturday-first weekday index (0 = شنبه ... 6 = جمعه) for a Jalaali calendar date.
export function jalaaliWeekdayIndex(jy: number, jm: number, jd: number): number {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const gregorianDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  return (gregorianDay + 1) % 7;
}

export function todayJalaali(): JalaaliDate {
  const now = new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function jalaaliFromGregorianDate(date: Date): JalaaliDate {
  return toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaaliKey(jy: number, jm: number, jd: number): string {
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

// e.g. for an ISO datetime coming from the backend, the Jalaali day it falls on locally.
export function jalaaliKeyFromIso(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { jy, jm, jd } = jalaaliFromGregorianDate(date);
  return jalaaliKey(jy, jm, jd);
}

export function addJalaaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const totalMonths = jy * 12 + (jm - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  return { jy: nextYear, jm: nextMonth + 1 };
}

export function jalaaliMonthLabel(jy: number, jm: number): string {
  return `${JALALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;
}

export function formatJalaaliNumeric(jy: number, jm: number, jd: number): string {
  return toPersianDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`);
}

export function formatJalaaliLong(jy: number, jm: number, jd: number): string {
  const weekday = JALALI_WEEKDAY_NAMES[jalaaliWeekdayIndex(jy, jm, jd)];
  return `${weekday} ${toPersianDigits(jd)} ${JALALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;
}

// HTML datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, no offset.
export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function jalaaliToDateTimeLocalValue(jy: number, jm: number, jd: number, hour = 9, minute = 0): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return `${String(gy).padStart(4, "0")}-${pad2(gm)}-${pad2(gd)}T${pad2(hour)}:${pad2(minute)}`;
}

export function formatClockTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toPersianDigits(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
}

export type CalendarDayCell = {
  jy: number;
  jm: number;
  jd: number;
  key: string;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  weekdayIndex: number;
};

// A Saturday-first month grid, sized to the minimum number of full weeks that contain the month.
export function buildJalaaliMonthGrid(jy: number, jm: number): CalendarDayCell[] {
  const daysInMonth = jalaaliMonthLength(jy, jm);
  const leading = jalaaliWeekdayIndex(jy, jm, 1);
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

  const today = todayJalaali();
  const prev = addJalaaliMonths(jy, jm, -1);
  const prevMonthLength = jalaaliMonthLength(prev.jy, prev.jm);
  const next = addJalaaliMonths(jy, jm, 1);

  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < totalCells; index += 1) {
    let cellJy = jy;
    let cellJm = jm;
    let cellJd: number;
    let isCurrentMonth = true;

    if (index < leading) {
      cellJy = prev.jy;
      cellJm = prev.jm;
      cellJd = prevMonthLength - leading + index + 1;
      isCurrentMonth = false;
    } else if (index >= leading + daysInMonth) {
      cellJy = next.jy;
      cellJm = next.jm;
      cellJd = index - leading - daysInMonth + 1;
      isCurrentMonth = false;
    } else {
      cellJd = index - leading + 1;
    }

    const { gy, gm, gd } = toGregorian(cellJy, cellJm, cellJd);

    cells.push({
      jy: cellJy,
      jm: cellJm,
      jd: cellJd,
      key: jalaaliKey(cellJy, cellJm, cellJd),
      isoDate: isoDateFromGregorian(gy, gm, gd),
      isCurrentMonth,
      isToday: cellJy === today.jy && cellJm === today.jm && cellJd === today.jd,
      weekdayIndex: index % 7,
    });
  }

  return cells;
}
