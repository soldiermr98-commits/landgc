// Dev/preview helper — NOT part of the production site.
//
// In production the homepage runs on gilaclick.ir and calls the live WooCommerce
// Store API on the same origin (/wp-json/wc/store/v1/products). WooCommerce only sends
// CORS headers to the site's own origin, so a local or preview server cannot call it.
// This middleware answers the same route with a snapshot of the real API response,
// so the page behaves exactly like production while developing.
//
// STORE_FIXTURE=error | empty | slow simulates the failure / empty / slow states.

import { readFile } from 'node:fs/promises';

const FIXTURE_URL = new URL('./fixtures/store-api/products.json', import.meta.url);
const PRODUCTS_ROUTE = '/wp-json/wc/store/v1/products';

/** @param {import('node:http').ServerResponse} res */
function sendJson(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-GilaClick-Fixture', 'store-api-snapshot');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

/** Picks a subset of top-level keys, like WordPress' `_fields` parameter. */
function pickFields(item, fields) {
  if (!fields) return item;
  const keys = fields.split(',').map((k) => k.trim()).filter(Boolean);
  return Object.fromEntries(keys.filter((k) => k in item).map((k) => [k, item[k]]));
}

export function storeApiFixtureMiddleware() {
  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {(err?: unknown) => void} next
   */
  return async function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const isProductsRoute = url.pathname.replace(/\/+$/, '') === PRODUCTS_ROUTE;
    if (req.method !== 'GET' || !isProductsRoute) return next();

    const mode = process.env.STORE_FIXTURE ?? '';
    if (mode === 'error') {
      return sendJson(res, 503, { code: 'fixture_error', message: 'Simulated Store API failure' });
    }
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 3500));

    try {
      const { products, featuredIds = [] } = JSON.parse(await readFile(FIXTURE_URL, 'utf8'));
      let list = mode === 'empty' ? [] : products;

      if (url.searchParams.get('featured') === 'true') {
        list = list.filter((p) => featuredIds.includes(p.id));
      }
      const include = url.searchParams.get('include');
      if (include) {
        const ids = include.split(',').map(Number);
        list = list.filter((p) => ids.includes(p.id));
      }
      const perPage = Math.min(Number(url.searchParams.get('per_page')) || 10, 100);
      list = list.slice(0, perPage).map((p) => pickFields(p, url.searchParams.get('_fields')));

      return sendJson(res, 200, list, { 'X-WP-Total': String(list.length) });
    } catch (error) {
      return next(error);
    }
  };
}

/** Astro integration: registers the middleware on the dev server only. */
export default function storeApiFixture() {
  return {
    name: 'gilaclick:store-api-fixture',
    hooks: {
      'astro:server:setup': ({ server, logger }) => {
        server.middlewares.use(storeApiFixtureMiddleware());
        logger.info(`Store API snapshot served at ${PRODUCTS_ROUTE} (dev only)`);
      },
    },
  };
}
