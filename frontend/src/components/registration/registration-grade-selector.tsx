"use client";

import { useEffect, useMemo, useState } from "react";
import type { SchoolUnitRecord } from "@/lib/data/domain-types";
import { getRegistrationGradeOptionsForUnit } from "@/lib/registration/registration-grade-options";

type RegistrationGradeSelectorProps = {
  units: SchoolUnitRecord[] | null;
  selectedUnitId: string;
};

export function RegistrationGradeSelector({
  units,
  selectedUnitId,
}: RegistrationGradeSelectorProps) {
  const selectedUnit = useMemo(
    () => units?.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const gradeOptions = useMemo(
    () => getRegistrationGradeOptionsForUnit(selectedUnit),
    [selectedUnit],
  );

  const [selectedGrade, setSelectedGrade] = useState("");

  useEffect(() => {
    setSelectedGrade("");
  }, [selectedUnitId]);

  const disabled = !selectedUnit || gradeOptions.length === 0;

  return (
    <label className="block text-right">
      <span className="mb-2 block text-sm font-black text-[#062452]">
        پایه مورد نظر
        <span className="text-rose-600"> *</span>
      </span>

      <select
        key={selectedUnitId}
        name="requestedGrade"
        value={selectedGrade}
        onChange={(event) => setSelectedGrade(event.target.value)}
        required
        disabled={disabled}
        className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="" disabled>
          {selectedUnit ? "پایه را انتخاب کنید" : "ابتدا واحد را انتخاب کنید"}
        </option>

        {gradeOptions.map((grade) => (
          <option key={grade.value} value={grade.label}>
            {grade.label}
          </option>
        ))}
      </select>
    </label>
  );
}
