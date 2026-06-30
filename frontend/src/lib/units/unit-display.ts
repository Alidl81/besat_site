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

/**
 * فقط از شناسه، slug و title استفاده می‌کنیم.
 * description نباید وارد تشخیص شماره واحد شود.
 */
function unitIdentityText(unit: UnitDisplaySource) {
  return normalizeText(
    [
      unit.id ?? "",
      unit.slug ?? "",
      unit.title,
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
    /unit[-_ ]1[-_ ]2/,
    /واحد\s*1\s*و\s*2/,
    /واحد1و2/,
    /1\s*و\s*2/,
  ];

  if (combinedPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return hasExactUnitNumber(text, 1) || hasExactUnitNumber(text, 2);
}

export function getOfficialUnitShortTitle(unit: UnitDisplaySource) {
  const text = unitIdentityText(unit);

  if (isUnitOneAndTwo(text)) {
    return "واحد ۱ و ۲";
  }

  for (let unitNumber = 13; unitNumber >= 3; unitNumber -= 1) {
    if (hasExactUnitNumber(text, unitNumber)) {
      return `واحد ${toPersianDigits(String(unitNumber))}`;
    }
  }

  return unit.title;
}
