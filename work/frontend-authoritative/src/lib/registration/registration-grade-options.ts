import type { SchoolUnitRecord } from "@/lib/data/domain-types";

export type RegistrationGradeOption = {
  value: string;
  label: string;
};

const pre1: RegistrationGradeOption = {
  value: "preschool_1",
  label: "پیش‌دبستانی ۱",
};

const pre2: RegistrationGradeOption = {
  value: "preschool_2",
  label: "پیش‌دبستانی ۲",
};

const kindergarten: RegistrationGradeOption = {
  value: "kindergarten",
  label: "کودکستان",
};

const grade1: RegistrationGradeOption = { value: "grade_1", label: "پایه اول" };
const grade2: RegistrationGradeOption = { value: "grade_2", label: "پایه دوم" };
const grade3: RegistrationGradeOption = { value: "grade_3", label: "پایه سوم" };
const grade4: RegistrationGradeOption = { value: "grade_4", label: "پایه چهارم" };
const grade5: RegistrationGradeOption = { value: "grade_5", label: "پایه پنجم" };
const grade6: RegistrationGradeOption = { value: "grade_6", label: "پایه ششم" };
const grade7: RegistrationGradeOption = { value: "grade_7", label: "پایه هفتم" };
const grade8: RegistrationGradeOption = { value: "grade_8", label: "پایه هشتم" };
const grade9: RegistrationGradeOption = { value: "grade_9", label: "پایه نهم" };
const grade10: RegistrationGradeOption = { value: "grade_10", label: "پایه دهم" };
const grade11: RegistrationGradeOption = { value: "grade_11", label: "پایه یازدهم" };
const grade12: RegistrationGradeOption = { value: "grade_12", label: "پایه دوازدهم" };

const elementaryAll = [grade1, grade2, grade3, grade4, grade5, grade6];
const middleSchool = [grade7, grade8, grade9];
const highSchool = [grade10, grade11, grade12];

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

function unitSearchText(unit: SchoolUnitRecord) {
  return normalizeText(
    [
      unit.id,
      unit.title,
      unit.slug,
      unit.kind,
      unit.gender,
      unit.description ?? "",
    ].join(" "),
  );
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function hasUnitNumber(text: string, unitNumber: number) {
  const n = String(unitNumber).padStart(2, "0");

  return (
    text.includes(`واحد ${unitNumber}`) ||
    text.includes(`واحد${unitNumber}`) ||
    text.includes(`unit-${unitNumber}`) ||
    text.includes(`unit-${n}`) ||
    text.includes(`unit_${unitNumber}`) ||
    text.includes(`unit_${n}`)
  );
}

function isBoysElementaryOneOrTwo(text: string) {
  return (
    hasAny(text, [
      "1و2",
      "1 و 2",
      "واحد 1و2",
      "واحد 1 و 2",
      "boys-elementary-1",
      "boys-elementary-2",
      "دبستان پسرانه بعثت 1",
      "دبستان پسرانه بعثت 2",
    ]) ||
    hasUnitNumber(text, 1) ||
    hasUnitNumber(text, 2)
  );
}

export function getRegistrationGradeOptionsForUnit(
  unit: SchoolUnitRecord | null | undefined,
): RegistrationGradeOption[] {
  if (!unit) {
    return [];
  }

  const text = unitSearchText(unit);

  if (hasUnitNumber(text, 13) || hasAny(text, ["کودکستان"])) {
    return [kindergarten];
  }

  if (isBoysElementaryOneOrTwo(text)) {
    return [pre2, grade1, grade2];
  }

  if (hasUnitNumber(text, 3)) {
    return [grade3, grade4, grade5, grade6];
  }

  if (hasUnitNumber(text, 4)) {
    return [pre1, pre2, grade1];
  }

  if (hasUnitNumber(text, 5)) {
    return [grade2, grade3, grade4, grade5, grade6];
  }

  if (hasUnitNumber(text, 6)) {
    return middleSchool;
  }

  if (hasUnitNumber(text, 7)) {
    return highSchool;
  }

  if (hasUnitNumber(text, 8)) {
    return [pre2, grade1, grade2];
  }

  if (hasUnitNumber(text, 9)) {
    return [pre2, ...elementaryAll];
  }

  if (hasUnitNumber(text, 10)) {
    return [grade2, grade3, grade4, grade5, grade6];
  }

  if (hasUnitNumber(text, 11)) {
    return middleSchool;
  }

  if (hasUnitNumber(text, 12)) {
    return [grade5, grade6];
  }

  if (hasAny(text, ["پیش دبستانی", "پیش‌دبستانی", "preschool"])) {
    return [pre1, pre2];
  }

  if (hasAny(text, ["دوره اول", "متوسطه اول", "middle_school"])) {
    return middleSchool;
  }

  if (hasAny(text, ["دوره دوم", "متوسطه دوم", "high_school", "دبیرستان"])) {
    return highSchool;
  }

  if (unit.kind === "elementary") {
    return elementaryAll;
  }

  if (unit.kind === "middle_school") {
    return middleSchool;
  }

  if (unit.kind === "high_school") {
    return highSchool;
  }

  if (unit.kind === "preschool") {
    return [pre1, pre2];
  }

  return [];
}
