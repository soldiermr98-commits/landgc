// @ts-check
import { defineConfig } from 'astro/config';
import storeApiFixture from './dev/store-api-fixture.mjs';

/**
 * ASSETS_PREFIX lets the built CSS/JS/fonts live somewhere other than the site root,
 * e.g. inside a WordPress child theme:
 *   ASSETS_PREFIX=https://gilaclick.ir/wp-content/themes/gilaclick-child/home npm run build
 */
const assetsPrefix = process.env.ASSETS_PREFIX || undefined;

export default defineConfig({
  site: 'https://gilaclick.ir',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
    ...(assetsPrefix ? { assetsPrefix } : {}),
  },
  server: {
    host: true,
    port: 4321,
    // The dev server is also opened through preview proxies with arbitrary host names.
    allowedHosts: true,
  },
  devToolbar: { enabled: false },
  // Dev-only: serves a snapshot of the real Store API so products render locally.
  // It is never part of the production build.
  integrations: [storeApiFixture()],
});
