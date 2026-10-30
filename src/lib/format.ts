const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Converts Latin digits to Persian digits («12» → «۱۲»). */
export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Two-digit Persian index («1» → «۰۱»). */
export function faIndex(n: number): string {
  return toFaDigits(String(n).padStart(2, '0'));
}
