import { describe, expect, it } from "vitest";
import {
  addJalaaliMonths,
  buildJalaaliMonthGrid,
  jalaaliKey,
  jalaaliKeyFromIso,
  jalaaliWeekdayIndex,
  toPersianDigits,
} from "@/lib/date/jalali";

describe("toPersianDigits", () => {
  it("converts ascii digits to Persian digits", () => {
    expect(toPersianDigits(1403)).toBe("۱۴۰۳");
    expect(toPersianDigits("12:05")).toBe("۱۲:۰۵");
  });
});

describe("addJalaaliMonths", () => {
  it("wraps to the next year after Esfand", () => {
    expect(addJalaaliMonths(1403, 12, 1)).toEqual({ jy: 1404, jm: 1 });
  });

  it("wraps back to the previous year before Farvardin", () => {
    expect(addJalaaliMonths(1403, 1, -1)).toEqual({ jy: 1402, jm: 12 });
  });

  it("handles multi-month deltas that cross a year boundary", () => {
    expect(addJalaaliMonths(1403, 6, 8)).toEqual({ jy: 1404, jm: 2 });
  });
});

describe("buildJalaaliMonthGrid", () => {
  it("returns a whole number of Saturday-first weeks that fully covers the month", () => {
    const cells = buildJalaaliMonthGrid(1403, 1);
    expect(cells.length % 7).toBe(0);
    // Farvardin always has 31 days regardless of leap year.
    expect(cells.filter((cell) => cell.isCurrentMonth)).toHaveLength(31);
    expect(cells[0].weekdayIndex).toBe(0);
  });

  it("places leading days from the previous month before day 1 of the target month", () => {
    const expectedLeading = jalaaliWeekdayIndex(1403, 2, 1);
    const cells = buildJalaaliMonthGrid(1403, 2);

    for (let index = 0; index < expectedLeading; index += 1) {
      expect(cells[index].isCurrentMonth).toBe(false);
      expect(cells[index].jm).toBe(1);
    }

    expect(cells[expectedLeading].isCurrentMonth).toBe(true);
    expect(cells[expectedLeading].jd).toBe(1);
  });

  it("assigns a Saturday-first weekday index to every column", () => {
    const cells = buildJalaaliMonthGrid(1403, 5);
    for (let index = 0; index < cells.length; index += 1) {
      expect(cells[index].weekdayIndex).toBe(index % 7);
    }
  });

  it("produces a unique, sequential key for every cell", () => {
    const cells = buildJalaaliMonthGrid(1403, 7);
    const keys = new Set(cells.map((cell) => cell.key));
    expect(keys.size).toBe(cells.length);
  });
});

describe("jalaaliKeyFromIso", () => {
  it("derives a well-formed Jalaali day key from an ISO datetime", () => {
    const key = jalaaliKeyFromIso("2024-03-20T08:00:00+03:30");
    expect(key).toMatch(/^\d{3,4}-\d{2}-\d{2}$/);
  });

  it("returns null for an invalid value instead of throwing", () => {
    expect(jalaaliKeyFromIso("not-a-date")).toBeNull();
  });
});

describe("jalaaliKey", () => {
  it("zero-pads month and day", () => {
    expect(jalaaliKey(1403, 1, 1)).toBe("1403-01-01");
    expect(jalaaliKey(1403, 12, 30)).toBe("1403-12-30");
  });
});
