// Serves the production build (dist/) plus the dev Store API snapshot.
// Usage: npm run build && npm run preview   (PORT=4321 by default, binds 0.0.0.0)

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeApiFixtureMiddleware } from './store-api-fixture.mjs';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const fixture = storeApiFixtureMiddleware();

async function resolveFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(ROOT, safe);
  if (!file.startsWith(ROOT.replace(/[/\\]$/, '') + sep) && file !== ROOT.replace(/[/\\]$/, '')) return null;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

const server = createServer((req, res) => {
  fixture(req, res, async (err) => {
    if (err) {
      res.statusCode = 500;
      return res.end(String(err));
    }
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const file = await resolveFile(pathname);
    if (!file) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Not found');
    }
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    res.setHeader(
      'Cache-Control',
      pathname.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`GilaClick preview → http://${HOST}:${PORT}  (Store API: dev snapshot)`);
});
