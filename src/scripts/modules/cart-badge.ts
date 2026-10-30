import { readJson, toFaDigits } from '../utils/env';

interface Runtime {
  storeApi: string;
}

/**
 * Shows the real cart item count on the header cart icon.
 * Runs only when WooCommerce's own `woocommerce_items_in_cart` cookie says the cart has
 * items and the Store API is on this origin, so it never creates sessions for visitors.
 */
export function initCartBadge(): void {
  const badge = document.querySelector<HTMLElement>('[data-cart-count]');
  const link = document.querySelector<HTMLElement>('[data-cart-link]');
  const runtime = readJson<Runtime>('#gc-runtime');
  if (!badge || !link || !runtime) return;
  if (!/(?:^|;\s*)woocommerce_items_in_cart=1(?:;|$)/.test(document.cookie)) return;

  const url = new URL(`${runtime.storeApi.replace(/\/+$/, '')}/cart`, window.location.href);
  if (url.origin !== window.location.origin) return;

  fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((cart: { items_count?: number } | null) => {
      const count = Number(cart?.items_count) || 0;
      if (count <= 0) return;
      badge.textContent = toFaDigits(count);
      badge.hidden = false;
      link.setAttribute('aria-label', `سبد خرید — ${toFaDigits(count)} کالا`);
    })
    .catch(() => {
      /* the badge is optional */
    });
}
