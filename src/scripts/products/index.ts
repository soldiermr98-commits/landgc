import { readJson } from '../utils/env';
import { loadProducts } from './api';
import { toProductView } from './model';
import { renderNotice, renderProducts } from './render';
import type { ProductsConfig, ProductView } from './types';

/**
 * Products section: live data from the WooCommerce Store API.
 * If the API is unreachable or returns nothing, a notice links to the shop.
 * No fallback products or prices are ever generated.
 */
export async function initProducts(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-products-root]');
  if (!root) return;
  const cfg = readJson<ProductsConfig>('script[data-products-config]', root);
  if (!cfg) return;

  try {
    const { products, featuredId } = await loadProducts(cfg);
    const views = products
      .map((p) => toProductView(p, { summaries: cfg.summaries, cartUrl: cfg.cartUrl, featured: p.id === featuredId }))
      .filter((v): v is ProductView => v !== null);

    if (!views.length) {
      renderNotice(root, cfg.copy.empty, 'empty');
      return;
    }
    renderProducts(root, views, featuredId);
  } catch (error) {
    console.warn('[GilaClick] Products could not be loaded from the Store API.', error);
    renderNotice(root, cfg.copy.unavailable, 'error');
  }
}
