"use client";

import { useEffect, useMemo, useState } from "react";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";

type RegistrationGradeSelectorProps = {
  units: SchoolUnitRecord[] | null;
  selectedUnitId: string;
};

type GradeOption = {
  value: string;
  label: string;
};

const GRADE_OPTIONS = {
  kindergarten: [{ value: "کودکستان", label: "کودکستان" }],
  preschool1: [{ value: "پیش‌دبستانی ۱", label: "پیش‌دبستانی ۱" }],
  preschool2: [{ value: "پیش‌دبستانی ۲", label: "پیش‌دبستانی ۲" }],
  grade1: [{ value: "پایه اول", label: "پایه اول" }],
  grade2: [{ value: "پایه دوم", label: "پایه دوم" }],
  grade3: [{ value: "پایه سوم", label: "پایه سوم" }],
  grade4: [{ value: "پایه چهارم", label: "پایه چهارم" }],
  grade5: [{ value: "پایه پنجم", label: "پایه پنجم" }],
  grade6: [{ value: "پایه ششم", label: "پایه ششم" }],
  grade7: [{ value: "پایه هفتم", label: "پایه هفتم" }],
  grade8: [{ value: "پایه هشتم", label: "پایه هشتم" }],
  grade9: [{ value: "پایه نهم", label: "پایه نهم" }],
  grade10: [{ value: "پایه دهم", label: "پایه دهم" }],
  grade11: [{ value: "پایه یازدهم", label: "پایه یازدهم" }],
  grade12: [{ value: "پایه دوازدهم", label: "پایه دوازدهم" }],
} satisfies Record<string, GradeOption[]>;

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-5 transition-transform duration-300 ease-out ${
        isOpen ? "rotate-180" : "rotate-0"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function normalizeText(value: string) {
  return value
    .replace(/[۰٠]/g, "0")
    .replace(/[۱١]/g, "1")
    .replace(/[۲٢]/g, "2")
    .replace(/[۳٣]/g, "3")
    .replace(/[۴٤]/g, "4")
    .replace(/[۵٥]/g, "5")
    .replace(/[۶٦]/g, "6")
    .replace(/[۷٧]/g, "7")
    .replace(/[۸٨]/g, "8")
    .replace(/[۹٩]/g, "9")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unitIdentityText(unit: SchoolUnitRecord) {
  return normalizeText(
    [
      unit.id ?? "",
      unit.slug ?? "",
      unit.title ?? "",
    ].join(" "),
  );
}

function hasExactUnitNumber(text: string, unitNumber: number) {
  const n = String(unitNumber);
  const padded = n.padStart(2, "0");

  const patterns = [
    new RegExp(`(^|[^0-9])unit[-_ ]${n}($|[^0-9])`),
    new RegExp(`(^|[^0-9])unit[-_ ]${padded}($|[^0-9])`),
    new RegExp(`(^|[^0-9])واحد\\s*${n}($|[^0-9])`),
    new RegExp(`(^|[^0-9])واحد${n}($|[^0-9])`),
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function isUnitOneAndTwo(text: string) {
  const combinedPatterns = [
    /unit[-_ ]0?1[-_ ]0?2/,
    /unit[-_ ]0?1[-_ ]و[-_ ]0?2/,
    /واحد\s*1\s*و\s*2/,
    /واحد1و2/,
    /1\s*و\s*2/,
  ];

  if (combinedPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return hasExactUnitNumber(text, 1) || hasExactUnitNumber(text, 2);
}

function mergeOptions(...groups: GradeOption[][]) {
  return groups.flat();
}

function getGradeOptionsForUnit(unit: SchoolUnitRecord | null): GradeOption[] {
  if (!unit) {
    return [];
  }

  const text = unitIdentityText(unit);

  if (isUnitOneAndTwo(text)) {
    return mergeOptions(
      GRADE_OPTIONS.preschool2,
      GRADE_OPTIONS.grade1,
      GRADE_OPTIONS.grade2,
    );
  }

  if (hasExactUnitNumber(text, 3)) {
    return mergeOptions(
      GRADE_OPTIONS.grade3,
      GRADE_OPTIONS.grade4,
      GRADE_OPTIONS.grade5,
      GRADE_OPTIONS.grade6,
    );
  }

  if (hasExactUnitNumber(text, 4)) {
    return mergeOptions(
      GRADE_OPTIONS.preschool1,
      GRADE_OPTIONS.preschool2,
      GRADE_OPTIONS.grade1,
    );
  }

  if (hasExactUnitNumber(text, 5)) {
    return mergeOptions(
      GRADE_OPTIONS.grade2,
      GRADE_OPTIONS.grade3,
      GRADE_OPTIONS.grade4,
      GRADE_OPTIONS.grade5,
      GRADE_OPTIONS.grade6,
    );
  }

  if (hasExactUnitNumber(text, 6)) {
    return mergeOptions(
      GRADE_OPTIONS.grade7,
      GRADE_OPTIONS.grade8,
      GRADE_OPTIONS.grade9,
    );
  }

  if (hasExactUnitNumber(text, 7)) {
    return mergeOptions(
      GRADE_OPTIONS.grade10,
      GRADE_OPTIONS.grade11,
      GRADE_OPTIONS.grade12,
    );
  }

  if (hasExactUnitNumber(text, 8)) {
    return mergeOptions(
      GRADE_OPTIONS.preschool2,
      GRADE_OPTIONS.grade1,
      GRADE_OPTIONS.grade2,
    );
  }

  if (hasExactUnitNumber(text, 9)) {
    return mergeOptions(
      GRADE_OPTIONS.preschool2,
      GRADE_OPTIONS.grade1,
      GRADE_OPTIONS.grade2,
      GRADE_OPTIONS.grade3,
      GRADE_OPTIONS.grade4,
      GRADE_OPTIONS.grade5,
      GRADE_OPTIONS.grade6,
    );
  }

  if (hasExactUnitNumber(text, 10)) {
    return mergeOptions(
      GRADE_OPTIONS.grade2,
      GRADE_OPTIONS.grade3,
      GRADE_OPTIONS.grade4,
      GRADE_OPTIONS.grade5,
      GRADE_OPTIONS.grade6,
    );
  }

  if (hasExactUnitNumber(text, 11)) {
    return mergeOptions(
      GRADE_OPTIONS.grade7,
      GRADE_OPTIONS.grade8,
      GRADE_OPTIONS.grade9,
    );
  }

  if (hasExactUnitNumber(text, 12)) {
    return mergeOptions(
      GRADE_OPTIONS.grade5,
      GRADE_OPTIONS.grade6,
    );
  }

  if (hasExactUnitNumber(text, 13)) {
    return GRADE_OPTIONS.kindergarten;
  }

  return [];
}

export function RegistrationGradeSelector({
  units,
  selectedUnitId,
}: RegistrationGradeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState("");

  const selectedUnit = useMemo(
    () => units?.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const options = useMemo(
    () => getGradeOptionsForUnit(selectedUnit),
    [selectedUnit],
  );

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedGrade) ?? null,
    [options, selectedGrade],
  );

  const isDisabled = !selectedUnit || options.length === 0;

  useEffect(() => {
    setSelectedGrade("");
    setIsOpen(false);
  }, [selectedUnitId]);

  return (
    <label className="block text-right">
      <span className="mb-2 block text-sm font-black text-[#062452]">
        پایه مورد نظر <span className="text-rose-500">*</span>
      </span>

      <input type="hidden" name="requestedGrade" value={selectedGrade} />

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (!isDisabled) {
              setIsOpen((current) => !current);
            }
          }}
          aria-expanded={isOpen}
          disabled={isDisabled}
          className={`relative flex h-[3.7rem] w-full items-center justify-between rounded-2xl border bg-white px-4 pl-14 pr-4 text-right text-sm font-black outline-none transition-all duration-300 ease-out ${
            isOpen
              ? "border-emerald-400 text-[#062452] shadow-[0_14px_35px_rgba(16,185,129,0.14)]"
              : "border-slate-200 text-[#062452] shadow-sm"
          } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <span>
            {selectedOption
              ? selectedOption.label
              : selectedUnit
                ? "پایه را انتخاب کنید"
                : "ابتدا واحد را انتخاب کنید"}
          </span>

          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#062452]">
            <ChevronIcon isOpen={isOpen} />
          </span>
        </button>

        <div
          className={`mt-2 overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-out ${
            isOpen
              ? "max-h-[18rem] translate-y-0 border-slate-200 opacity-100 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
              : "max-h-0 translate-y-1 border-transparent opacity-0 shadow-none"
          }`}
        >
          <div className="max-h-[16rem] overflow-y-auto overscroll-contain py-2">
            {options.length > 0 ? (
              options.map((option) => {
                const isActive = option.value === selectedGrade;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedGrade(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-right text-sm font-black transition duration-200 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-[#062452] hover:bg-slate-50"
                    }`}
                  >
                    <span>{option.label}</span>

                    {isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.65rem] font-black text-emerald-700">
                        انتخاب شده
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-4 text-right text-sm font-bold text-slate-500">
                موردی برای نمایش وجود ندارد.
              </div>
            )}
          </div>
        </div>
      </div>
    </label>
  );
}
