import type { PriceView, ProductView, StoreProduct } from './types';

const parser = new DOMParser();
const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/** HTML → plain text (DOMParser documents are inert: no scripts run, nothing loads). */
function htmlToText(html = ''): string {
  if (!html) return '';
  const text = parser.parseFromString(html, 'text/html').body.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[،,.؛:]+$/, '')}…`;
}

/** Accept only http(s) URLs coming from the API. */
function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function safeSrcset(srcset = ''): string {
  return srcset
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      const [candidate] = part.split(/\s+/);
      return safeUrl(candidate) !== null;
    })
    .join(', ');
}

const NUMBERED = /^\s*[0-9۰-۹]{1,2}\s*[.)\-–:]\s*/;

/**
 * Pulls the product's own numbered feature headings («۱. …», «۲. …») out of its
 * WooCommerce description, so the featured card shows real highlights, never invented ones.
 */
export function extractHighlights(html = '', max = 3): string[] {
  if (!html) return [];
  const doc = parser.parseFromString(html, 'text/html');
  const found: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('h2, h3, h4, strong, b'))) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!NUMBERED.test(text)) continue;
    const clean = text
      .replace(NUMBERED, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/[.:؛،]+$/, '')
      .trim();
    if (clean.length < 4 || clean.length > 90 || found.includes(clean)) continue;
    found.push(clean);
    if (found.length >= max) break;
  }
  return found;
}

/** Store short description → configured summary → first meaningful paragraph. */
function summaryFor(product: StoreProduct, summaries: Record<string, string>): string {
  const short = htmlToText(product.short_description);
  if (short) return truncate(short, 190);
  const curated = summaries[String(product.id)];
  if (curated) return curated;
  if (product.description) {
    const doc = parser.parseFromString(product.description, 'text/html');
    for (const p of Array.from(doc.querySelectorAll('p'))) {
      const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length >= 40) return truncate(text, 170);
    }
  }
  return '';
}

export function toPriceView(product: StoreProduct): PriceView {
  const prices = product.prices;
  if (!prices) return { kind: 'inquiry' };

  const minor = Number(prices.currency_minor_unit) || 0;
  const toValue = (raw?: string) => (raw === undefined || raw === '' ? Number.NaN : Number(raw) / 10 ** minor);
  const unit = (prices.currency_suffix ?? '').trim() || (prices.currency_prefix ? '' : prices.currency_symbol ?? '');
  const prefix = (prices.currency_prefix ?? '').trim();

  if (prices.price_range) {
    const min = toValue(prices.price_range.min_amount);
    const max = toValue(prices.price_range.max_amount);
    if (Number.isFinite(min) && Number.isFinite(max) && max > 0) {
      return { kind: 'range', min: faNumber.format(min), max: faNumber.format(max), unit, prefix };
    }
  }

  const value = toValue(prices.price);
  if (!Number.isFinite(value) || value <= 0) return { kind: 'inquiry' };

  const regular = toValue(prices.regular_price);
  const onSale = Boolean(product.on_sale) && Number.isFinite(regular) && regular > value;
  return {
    kind: 'single',
    value,
    amount: faNumber.format(value),
    regular: onSale ? faNumber.format(regular) : undefined,
    unit,
    prefix,
  };
}

export function toProductView(
  product: StoreProduct,
  options: { summaries: Record<string, string>; cartUrl: string; featured: boolean },
): ProductView | null {
  const url = safeUrl(product.permalink);
  if (!url) return null;

  const name = htmlToText(product.name) || product.name;
  const image = product.images?.[0];
  const imageSrc = safeUrl(image?.src);
  const purchasable =
    product.is_purchasable !== false && product.is_in_stock !== false && (product.type ?? 'simple') === 'simple';
  const price = toPriceView(product);

  let addToCartUrl: string | null = null;
  if (purchasable && price.kind === 'single') {
    const cart = new URL(options.cartUrl, window.location.href);
    cart.searchParams.set('add-to-cart', String(product.id));
    addToCartUrl = cart.href;
  }

  return {
    id: product.id,
    name,
    url,
    category: htmlToText(product.categories?.[0]?.name),
    image: imageSrc
      ? { src: imageSrc, srcset: safeSrcset(image?.srcset), alt: htmlToText(image?.alt) || name }
      : null,
    summary: summaryFor(product, options.summaries),
    highlights: options.featured ? extractHighlights(product.description) : [],
    price,
    addToCartUrl,
  };
}
