/**
 * Mirrors backend/apps/shop/money.py. The backend is the source of truth
 * for every amount (always an integer rial) -- this module only knows
 * how to *display* one, using the same TEMPORARY divisor/unit-word the
 * backend currently assumes (toman), pending the product owner's
 * rial-vs-toman decision. If that backend constant changes, this file
 * must be updated to match (no shared codegen exists in this repo).
 */

export const DISPLAY_CURRENCY: "IRT" | "IRR" = "IRT";
const RIAL_PER_TOMAN = 10;
const DISPLAY_DIVISOR = DISPLAY_CURRENCY === "IRT" ? RIAL_PER_TOMAN : 1;
const CURRENCY_WORD = DISPLAY_CURRENCY === "IRT" ? "تومان" : "ریال";

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function toDisplayAmount(amountRial: number | null | undefined): number | null {
  if (amountRial === null || amountRial === undefined) return null;
  return Math.floor(amountRial / DISPLAY_DIVISOR);
}

/** Digit-grouped number only, Persian numerals, no currency word -- for
 * places that compose their own "X تومان" / "X ریال" string. */
export function formatAmount(amountRial: number | null | undefined): string {
  const displayAmount = toDisplayAmount(amountRial);
  if (displayAmount === null) return "—";
  return numberFormatter.format(displayAmount);
}

/** Full "X تومان" string for direct display. */
export function formatPrice(amountRial: number | null | undefined): string {
  const formatted = formatAmount(amountRial);
  return formatted === "—" ? formatted : `${formatted} ${CURRENCY_WORD}`;
}
