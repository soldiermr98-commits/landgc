/* Destructive commerce tests for the disposable fixture ONLY, never production.
 * Start the local fixture in tests/fixtures, set HCF_WP_ORIGIN to its loopback
 * origin, then run with puppeteer-core/Chromium. See README. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const origin = (process.env.HCF_WP_ORIGIN || '').replace(/\/$/, '');
const parsed = origin && new URL(origin);
if (!parsed || parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
  throw new Error('HCF_WP_ORIGIN must be a disposable HTTP loopback fixture; production hosts are forbidden.');
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let axe; try { axe = require('axe-core'); } catch (_) { /* optional */ }
async function control(action = 'info') {
  const response = await fetch(`${origin}/fixture-control.php?action=${action}`);
  assert.ok(response.ok, 'Fixture control endpoint must be available');
  const data = await response.json();
  assert.equal(data.fixture, 'disposable-hami-test', 'Refusing to mutate an unrecognized WordPress site');
  return data;
}

(async () => {
  const fixture = await control();
  const products = await (await fetch(`${origin}/wp-json/wc/store/v1/products?per_page=100`)).json();
  const testProduct = products.find(p => p.id === fixture.ids.product);
  const otherProduct = products.find(p => p.id === fixture.ids.related);
  assert.ok(testProduct && otherProduct);
  const local = url => origin + new URL(url).pathname;
  const product = local(testProduct.permalink), other = local(otherProduct.permalink);
  let executablePath = process.env.CHROME_BIN;
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (!executablePath) {
    const chromium = require('@sparticuz/chromium').default;
    executablePath = await chromium.executablePath(); args = chromium.args;
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  const errors = [];
  async function open(width = 1440, noJs = false) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (noJs) await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().startsWith(origin + '/') || /^(data:|blob:)/.test(request.url())) request.continue();
      else if (request.url().includes('gilaclick.ir/wp-content/uploads/')) {
        // Only for this offline fixture. Production loads the real source media.
        request.respond({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(root, 'assets/img/product-preview-dashboard.webp')) });
      } else request.abort();
    });
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  const goto = (page, url) => page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  try {
    await control('reset');
    let page = await open();
    await goto(page, product);
    assert.equal(await page.$eval('.hcf-page', e => e.dataset.hcfReady), '1');
    assert.ok(await page.$('.hcf-price .amount'));
    assert.ok(await page.$('.hcf-add form.cart'));
    assert.equal(await page.$$eval('.hcf-feature', a => a.length), 5);
    assert.equal(await page.$$eval('.hcf-faq-trigger', a => a.length), 7);
    assert.ok(await page.$('.hcf-related li.product'));
    assert.equal(await page.$eval('.hcf-capture-image img', e => e.getAttribute('loading')), 'lazy');
    assert.equal(await page.$eval('.hcf-capture-image a', e => e.getAttribute('aria-label')), 'بزرگ‌نمایی تصویر تنظیمات حامی');
    assert.equal(await page.$$eval('.hcf-buy .stock', els => els.filter(e => getComputedStyle(e).display !== 'none').length), 1);

    for (const width of [280, 320, 360, 390, 414, 520, 600, 760, 768, 900, 1000, 1024, 1280, 1440, 1920]) {
      await page.setViewport({ width, height: 900 });
      const size = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, root: document.querySelector('.hcf-page').scrollWidth, scale: visualViewport?.scale }));
      assert.ok(size.doc <= width + 1 && size.root <= width + 1, `${width}: ${JSON.stringify(size)}`);
      assert.ok(!size.scale || Math.abs(size.scale - 1) < .01);
      assert.equal(await page.$$eval('.hcf-faq-trigger', a => a.some(e => e.scrollWidth > e.clientWidth + 1)), false, `${width}: FAQ overflow`);
    }
    console.log('PASS imported product template, live widgets and 15 viewport widths');

    await page.setViewport({ width: 1440, height: 900 });
    await page.click('.hcf-hero .hcf-primary a'); await delay(150);
    let sticky = await page.$eval('.hcf-buy', e => ({ pos: getComputedStyle(e).position, top: e.getBoundingClientRect().top }));
    assert.equal(sticky.pos, 'sticky'); assert.ok(sticky.top >= 0 && sticky.top < 80, JSON.stringify(sticky));
    await page.$eval('#hcf-faq', e => e.scrollIntoView({ block: 'start', behavior: 'instant' })); await delay(150);
    sticky = await page.$eval('.hcf-buy', e => ({ top: e.getBoundingClientRect().top })); assert.ok(sticky.top >= 0 && sticky.top < 80);
    await page.focus('.hcf-faq-trigger'); await page.keyboard.press('Enter');
    assert.equal(await page.$eval('.hcf-faq-trigger', e => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$eval('.hcf-faq-answer', e => e.hidden), false);
    assert.ok(await page.$eval('.hcf-faq-answer > :last-child', e => parseFloat(getComputedStyle(e).paddingBottom)) >= 18);
    await page.keyboard.press('Space');
    assert.equal(await page.$eval('.hcf-faq-answer', e => e.hidden), true);

    await page.focus('.flex-control-thumbs li:nth-child(2) img'); await page.keyboard.press('Enter'); await delay(700);
    assert.ok(await page.$eval('.flex-active-slide img:not(.zoomImg)', e => e.src.includes('fixture-settings')));
    await page.click('.hcf-zoom');
    assert.ok(await page.$eval('.hcf-lightbox img', e => e.src.includes('fixture-settings')));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.matches('.hcf-zoom')), true);
    await page.click('.hcf-capture-image a');
    assert.equal(await page.$eval('.hcf-lightbox img', e => e.alt), 'تنظیم روش استعلام قیمت در افزونه تماس برای قیمت');
    await page.keyboard.press('Escape');
    await page.click('a[href="#tab-reviews"]');
    assert.equal(await page.$eval('a[href="#tab-reviews"]', e => e.getAttribute('aria-selected')), 'true');
    await page.focus('a[href="#tab-reviews"]'); await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('a[href="#tab-fixture_tab"]', e => e.getAttribute('aria-selected')), 'true');
    assert.equal(await page.$eval('#fixture-third-party', e => getComputedStyle(e.parentElement).display), 'block');
    console.log('PASS sticky CTA, FAQ, native gallery keyboard/zoom and third-party tab');

    if (axe) {
      for (const width of [390, 1440]) {
        await page.setViewport({ width, height: 900 });
        await page.click('a[href="#tab-reviews"]');
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        const violations = await page.evaluate(async () => (await axe.run('.hcf-page', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
        assert.deepEqual(violations, [], `axe ${width}`);
      }
      console.log('PASS axe WCAG A/AA on imported page in mobile and desktop');
    }

    await control('sale'); await goto(page, product);
    assert.ok(await page.$('.hcf-price del')); assert.ok(await page.$('.hcf-price ins'));
    assert.ok((await page.$eval('.hcf-price ins', e => e.textContent)).includes('990,000'));
    await control('out'); await goto(page, product);
    assert.ok(await page.$('.hcf-stock .out-of-stock'));
    assert.equal(await page.$('.hcf-add form.cart'), null);
    await control('reset'); await goto(page, product);
    console.log('PASS live sale and out-of-stock states');

    // Submit a real Woo review to the isolated database, then approve it.
    const beforeReviews = (await control()).allReviews;
    const unique = Date.now().toString();
    await page.click('a[href="#tab-reviews"]');
    await page.click('.stars a.star-4');
    await page.type('#comment', 'دیدگاه آزمایشی محیط محلی ' + unique);
    await page.type('#author', 'بازدیدکننده آزمایشی');
    await page.type('#email', `review${unique}@example.invalid`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), page.click('#commentform #submit')]);
    assert.equal((await control()).allReviews, beforeReviews + 1);
    await control('approve'); await goto(page, product + '#tab-reviews');
    assert.ok((await page.$eval('#tab-reviews', e => e.innerText)).includes(unique));
    assert.ok(await page.$('#tab-reviews .star-rating'));
    console.log('PASS review submission, moderation and visible Woo rating');

    // Playground's SQLite cannot execute Woo's stock-reservation SQL; this local
    // order uses an unmanaged-stock virtual fixture while preserving real checkout.
    await control('virtual'); await goto(page, product);
    await page.$eval('.hcf-add input.qty', e => { e.value = 2; });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), page.click('.hcf-add .single_add_to_cart_button')]);
    assert.ok((await page.$eval('.hcf-notices', e => e.innerText)).length > 0);
    const cart = await page.evaluate(async () => (await fetch('/wp-json/wc/store/v1/cart')).json());
    assert.ok(cart.items.some(item => item.id === fixture.ids.product && item.quantity === 2));
    const beforeOrders = (await control()).orders;
    await goto(page, local(fixture.checkout));
    for (const [id, value] of Object.entries({ billing_first_name: 'Test', billing_last_name: 'Buyer', billing_address_1: '123 Test Ave', billing_city: 'Atlanta', billing_postcode: '30301', billing_phone: '4045550100', billing_email: 'buyer@example.invalid' })) {
      await page.click('#' + id, { clickCount: 3 }); await page.type('#' + id, value);
    }
    if (await page.$('#billing_state')) {
      const state = await page.$eval('#billing_state', e => ({ tag: e.tagName, hasGeorgia: Array.from(e.options || []).some(option => option.value === 'GA') }));
      if (state.tag === 'SELECT' && state.hasGeorgia) await page.select('#billing_state', 'GA');
      if (state.tag === 'INPUT') { await page.click('#billing_state', { clickCount: 3 }); await page.type('#billing_state', 'GA'); }
    }
    // Woo recalculates totals asynchronously after billing edits. In a slow
    // Playground worker, clicking the still-blocked button is a no-op.
    await delay(1500);
    await page.waitForFunction(() => [...document.querySelectorAll('form.checkout .blockUI.blockOverlay')].every(e => getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden'), { timeout: 90000, polling: 250 });
    try {
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), page.click('#place_order')]);
    } catch (error) {
      console.error('Checkout errors:', await page.$$eval('.woocommerce-error', nodes => nodes.map(e => e.innerText)));
      throw error;
    }
    assert.ok(page.url().includes('/order-received/'));
    const orderData = await control();
    assert.equal(orderData.orders, beforeOrders + 1);
    assert.ok(orderData.orderStates.some(order => order.status === 'processing' && order.items === 1));
    console.log('PASS quantity, real cart, checkout and local test order (no live transaction)');
    await page.close();

    await control('reset');
    page = await open(390, true); await goto(page, product);
    assert.equal(await page.$$eval('.hcf-faq-answer', a => a.filter(e => getComputedStyle(e).display !== 'none').length), 7);
    assert.ok(await page.$$eval('.wc-tab', a => a.every(e => getComputedStyle(e).display !== 'none')));
    assert.ok(await page.$('.hcf-add form.cart'));
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), page.click('.hcf-add .single_add_to_cart_button')]);
    assert.ok(await page.$$eval('.woocommerce-message', a => a.some(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0)));
    console.log('PASS JavaScript-disabled content, real cart form and Woo notice');
    await page.close();

    page = await open(390); await goto(page, other);
    assert.equal(await page.$('.hcf-page'), null);
    await page.close();
    assert.deepEqual(errors, []);
    console.log('PASS product display condition excludes the unrelated fixture product; no page errors');
  } finally {
    await control('reset').catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
