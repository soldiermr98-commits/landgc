export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const canHover = (): boolean => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toFaDigits = (value: string | number): string =>
  String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

/** Reads a JSON <script> element (used for runtime config, keeps the page free of inline JS). */
export function readJson<T>(selector: string, root: ParentNode = document): T | null {
  const node = root.querySelector<HTMLScriptElement>(selector);
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as T;
  } catch {
    return null;
  }
}
