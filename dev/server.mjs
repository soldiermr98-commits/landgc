#!/usr/bin/env node
// ============================================================================
// Local preview server — development helper only, NOT part of the website.
// Zero dependencies (Node ≥ 18):   npm run dev   →   http://localhost:4321
//
// Serves index.html and /assets/*. It also answers the WooCommerce Store API
// route /wp-json/wc/store/v1/products with a snapshot of the real store
// (dev/fixtures/store-api/products.json): WooCommerce only sends CORS headers
// to its own origin, so a local page cannot call gilaclick.ir directly. In
// production the page runs on gilaclick.ir and calls the live API.
//
//   STORE_FIXTURE=error | empty | slow   simulate failure / empty store / slow API
//   STORE_PROXY=https://gilaclick.ir     forward /wp-json/* to a live site instead
//   PORT=4321  HOST=0.0.0.0
// ============================================================================

import http from 'node:http';
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE = join(ROOT, 'dev', 'fixtures', 'store-api', 'products.json');
const PRODUCTS_ROUTE = '/wp-json/wc/store/v1/products';
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || '0.0.0.0';
const MODE = process.env.STORE_FIXTURE || '';
const PROXY = (process.env.STORE_PROXY || '').replace(/\/+$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

/** Text responses are compressed like a production server would (brotli → gzip). */
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;

function compress(req, type, body) {
  const accept = String(req.headers['accept-encoding'] || '');
  if (!COMPRESSIBLE.test(type) || body.length < 1024) return { body, headers: {} };
  if (/\bbr\b/.test(accept)) {
    const params = { [zlib.BROTLI_PARAM_QUALITY]: 9 };
    return { body: brotliCompressSync(body, { params }), headers: { 'Content-Encoding': 'br', Vary: 'Accept-Encoding' } };
  }
  if (/\bgzip\b/.test(accept)) {
    return { body: gzipSync(body, { level: 9 }), headers: { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } };
  }
  return { body, headers: {} };
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-GilaClick-Fixture': 'store-api-snapshot',
    ...headers,
  });
}

/** Picks top-level keys, like WordPress' `_fields` parameter. */
function pickFields(item, fields) {
  if (!fields) return item;
  const keys = fields.split(',').map((k) => k.trim()).filter(Boolean);
  return Object.fromEntries(keys.filter((k) => k in item).map((k) => [k, item[k]]));
}

async function storeFixture(url, res) {
  if (MODE === 'error') return sendJson(res, 503, { code: 'fixture_error', message: 'Simulated Store API failure' });
  if (MODE === 'slow') await new Promise((r) => setTimeout(r, 3500));

  const { products, featuredIds = [] } = JSON.parse(await readFile(FIXTURE, 'utf8'));
  let list = MODE === 'empty' ? [] : products;

  if (url.searchParams.get('featured') === 'true') list = list.filter((p) => featuredIds.includes(p.id));
  const include = url.searchParams.get('include');
  if (include) {
    const ids = include.split(',').map(Number);
    list = list.filter((p) => ids.includes(p.id));
  }
  const perPage = Math.min(Number(url.searchParams.get('per_page')) || 10, 100);
  list = list.slice(0, perPage).map((p) => pickFields(p, url.searchParams.get('_fields')));
  return sendJson(res, 200, list, { 'X-WP-Total': String(list.length) });
}

async function proxy(url, res) {
  try {
    const upstream = await fetch(PROXY + url.pathname + url.search, { headers: { Accept: 'application/json' } });
    const body = Buffer.from(await upstream.arrayBuffer());
    send(res, upstream.status, body, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
  } catch (error) {
    sendJson(res, 502, { code: 'proxy_error', message: String(error) });
  }
}

async function serveFile(req, pathname, res, method) {
  // only the page itself and its assets are public
  if (pathname === '/') pathname = '/index.html';
  if (pathname !== '/index.html' && !pathname.startsWith('/assets/')) return send(res, 404, 'Not found');

  const file = resolve(ROOT, '.' + decodeURIComponent(pathname));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');

  try {
    const info = await stat(file);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    const raw = await readFile(file);
    const out = compress(req, type, raw);
    send(res, 200, method === 'HEAD' ? '' : out.body, {
      'Content-Type': type,
      'Content-Length': out.body.length,
      ...out.headers,
    });
  } catch {
    send(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  try {
    if (url.pathname.startsWith('/wp-json/')) {
      if (PROXY) return await proxy(url, res);
      if (url.pathname.replace(/\/+$/, '') === PRODUCTS_ROUTE) return await storeFixture(url, res);
      return sendJson(res, 404, { code: 'rest_no_route' });
    }
    await serveFile(req, url.pathname, res, req.method);
  } catch (error) {
    console.error(error);
    send(res, 500, 'Server error');
  }
});

server.listen(PORT, HOST, () => {
  const api = PROXY ? `proxy → ${PROXY}` : `snapshot${MODE ? ` (${MODE})` : ''}`;
  console.log(`GilaClick preview: http://localhost:${PORT}   ·   Store API: ${api}`);
});
