/* Browser regressions for the FAQ. Requires puppeteer-core and Chromium;
 * @sparticuz/chromium and axe-core are optional. See README for the command. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/faq-fa.json'), 'utf8'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let axe; try { axe = require('axe-core'); } catch (_) { /* optional */ }

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const filename = url.pathname === '/' ? 'gilaclick-faq.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, filename);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[ext] || 'application/octet-stream');
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
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin, { waitUntil: 'networkidle0' });
    if (!options.noJs) await page.waitForSelector('.gf-page.gf-js');
    return page;
  }
  async function getVisible(page) {
    return page.evaluate(() => [...document.querySelectorAll('.gf-item')].filter((item) => !item.hidden && !item.closest('.gf-group').hidden).map((item) => item.querySelector('.gf-question').textContent.trim()));
  }
  try {
    let page = await open();
    const items = data.groups.flatMap((group) => group.questions);
    assert.deepEqual(await getVisible(page), items.map((item) => item.question));
    assert.equal(await page.$$eval('.gf-accordion-trigger', (els) => els.length), 24);
    assert.equal(await page.$$eval('.gf-answer[hidden]', (els) => els.length), 24);
    assert.equal(await page.$eval('h1', (e) => e.textContent.trim()), data.hero_title);
    assert.equal(await page.$$eval('h1', (els) => els.length), 1);
    assert.equal(await page.$eval('[data-gf-results]', (e) => e.textContent), '۲۴ پرسش');
    assert.equal(await page.$eval('[data-gf-schema]', (e) => JSON.parse(e.textContent).mainEntity.length), 24);

    await page.$eval('#gf-questions', (e) => e.scrollIntoView({ behavior: 'instant' }));
    await page.click('.gf-item:nth-child(1) .gf-accordion-trigger');
    await page.waitForFunction(() => document.querySelector('#gf-group-products .gf-item:nth-child(1) .gf-answer').getAnimations().length === 0, { timeout: 2500 });
    await page.click('.gf-item:nth-child(2) .gf-accordion-trigger');
    await page.waitForFunction(() => document.querySelector('#gf-group-products .gf-item:nth-child(2) .gf-answer').getAnimations().length === 0, { timeout: 2500 });
    assert.deepEqual(await page.$$eval('#gf-group-products .gf-accordion-trigger', (els) => els.slice(0, 2).map((e) => e.getAttribute('aria-expanded'))), ['true', 'true']);
    assert.deepEqual(await page.$$eval('#gf-group-products .gf-answer', (els) => els.slice(0, 2).map((e) => e.hidden)), [false, false]);
    await page.focus('#gf-group-products .gf-item:nth-child(1) button');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#gf-group-products .gf-item:nth-child(1) .gf-answer').hidden, { timeout: 2500 });
    assert.equal(await page.$eval('#gf-group-products .gf-item:nth-child(1) button', (e) => e.getAttribute('aria-expanded')), 'false');
    assert.equal(await page.$eval('#gf-group-products .gf-item:nth-child(2) button', (e) => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$eval('#gf-group-products .gf-item:nth-child(1) .gf-answer', (e) => e.hidden), true);
    console.log('PASS 24 questions, native keyboard buttons, multi-open, ARIA and schema');

    await page.click('.gf-tabs [data-gf-filter="seo"]');
    await delay(650);
    assert.deepEqual(await getVisible(page), data.groups[2].questions.map((item) => item.question));
    assert.equal(await page.$eval('.gf-tabs [data-gf-filter="seo"]', (e) => e.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[data-gf-schema]', (e) => JSON.parse(e.textContent).mainEntity.length), 5);
    const metrics = await page.evaluate(() => ({ navBottom: document.querySelector('.gf-controls').getBoundingClientRect().bottom, groupTop: document.querySelector('#gf-group-seo').getBoundingClientRect().top }));
    assert.ok(metrics.groupTop >= metrics.navBottom - 1, `sticky bar covered the selected section: ${JSON.stringify(metrics)}`);
    const input = await page.$('[data-gf-search]');
    await input.type('گوگل');
    assert.deepEqual(await getVisible(page), [data.groups[2].questions[4].question]);
    assert.equal(await page.$eval('[data-gf-schema]', (e) => JSON.parse(e.textContent).mainEntity.length), 1);
    await page.click('[data-gf-search-clear]');
    assert.equal((await getVisible(page)).length, 5);
    await page.click('.gf-tabs [data-gf-filter="all"]'); await delay(550);
    await input.type('بروز رسانی');
    const normalizedMatches = await getVisible(page);
    assert.ok(normalizedMatches.includes(data.groups[0].questions[3].question));
    assert.ok(normalizedMatches.includes(data.groups[3].questions[0].question));
    await page.click('[data-gf-search-clear]');
    await input.type('45 میلیون');
    assert.deepEqual(await getVisible(page), [data.groups[1].questions[1].question]);
    await page.click('[data-gf-search-clear]');
    await input.type('چیزی که وجود ندارد');
    assert.equal((await getVisible(page)).length, 0);
    assert.equal(await page.$eval('[data-gf-empty]', (e) => e.hidden), false);
    assert.equal(await page.$eval('[data-gf-schema]', (e) => e.textContent), '');
    await page.click('[data-gf-empty] button');
    assert.equal((await getVisible(page)).length, 24);
    console.log('PASS category filters, sticky offset, live Persian search, clear, empty state and visible-only schema');
    await page.close();

    // Twenty Twenty-One and similar themes target buttons with very specific
    // selectors. Their colors and padding must not override FAQ controls.
    page = await open(390, { reduced: true });
    await page.addStyleTag({ content: `button { padding: 15px 30px; }
      button:not(:hover):not(:active):not(.has-text-color) { color: #d1e4dd; }
      button:not(:hover):not(:active):not(.has-background) { background-color: #28303d; }` });
    const controlStyle = (selector) => page.$eval(selector, (e) => {
      const style = getComputedStyle(e);
      return { color: style.color, background: style.backgroundColor, padding: style.padding };
    });
    assert.deepEqual(await controlStyle('.gf-accordion-trigger'), { color: 'rgb(23, 43, 37)', background: 'rgba(0, 0, 0, 0)', padding: '15px 10px 15px 5px' });
    await page.type('[data-gf-search]', 'چیزی که وجود ندارد');
    assert.deepEqual(await controlStyle('[data-gf-search-clear]'), { color: 'rgb(73, 103, 88)', background: 'rgba(0, 0, 0, 0)', padding: '0px' });
    assert.deepEqual(await controlStyle('[data-gf-empty] button'), { color: 'rgb(11, 68, 53)', background: 'rgba(0, 0, 0, 0)', padding: '10px 15px' });
    console.log('PASS FAQ controls resist high-specificity theme button styles'); await page.close();

    page = await open(390);
    await page.click('.ga-menu-toggle a');
    assert.equal(await page.$eval('.ga-menu-toggle a', (e) => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$eval('.ga-primary-nav', (e) => e.hidden), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.ga-primary-nav', (e) => e.hidden), true);
    assert.equal(await page.evaluate(() => document.activeElement.matches('.ga-menu-toggle a')), true);
    await page.evaluate(() => {
      const bar = document.createElement('div'); bar.id = 'wpadminbar';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;z-index:9999';
      document.body.classList.add('admin-bar'); document.body.prepend(bar);
    });
    await page.evaluate(() => scrollTo(0, 1200)); await delay(150);
    const admin = await page.evaluate(() => ({ bar: document.getElementById('wpadminbar').getBoundingClientRect().bottom, headerTop: document.querySelector('.ga-header').getBoundingClientRect().top, headerBottom: document.querySelector('.ga-header').getBoundingClientRect().bottom, tabsTop: document.querySelector('.gf-controls').getBoundingClientRect().top }));
    assert.ok(admin.headerTop >= admin.bar - 1 && admin.tabsTop >= admin.headerBottom - 1, JSON.stringify(admin));
    console.log('PASS mobile header, Escape focus and WordPress admin-bar offset'); await page.close();

    page = await open(390, { reduced: true });
    assert.equal(await page.$eval('.gf-page', (e) => e.classList.contains('gf-motion')), false);
    assert.equal(await page.$eval('.gf-orbit-cw', (e) => getComputedStyle(e).animationName), 'none');
    await page.click('.gf-accordion-trigger');
    assert.equal(await page.$eval('.gf-answer', (e) => e.hidden), false);
    console.log('PASS reduced motion'); await page.close();

    page = await open(390, { noJs: true });
    assert.equal(await page.$$eval('.gf-item', (els) => els.length), 24);
    assert.equal(await page.$$eval('.gf-answer[hidden]', (els) => els.length), 0);
    assert.equal(await page.$eval('.gf-search', (e) => getComputedStyle(e).display), 'none');
    assert.equal(await page.$eval('.ga-primary-nav', (e) => getComputedStyle(e).display !== 'none'), true);
    assert.equal(await page.$eval('[data-gf-schema]', (e) => e.textContent), '');
    console.log('PASS content, category anchors and navigation without JavaScript'); await page.close();

    page = await open(1440);
    const ring = await page.$('.gf-hero .gf-orbit-cw');
    const before = await ring.evaluate((e) => getComputedStyle(e).transform);
    await delay(500);
    const after = await ring.evaluate((e) => getComputedStyle(e).transform);
    assert.notEqual(before, after, 'hero orbit did not move');
    await page.$eval('.gf-final', (e) => e.scrollIntoView({ behavior: 'instant' })); await delay(600);
    assert.equal(await page.$eval('.gf-hero', (e) => e.classList.contains('gf-paused')), true);
    assert.equal(await page.$eval('.gf-final', (e) => e.classList.contains('gf-on')), true);
    const endRing = await page.$('.gf-final .gf-orbit-cw');
    const endBefore = await endRing.evaluate((e) => getComputedStyle(e).transform); await delay(500);
    assert.notEqual(endBefore, await endRing.evaluate((e) => getComputedStyle(e).transform), 'final orbit did not move');
    console.log('PASS real orbit motion and off-screen pausing');
    for (const width of [320, 360, 375, 390, 414, 480, 559, 600, 720, 768, 900, 1024, 1100, 1280, 1440, 1920]) {
      await page.setViewport({ width, height: 900 }); await delay(35);
      const [inner, doc] = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
      assert.ok(doc <= inner + 1, `horizontal overflow at ${width}: ${doc}`);
    }
    console.log('PASS 16 responsive widths without horizontal overflow'); await page.close();

    if (axe) {
      for (const width of [390, 1440]) {
        page = await open(width, { reduced: true });
        await page.click('.gf-accordion-trigger');
        await page.addScriptTag({ content: axe.source });
        const issues = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`));
        assert.deepEqual(issues, [], `axe ${width}: ${issues.join(', ')}`);
        await page.close();
      }
      console.log('PASS axe WCAG checks on mobile and desktop with an open answer');
    } else console.log('SKIP axe-core (not installed)');
    assert.deepEqual(errors, []);
    console.log('ALL FAQ BROWSER TESTS PASSED');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
