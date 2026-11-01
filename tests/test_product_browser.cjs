/* Browser regressions for the product snapshot. Requires puppeteer-core and
 * Chromium; @sparticuz/chromium and axe-core are optional. See README. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/product-preview-fa.json'), 'utf8'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let axe; try { axe = require('axe-core'); } catch (_) { /* optional */ }

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const filename = url.pathname === '/' ? 'gilaclick-product.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, filename);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const type = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let executablePath = process.env.CHROME_BIN;
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (!executablePath) {
    const chromium = require('@sparticuz/chromium').default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  const errors = [];
  async function open(width = 390, options = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    if (options.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (options.noJs) await page.setJavaScriptEnabled(false);
    // Deterministic offline image test: the embedded fallbacks must stand on their own.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().startsWith(origin + '/') || /^(data:|blob:)/.test(request.url())) request.continue();
      else request.abort();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    if (!options.noJs) await page.waitForSelector('.gpd-page.gpd-js');
    return page;
  }
  try {
    let page = await open(1440, { reduced: true });
    assert.equal(await page.$eval('h1', (e) => e.textContent.trim()), data.name);
    assert.equal(await page.$$eval('.gpd-feature', (els) => els.length), 5);
    assert.equal(await page.$$eval('.gpd-faq-item', (els) => els.length), 3);
    assert.equal(await page.$eval('.gpd-price', (e) => e.innerText.includes('۱٬۴۸۰٬۰۰۰')), true);
    assert.equal(await page.$eval('.gpd-add form', (e) => e.action), data.source);
    assert.equal(await page.$eval('.gpd-snapshot', (e) => e.textContent.includes('۱۰ آبان ۱۴۰۵')), true);
    await page.$eval('.gpd-related', (e) => e.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await page.waitForFunction(() => [...document.querySelectorAll('img[data-gpd-original]')].every((img) => img.naturalWidth > 0));
    const fallbackImages = await page.$$eval('img[data-gpd-original]', (els) => els.map((img) => ({ src: img.currentSrc.slice(0, 20), width: img.naturalWidth })));
    assert.equal(fallbackImages.length, 3);
    assert.ok(fallbackImages.every((img) => img.src.startsWith('data:image/') && img.width > 0), JSON.stringify(fallbackImages));
    console.log('PASS dated real-product snapshot, actual purchase destination and offline images');

    await page.click('.gpd-zoom');
    assert.equal(await page.$eval('.gpd-lightbox', (e) => e.open), true);
    assert.equal(await page.$eval('.gpd-lightbox img', (e) => e.currentSrc.startsWith('data:image/webp')), true);
    assert.equal(await page.$eval('.gpd-lightbox [data-gpd-next]', (e) => e.hidden), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.gpd-lightbox', (e) => e.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.matches('.gpd-zoom')), true);
    await page.focus('.gpd-faq-item summary');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('.gpd-faq-item', (e) => e.open), true);
    await page.keyboard.press('Space');
    assert.equal(await page.$eval('.gpd-faq-item', (e) => e.open), false);
    console.log('PASS accessible lightbox, Escape focus and FAQ keyboard interaction');

    await page.click('.gpd-section-nav a[href="#gpd-features"]');
    await delay(150);
    assert.equal(await page.$eval('.gpd-section-nav a[href="#gpd-features"]', (e) => e.getAttribute('aria-current')), 'location');
    const sticky = await page.evaluate(() => ({
      header: document.querySelector('.ga-header').getBoundingClientRect().bottom,
      nav: document.querySelector('.gpd-section-nav').getBoundingClientRect().top,
      card: document.querySelector('.gpd-purchase').getBoundingClientRect().top,
      target: document.querySelector('#gpd-features').getBoundingClientRect().top,
      navBottom: document.querySelector('.gpd-section-nav').getBoundingClientRect().bottom,
    }));
    assert.ok(sticky.nav >= sticky.header - 1 && sticky.card >= sticky.header - 1, JSON.stringify(sticky));
    assert.ok(sticky.target >= sticky.navBottom - 2, JSON.stringify(sticky));
    await page.hover('.gpd-add .single_add_to_cart_button');
    const button = await page.$eval('.gpd-add .single_add_to_cart_button', (e) => ({ color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
    assert.deepEqual(button, { color: 'rgb(255, 255, 255)', bg: 'rgb(6, 39, 31)' });
    console.log('PASS sticky card, section navigation, active state, offset and CTA hover');
    await page.close();

    page = await open(390, { reduced: true });
    assert.equal(await page.$eval('.gpd-mobile-cta', (e) => getComputedStyle(e).display), 'flex');
    await page.$eval('.gpd-purchase', (e) => e.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await delay(150);
    assert.equal(await page.$eval('.gpd-mobile-cta', (e) => getComputedStyle(e).display), 'none');
    await page.$eval('#gpd-faq', (e) => e.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await delay(150);
    assert.equal(await page.$eval('.gpd-mobile-cta', (e) => getComputedStyle(e).display), 'flex');
    await page.click('.gpd-mobile-cta a');
    await delay(150);
    const card = await page.$eval('.gpd-purchase', (e) => ({ top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom }));
    assert.ok(card.top >= 0 && card.top < 200 && card.bottom < 900, JSON.stringify(card));
    assert.equal(await page.$eval('.gpd-mobile-cta', (e) => getComputedStyle(e).display), 'none');
    await page.click('.ga-menu-toggle a');
    assert.equal(await page.$eval('.ga-menu-toggle a', (e) => e.getAttribute('aria-expanded')), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.ga-primary-nav', (e) => e.hidden), true);
    console.log('PASS mobile purchase shortcut and header keyboard behavior');

    assert.equal(await page.$eval('.gpd-page', (e) => e.classList.contains('gpd-motion')), false);
    assert.equal(await page.$eval('.gpd-visual', (e) => getComputedStyle(e, '::after').animationName), 'none');
    assert.equal(await page.$eval('.gpd-reveal', (e) => getComputedStyle(e).opacity), '1');
    console.log('PASS reduced motion');
    await page.close();

    page = await open(390, { noJs: true });
    assert.equal(await page.$$eval('.gpd-faq-item', (els) => els.length), 0);
    assert.equal(await page.$eval('.gpd-content', (e) => e.textContent.includes('آیا ظاهر دکمه با قالب سایت من هماهنگ می‌شود؟')), true);
    assert.equal(await page.$eval('.gpd-add form', (e) => e.action), data.source);
    assert.equal(await page.$eval('.gpd-section-nav', (e) => getComputedStyle(e).display), 'none');
    assert.equal(await page.$eval('.ga-primary-nav', (e) => getComputedStyle(e).display !== 'none'), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await page.$eval('.gpd-gallery img', (e) => e.naturalWidth > 0), true);
    assert.equal(await page.$eval('.gpd-zoom', (e) => e.hidden), true);
    console.log('PASS readable product content, real purchase form and image without JavaScript');
    await page.close();

    page = await open(1440);
    assert.equal(await page.$eval('.gpd-page', (e) => e.classList.contains('gpd-motion')), true);
    assert.equal(await page.$eval('.gpd-visual', (e) => getComputedStyle(e, '::after').animationName), 'gpd-orbit');
    const before = await page.$eval('.gpd-visual', (e) => getComputedStyle(e, '::after').transform);
    await delay(450);
    assert.notEqual(await page.$eval('.gpd-visual', (e) => getComputedStyle(e, '::after').transform), before);
    assert.equal(await page.$eval('.gpd-feature', (e) => e.classList.contains('gpd-visible')), false);
    await page.$eval('.gpd-feature', (e) => e.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await page.waitForFunction(() => document.querySelector('.gpd-feature').classList.contains('gpd-visible'));
    console.log('PASS actual decorative orbit and scroll reveal');
    await page.click('.gpd-faq-item summary'); await delay(320);
    await page.click('.gpd-faq-item summary'); await delay(60);
    await page.click('.gpd-faq-item summary'); await delay(350);
    assert.equal(await page.$eval('.gpd-faq-item', (e) => e.open), true, 'rapid reopen should win over the unfinished close animation');
    assert.equal(await page.$eval('.gpd-faq-answer', (e) => e.style.overflow), '');
    console.log('PASS animated FAQ rapid close/reopen');
    for (const width of [320, 360, 375, 390, 414, 480, 559, 600, 720, 760, 768, 820, 980, 1024, 1280, 1440, 1920]) {
      await page.setViewport({ width, height: 900 }); await delay(70);
      const [inner, doc] = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
      assert.ok(doc <= inner + 1, `horizontal overflow at ${width}: ${doc}`);
    }
    console.log('PASS 17 responsive widths without horizontal overflow');
    await page.close();

    if (axe) {
      for (const width of [390, 1440]) {
        page = await open(width, { reduced: true });
        await page.click('.gpd-faq-item summary');
        await page.addScriptTag({ content: axe.source });
        const issues = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`));
        assert.deepEqual(issues, [], `axe ${width}: ${issues.join(', ')}`);
        await page.close();
      }
      console.log('PASS axe WCAG 2/2.1 A/AA and best-practice, desktop and mobile');
    } else console.log('SKIP axe-core (not installed)');
    assert.deepEqual(errors, [], `page errors: ${errors.join(', ')}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
