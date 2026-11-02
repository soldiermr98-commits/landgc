/* Regression checks for the standalone Hami preview.
 * Requires puppeteer-core and Chromium; axe-core is optional. See README. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/hami-cfp-fa.json'), 'utf8'));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/product-preview-fa.json'), 'utf8'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let axe; try { axe = require('axe-core'); } catch (_) { /* optional */ }

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let text = fs.readFileSync(path.join(root, 'gilaclick-hami-call-for-price.html'), 'utf8');
    // Exercise a second actual image as a test fixture, not in the deliverable.
    if (url.pathname === '/two-images') {
      const begin = text.indexOf('<div class="woocommerce-product-gallery__wrapper">');
      const marker = '</a></div></div></div>';
      const end = text.indexOf(marker, begin) + '</a></div>'.length;
      assert.ok(begin > 0 && end > begin);
      const bytes = fs.readFileSync(path.join(root, 'assets/img/product-preview-dashboard.webp')).toString('base64');
      const slide = `<div class="woocommerce-product-gallery__image"><a href="${sample.screenshot}"><img src="data:image/webp;base64,${bytes}" data-hcf-original="${sample.screenshot}" alt="تصویر آزمایشی دوم" width="1000" height="669"></a></div>`;
      text = text.slice(0, end) + slide + text.slice(end);
    }
    // Reproduce the theme's nowrap reset so regressions are not masked.
    text = text.replace('</head>', '<style>button { white-space: nowrap; }</style></head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(text);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let executablePath = process.env.CHROME_BIN;
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (!executablePath) {
    const chromium = require('@sparticuz/chromium').default;
    executablePath = await chromium.executablePath(); args = chromium.args;
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  const errors = [];
  async function open(width = 390, { reduced = true, noJs = false, route = '/' } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (noJs) await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.url().startsWith(origin + '/') || /^(data:|blob:)/.test(req.url())) req.continue();
      else req.abort(); // Offline: the genuine embedded crops must remain usable.
    });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(origin + route, { waitUntil: 'networkidle2', timeout: 30000 });
    if (!noJs) await page.waitForSelector('.hcf-page.hcf-js');
    return page;
  }
  try {
    let page = await open(1440);
    assert.equal(await page.$eval('.hcf-hero-title', e => e.innerText.trim()), data.hero_title);
    assert.equal(await page.$$eval('.hcf-feature', els => els.length), 5);
    assert.equal(await page.$$eval('.hcf-step', els => els.length), 4);
    assert.equal(await page.$$eval('.hcf-faq-trigger', els => els.length), 7);
    assert.ok((await page.$eval('.hcf-snapshot', e => e.textContent)).includes(data.observed_on_fa));
    assert.equal(await page.$eval('.hcf-add form.cart', e => e.action), sample.source);
    assert.equal(await page.$eval('.hcf-capture-image a', e => e.getAttribute('aria-label')), 'بزرگ‌نمایی تصویر تنظیمات حامی');
    console.log('PASS dated real-product preview, content, actual purchase destination');

    await page.focus('.hcf-faq-trigger');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('.hcf-faq-trigger', e => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$eval('.hcf-faq-answer', e => e.hidden), false);
    await page.keyboard.press('Space');
    assert.equal(await page.$eval('.hcf-faq-answer', e => e.hidden), true);
    await page.click('.hcf-zoom');
    assert.equal(await page.$eval('.hcf-lightbox', e => e.open), true);
    const initial = await page.$eval('.hcf-lightbox img', e => e.src);
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await page.$eval('.hcf-lightbox img', e => e.src), initial);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.hcf-lightbox', e => e.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.matches('.hcf-zoom')), true);
    await page.click('.hcf-capture-image a');
    assert.equal(await page.$eval('.hcf-lightbox img', e => e.alt), sample.screenshot_alt);
    await page.click('.hcf-lightbox [data-hcf-close]');
    assert.equal(await page.evaluate(() => document.activeElement.closest('.hcf-capture-image') !== null), true);
    console.log('PASS keyboard FAQ, gallery, screenshot lightbox and focus return');

    await page.click('.hcf-hero .hcf-primary a');
    await delay(180);
    const geometry = await page.evaluate(() => ({
      header: document.querySelector('.ga-header').getBoundingClientRect().bottom,
      buy: document.querySelector('.hcf-buy').getBoundingClientRect().top,
      top: getComputedStyle(document.querySelector('.hcf-buy')).position,
    }));
    assert.equal(geometry.top, 'sticky');
    assert.ok(geometry.buy >= geometry.header - 1 && geometry.buy < geometry.header + 80, JSON.stringify(geometry));
    await page.$eval('#hcf-compare', e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await delay(180);
    const sticky = await page.evaluate(() => ({
      header: document.querySelector('.ga-header').getBoundingClientRect().bottom,
      buy: document.querySelector('.hcf-buy').getBoundingClientRect().top,
    }));
    assert.ok(sticky.buy >= sticky.header - 1 && sticky.buy < sticky.header + 35, JSON.stringify(sticky));
    await page.$eval('.hcf-final .hcf-primary a', e => e.click());
    await delay(180);
    assert.ok(await page.$eval('.hcf-buy', e => e.getBoundingClientRect().top < 180));
    assert.equal(await page.$eval('.hcf-page', e => e.classList.contains('hcf-motion')), false);
    assert.equal(await page.$eval('.hcf-orbit', e => getComputedStyle(e).animationName), 'none');
    console.log('PASS purchase CTAs, sticky offset and reduced motion');
    await page.close();

    page = await open(390, { noJs: true });
    assert.equal(await page.$$eval('.hcf-faq-trigger', els => els.length), 0);
    assert.equal(await page.$$eval('.hcf-faq-answer', els => els.filter(e => getComputedStyle(e).display !== 'none').length), 7);
    assert.equal(await page.$eval('.hcf-capture-image a', e => e.getAttribute('href')), sample.screenshot);
    assert.equal(await page.$eval('.hcf-zoom', e => e.hidden), true);
    assert.equal(await page.$eval('.hcf-add form.cart', e => e.action), sample.source);
    assert.equal(await page.$eval('.ga-primary-nav', e => getComputedStyle(e).display !== 'none'), true);
    console.log('PASS readable content, links and purchase form with JavaScript disabled');
    await page.close();

    page = await open(390, { route: '/two-images' });
    assert.equal(await page.$$eval('.hcf-fallback-thumbs button', els => els.length), 2);
    await page.focus('.hcf-fallback-thumbs button:nth-child(2)');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('.hcf-fallback-thumbs button:nth-child(2)', e => e.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('.woocommerce-product-gallery__image:nth-child(2)', e => !e.hidden), true);
    await page.click('.hcf-zoom');
    assert.equal(await page.$eval('.hcf-lightbox img', e => e.alt), 'تصویر آزمایشی دوم');
    await page.keyboard.press('Escape');
    console.log('PASS two-image gallery fallback and selected-image enlargement');
    await page.close();

    page = await open(1440, { reduced: false });
    await page.waitForFunction(() => document.querySelector('.hcf-page').classList.contains('hcf-orbit-running'));
    const transform = await page.$eval('.hcf-orbit', e => getComputedStyle(e).transform);
    await delay(450);
    assert.notEqual(await page.$eval('.hcf-orbit', e => getComputedStyle(e).transform), transform);
    await page.$eval('.hcf-feature', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.hcf-feature').classList.contains('hcf-visible'));
    await page.waitForFunction(() => !document.querySelector('.hcf-page').classList.contains('hcf-orbit-running'));
    await page.click('.hcf-faq-trigger');
    await page.click('.hcf-faq-trigger');
    await page.click('.hcf-faq-trigger');
    await delay(400);
    assert.equal(await page.$eval('.hcf-faq-trigger', e => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$eval('.hcf-faq-answer', e => e.hidden), false);
    console.log('PASS actual orbit movement, viewport pause, reveal and rapid FAQ toggling');
    await page.close();

    for (const width of [280, 320, 360, 375, 390, 414, 480, 520, 600, 760, 768, 900, 1000, 1024, 1280, 1440, 1920]) {
      page = await open(width);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth, doc: document.documentElement.scrollWidth,
        root: document.querySelector('.hcf-page').scrollWidth,
        scale: window.visualViewport && window.visualViewport.scale,
      }));
      assert.ok(dimensions.doc <= width + 1 && dimensions.root <= width + 1, `${width}: ${JSON.stringify(dimensions)}`);
      assert.ok(!dimensions.scale || Math.abs(dimensions.scale - 1) < .01, `${width}: ${JSON.stringify(dimensions)}`);
      const invalid = await page.$$eval('.hcf-faq-trigger', els => els.some(e => e.scrollWidth > e.clientWidth + 1));
      assert.equal(invalid, false, `${width}: FAQ question overflow`);
      await page.close();
    }
    console.log('PASS 17 viewport widths, theme nowrap reset and no horizontal overflow');

    if (axe) {
      for (const width of [390, 1440]) {
        page = await open(width);
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        const results = await page.evaluate(async () => window.axe.run('.hcf-page', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
        assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], `axe ${width}`);
        await page.close();
      }
      console.log('PASS axe WCAG A/AA in mobile and desktop preview');
    }
    assert.deepEqual(errors, []);
    console.log('PASS no preview JavaScript errors');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
