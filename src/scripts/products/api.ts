import type { ProductsConfig, StoreProduct } from './types';

const FIELDS = [
  'id',
  'name',
  'permalink',
  'type',
  'short_description',
  'description',
  'on_sale',
  'prices',
  'images',
  'categories',
  'is_purchasable',
  'is_in_stock',
].join(',');

function endpoint(base: string, params: Record<string, string | number>): string {
  const url = new URL(`${base.replace(/\/+$/, '')}/products`, window.location.href);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.href;
}

async function getProducts(url: string, timeoutMs: number): Promise<StoreProduct[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`Store API responded ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected Store API payload');
    return data.filter((p): p is StoreProduct => typeof p?.id === 'number' && typeof p?.name === 'string');
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Loads the products shown on the homepage and decides which one is featured:
 * 1. a product starred as «featured» in WooCommerce,
 * 2. otherwise `preferredFeaturedId` from the config (if it still exists),
 * 3. otherwise the newest product.
 */
export async function loadProducts(cfg: ProductsConfig): Promise<{ products: StoreProduct[]; featuredId: number | null }> {
  const [list, featured] = await Promise.all([
    getProducts(endpoint(cfg.apiBase, { per_page: cfg.perPage, _fields: FIELDS }), cfg.timeoutMs),
    getProducts(endpoint(cfg.apiBase, { featured: 'true', per_page: 1, _fields: FIELDS }), cfg.timeoutMs).catch(
      () => [] as StoreProduct[],
    ),
  ]);

  const products = [...list];
  const has = (id: number) => products.some((p) => p.id === id);
  let featuredId: number | null = null;

  if (featured[0]) {
    featuredId = featured[0].id;
    if (!has(featuredId)) products.unshift(featured[0]);
  } else if (cfg.preferredFeaturedId) {
    if (has(cfg.preferredFeaturedId)) {
      featuredId = cfg.preferredFeaturedId;
    } else {
      const extra = await getProducts(
        endpoint(cfg.apiBase, { include: cfg.preferredFeaturedId, _fields: FIELDS }),
        cfg.timeoutMs,
      ).catch(() => [] as StoreProduct[]);
      if (extra[0]) {
        products.unshift(extra[0]);
        featuredId = extra[0].id;
      }
    }
  }

  if (featuredId === null && products[0]) featuredId = products[0].id;
  return { products, featuredId };
}
