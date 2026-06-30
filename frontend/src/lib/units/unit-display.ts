type UnitDisplaySource = {
  id?: string | number;
  slug?: string | null;
  title: string;
  description?: string | null;
  kind?: string | null;
  gender?: string | null;
};

function toPersianDigits(value: string) {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
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

function unitSearchText(unit: UnitDisplaySource) {
  return normalizeText(
    [
      unit.id ?? "",
      unit.slug ?? "",
      unit.title,
      unit.description ?? "",
      unit.kind ?? "",
      unit.gender ?? "",
    ].join(" "),
  );
}

function hasUnitNumber(text: string, unitNumber: number) {
  const n = String(unitNumber);
  const padded = n.padStart(2, "0");

  return (
    text.includes(`unit-${n}`) ||
    text.includes(`unit-${padded}`) ||
    text.includes(`unit_${n}`) ||
    text.includes(`unit_${padded}`) ||
    text.includes(`واحد ${n}`) ||
    text.includes(`واحد${n}`)
  );
}

export function getOfficialUnitShortTitle(unit: UnitDisplaySource) {
  const text = unitSearchText(unit);

  if (
    text.includes("unit-01-02") ||
    text.includes("unit_01_02") ||
    text.includes("1و2") ||
    text.includes("1 و 2") ||
    text.includes("واحد 1و2") ||
    text.includes("واحد 1 و 2")
  ) {
    return "واحد ۱ و ۲";
  }

  for (let unitNumber = 3; unitNumber <= 13; unitNumber += 1) {
    if (hasUnitNumber(text, unitNumber)) {
      return `واحد ${toPersianDigits(String(unitNumber))}`;
    }
  }

  if (hasUnitNumber(text, 1) || hasUnitNumber(text, 2)) {
    return "واحد ۱ و ۲";
  }

  return unit.title;
}
