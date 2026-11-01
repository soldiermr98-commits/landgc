/* Browser regressions for the standalone Elementor header.
 * Requires puppeteer-core and a Chromium executable. Optionally install
 * @sparticuz/chromium and axe-core. Examples are in README.md.
 * This renders the actual exported widgets with Elementor-like wrappers;
 * it is complementary to, not a replacement for, a real Elementor import. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const header = JSON.parse(fs.readFileSync(path.join(root, 'gilaclick header.json')));
const homepage = JSON.parse(fs.readFileSync(path.join(root, 'gilaclick-elementor.json')));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let axe; try { axe = require('axe-core'); } catch (_) { /* optional */ }

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function attrs(value, separator) {
  return (value || '').split(separator).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const pos = entry.indexOf('|');
    return pos > 0 ? ` ${esc(entry.slice(0, pos).trim())}="${esc(entry.slice(pos + 1).trim())}"` : '';
  }).join('');
}
function linkAttributes(link) {
  if (!link) return '';
  return (link.url ? ` href="${esc(link.url)}"` : '') + (link.is_external ? ' target="_blank"' : '') +
    (link.nofollow ? ' rel="nofollow"' : '') + attrs(link.custom_attributes, ',');
}
function render(element) {
  const s = element.settings, type = element.widgetType, id = element.id;
  const classes = s.css_classes || s._css_classes || '';
  const open = `<div class="elementor-element elementor-element-${esc(id)} ${esc(classes)}${type ? ` elementor-widget elementor-widget-${type}` : ' e-con'}" data-id="${esc(id)}" data-element_type="${type ? 'widget' : 'container'}" data-e-type="${type ? 'widget' : 'container'}"${attrs(s._attributes, '\n')}>`;
  let inner;
  if (type === 'html') inner = s.html;
  else if (type === 'heading') inner = `<span class="elementor-heading-title">${esc(s.title)}</span>`;
  else if (type === 'button') inner = `<a class="elementor-button"${linkAttributes(s.link)}><span class="elementor-button-text">${esc(s.text)}</span></a>`;
  else if (type === 'icon') {
    const isLink = s.link && s.link.url;
    inner = `<${isLink ? 'a' : 'span'} class="elementor-icon"${isLink ? linkAttributes(s.link) : ''}><i class="${esc(s.selected_icon?.value || '')}"></i></${isLink ? 'a' : 'span'}>`;
  } else inner = (element.elements || []).map(render).join('');
  return open + (type ? `<div class="elementor-widget-container">${inner}</div>` : inner) + '</div>';
}
function fixture(template, options = {}) {
  const contents = template.content.map(render).join('');
  const editorClass = options.editing ? 'elementor-editor-active' : '';
  const admin = options.admin ? '<div id="wpadminbar" style="position:absolute;top:0;left:0;right:0;height:46px;background:#222;z-index:9999"></div>' : '';
  // Register a local test font under the site's family name so comparisons
  // share identical metrics. This is not the licensed Peyda font and is not
  // included in the generated header JSON.
  const testFont = options.noTestFont ? '' : `
    @font-face{font-family:peyda;font-style:normal;font-weight:100 900;src:url('/__gch-test-font/arabic.woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}
    @font-face{font-family:peyda;font-style:normal;font-weight:100 900;src:url('/__gch-test-font/latin.woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-200B,U+200F-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${testFont}
    body{margin:0}.sentinel{background:#e8eeeb;color:#18352b;font:18px serif}.sentinel a{color:rgb(21,36,69)}
    .sentinel button{background:rgb(180,30,40);color:white}.outside-container{width:240px}
    </style></head><body class="${editorClass}${options.admin ? ' admin-bar' : ''}">${admin}
    <div class="elementor" data-elementor-type="header">${contents}</div>
    <main id="main" class="sentinel"><h1>بخش آزمایشی</h1>
    <div id="before" class="outside-container container"><a href="/foo/">پیوند صفحه</a><button>دکمه صفحه</button></div>
    <div class="gc-section" id="unrelated"><div class="gc-stage">بخش دیگر</div><div class="gc-controls">کنترل دیگر</div></div>
    <div class="site-header" id="unrelated-header">سربرگ دیگر</div><div style="height:1800px"></div></main>
    <footer>پاورقی</footer><div id="pre-inert" inert>محتوای غیرفعال قبلی</div></body></html>`;
}
function findControl(template, bind) {
  function* walk(elements) { for (const element of elements) { yield element; yield* walk(element.elements || []); } }
  return [...walk(template.content)].find((e) => (e.settings._css_classes || '').split(' ').includes(`gc-bind-${bind}`));
}
const edited = structuredClone(header);
const link = findControl(edited, 209).settings;
link.text = 'پیوند ویرایش‌شده';
link.link = { url: 'https://gilaclick.ir/shop/?test=1', is_external: true, nofollow: true, custom_attributes: 'data-link-test|url-value,title|عنوان پیوند,custom-test|custom-value' };
link._attributes = 'data-wrapper-test|wrapper-value\naria-label|نام آزمایشی';
findControl(edited, 236).settings.selected_icon.value = 'fas fa-heart';
findControl(edited, 236).settings.link.url = 'https://gilaclick.ir/cart/?custom=1';
findControl(edited, 238).settings._attributes = 'aria-label|بازکردن فهرست\ndata-toggle-test|toggle-value';
const originalRoots = [homepage.content[0], homepage.content[1], homepage.content[2], homepage.content[6]];
const pages = {
  header: fixture(header),
  nofont: fixture(header, { noTestFont: true }),
  home: fixture({ content: originalRoots }),
  editor: fixture(header, { editing: true }),
  edited: fixture(edited),
  admin: fixture(header, { admin: true }),
};

(async () => {
  let executablePath = process.env.CHROME_BIN;
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (!executablePath) {
    const chromium = require('@sparticuz/chromium').default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  const errors = [];
  async function open(name, width = 390, url = 'https://gilaclick.ir/', extra = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    if (extra.reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (extra.noJs) await page.setJavaScriptEnabled(false);
    if (extra.cookie) await page.setCookie({ name: 'woocommerce_items_in_cart', value: '1', domain: 'gilaclick.ir', path: '/' });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/wp-json/wc/store/v1/cart') && extra.cookie) return request.respond({ status: 200, contentType: 'application/json', body: '{"items_count":3}' });
      const testFontMatch = request.url().match(/\/__gch-test-font\/(arabic|latin)\.woff2$/);
      if (testFontMatch) return request.respond({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(root, `assets/fonts/vazirmatn-${testFontMatch[1]}-wght-normal.woff2`)) });
      if (request.isNavigationRequest()) return request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[name] });
      return request.abort();
    });
    page.on('pageerror', (err) => errors.push(`${name}: ${err.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    return page;
  }
  async function state(page) {
    return page.evaluate(() => {
      const d = document.querySelector('[data-gch-drawer]'), t = document.querySelector('[data-gch-header] [data-menu-open]');
      return { hidden: d.hidden, open: d.classList.contains('is-open'), expanded: t.getAttribute('aria-expanded'), locked: document.documentElement.classList.contains('gch-menu-open'), focus: document.activeElement?.outerHTML };
    });
  }
  async function closeAndWait(page) { await page.click('[data-gch-drawer] button[data-menu-close]'); await page.waitForFunction(() => document.querySelector('[data-gch-drawer]').hidden, { timeout: 2500 }); }
  try {
    let p = await open('header');
    await p.waitForSelector('[data-gch-header][data-gch-ready]');
    assert.equal((await state(p)).hidden, true);
    assert.deepEqual(await p.evaluate(() => {
      const h = document.querySelector('[data-gch-header]'), toggle = h.querySelector('[data-menu-open]');
      return [toggle.getAttribute('aria-controls'), document.querySelector('[data-gch-drawer]').id,
        document.querySelector('[data-gc-bind="232"]').textContent.trim(), document.querySelector('[data-gc-mirror="232"]').textContent.trim()];
    }), ['gch-mobile-nav', 'gch-mobile-nav', 'خدمات و تعرفه', 'خدمات و تعرفه']);
    assert.deepEqual(await p.evaluate(() => [getComputedStyle(document.querySelector('#before')).width,
      getComputedStyle(document.querySelector('#before a')).color,
      getComputedStyle(document.querySelector('#before button')).backgroundColor,
      getComputedStyle(document.querySelector('#unrelated-header')).position,
      !!document.querySelector('#unrelated .gc-controls')]), ['240px', 'rgb(21, 36, 69)', 'rgb(180, 30, 40)', 'static', true]);
    assert.equal(await p.$eval('[data-gch-spacer]', (x) => x.getBoundingClientRect().height), 80);
    await p.focus('[data-gch-header] [data-menu-open]');
    await p.click('[data-gch-header] [data-menu-open]');
    let s = await state(p); assert.equal(s.hidden, false); assert.equal(s.open, true); assert.equal(s.expanded, 'true'); assert.equal(s.locked, true);
    assert.match(s.focus, /data-menu-close/);
    assert.equal(await p.$eval('#main', (e) => e.closest('[inert]') !== null), true);
    assert.equal(await p.$eval('[data-gch-drawer]', (e) => `${e.getAttribute('role')}:${e.getAttribute('aria-modal')}`), 'dialog:true');
    await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('data-gc-mirror')), '239');
    await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(() => document.activeElement.hasAttribute('data-menu-close')), true);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => document.querySelector('[data-gch-drawer]').hidden, { timeout: 2500 });
    s = await state(p); assert.equal(s.expanded, 'false'); assert.equal(s.locked, false); assert.match(s.focus, /data-menu-open/);
    assert.equal(await p.$eval('#pre-inert', (e) => e.hasAttribute('inert')), true);
    assert.equal(await p.$eval('#main', (e) => e.hasAttribute('inert')), false);
    await p.click('[data-gch-header] [data-menu-open]');
    await delay(600);
    await p.click('[data-gch-drawer] summary[data-gc-mirror="205"]');
    assert.equal(await p.$eval('[data-gch-drawer] summary[data-gc-mirror="205"]', (e) => e.parentElement.open), true);
    await p.mouse.click(5, 350); await p.waitForFunction(() => document.querySelector('[data-gch-drawer]').hidden);
    await p.click('[data-gch-header] [data-menu-open]');
    await p.evaluate(() => { document.querySelector('[data-gch-drawer] button[data-menu-close]').click(); document.querySelector('[data-gch-header] [data-menu-open]').click(); });
    await delay(700); assert.equal((await state(p)).open, true); assert.equal((await state(p)).hidden, false);
    await p.setViewport({ width: 1200, height: 900 }); await delay(100);
    assert.equal((await state(p)).expanded, 'false'); assert.equal((await state(p)).locked, false);
    console.log('PASS mobile drawer: open, close, submenus, ARIA, focus trap, background/inert, reopen and resize');
    await p.close();

    for (const [url, expected] of [['https://gilaclick.ir/', 'صفحه اصلی'], ['https://gilaclick.ir/about-us/', 'درباره ما'], ['https://gilaclick.ir/contact-us/', 'تماس با ما'], ['https://gilaclick.ir/other/', null]]) {
      p = await open('header', 1440, url); const current = await p.$$eval('[aria-current="page"]', (es) => es.map((e) => e.textContent.trim()));
      assert.deepEqual(current, expected ? [expected, expected] : []); await p.close();
    }
    p = await open('header', 1440); await delay(1050);
    const toggle = '[data-gch-header] [data-nav-toggle]';
    await p.focus(toggle); await p.keyboard.press('Enter');
    assert.equal(await p.$eval(toggle, (e) => e.getAttribute('aria-expanded')), 'true');
    assert.equal(await p.$eval('[data-gch-header] .nav-panel', (e) => getComputedStyle(e).visibility), 'visible');
    await p.keyboard.press('Escape'); assert.equal(await p.$eval(toggle, (e) => e.getAttribute('aria-expanded')), 'false');
    assert.equal(await p.evaluate(() => document.activeElement.hasAttribute('data-nav-toggle')), true);
    await p.evaluate(() => scrollTo(0, 400)); await p.waitForFunction(() => document.querySelector('[data-gch-header]').classList.contains('is-scrolled'));
    assert.equal(await p.$eval('[data-gch-spacer]', (e) => e.getBoundingClientRect().height), 80);
    console.log('PASS desktop dropdowns, keyboard, current-page ARIA and scroll docking'); await p.close();

    p = await open('edited', 1440); await delay(200);
    for (const selector of ['[data-gc-bind="209"]', '[data-gc-mirror="209"]']) {
      const v = await p.$eval(selector, (e) => ({ href: e.getAttribute('href'), target: e.getAttribute('target'), rel: e.getAttribute('rel'), label: e.getAttribute('aria-label'), wrapper: e.getAttribute('data-wrapper-test'), link: e.getAttribute('data-link-test'), custom: e.getAttribute('custom-test'), title: e.getAttribute('title'), text: e.textContent, elementor: e.hasAttribute('data-e-type') }));
      assert.equal(v.href, 'https://gilaclick.ir/shop/?test=1'); assert.equal(v.target, '_blank'); assert.equal(v.rel, 'nofollow');
      assert.equal(v.label, 'نام آزمایشی'); assert.equal(v.wrapper, 'wrapper-value'); assert.equal(v.link, 'url-value'); assert.equal(v.custom, 'custom-value'); assert.equal(v.title, 'عنوان پیوند'); assert.match(v.text, /پیوند ویرایش‌شده/); assert.equal(v.elementor, false);
    }
    assert.equal(await p.$eval('[data-gc-icon-link="236"]', (e) => e.getAttribute('href')), 'https://gilaclick.ir/cart/?custom=1');
    assert.equal(await p.$eval('[data-gc-mirror-icon-link="236"]', (e) => e.getAttribute('href')), 'https://gilaclick.ir/cart/?custom=1');
    assert.equal(await p.$eval('[data-gc-bind="236"] i', (e) => e.classList.contains('fa-heart')), true);
    assert.equal(await p.$eval('[data-menu-open]', (e) => e.getAttribute('aria-label')), 'بازکردن فهرست');
    assert.equal(await p.$eval('[data-menu-open]', (e) => e.getAttribute('data-toggle-test')), 'toggle-value');
    console.log('PASS edited text, URLs, target/rel, custom attributes and mirrored icons'); await p.close();

    p = await open('editor', 1440, 'https://gilaclick.ir/?elementor-preview=123'); await delay(350);
    assert.equal(await p.$eval('.gc-header-controls', (e) => getComputedStyle(e).display), 'flex');
    await p.evaluate(() => {
      const c = document.querySelector('.gc-bind-209'); c.querySelector('.elementor-button-text').textContent = 'ویرایش زنده';
      c.querySelector('a').setAttribute('href', '/live-edit/'); c.setAttribute('data-live', 'yes');
      const menu = document.querySelector('.gc-header-menu-order'); menu.prepend(menu.querySelector('.gc-nav-key-contact'));
      document.querySelector('.gc-bind-236 i').className = 'fas fa-heart';
    });
    await p.waitForFunction(() => document.querySelector('[data-gc-bind="209"] .nav-panel__title').textContent === 'ویرایش زنده');
    assert.deepEqual(await p.evaluate(() => [document.querySelector('[data-gc-mirror="209"]').getAttribute('href'), document.querySelector('[data-gc-bind="209"]').getAttribute('data-live'), document.querySelector('.site-nav__list').firstElementChild.dataset.gcNavItem, document.querySelector('.mobile-nav__list').firstElementChild.dataset.gcNavItem, !!document.querySelector('[data-gc-bind="236"] .fa-heart')]), ['/live-edit/', 'yes', 'contact', 'contact', true]);
    await delay(400);
    const mutations = await p.evaluate(async () => { let count = 0; const o = new MutationObserver((r) => count += r.length); o.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); await new Promise((r) => setTimeout(r, 600)); o.disconnect(); return count; });
    assert.equal(mutations, 0);
    console.log('PASS Elementor-style editor live edits, ordering and observer stability'); await p.close();

    p = await open('header', 390, 'https://gilaclick.ir/', { cookie: true });
    await p.waitForFunction(() => !document.querySelector('[data-cart-count]').hidden);
    assert.equal(await p.$eval('[data-cart-count]', (e) => e.textContent), '۳');
    assert.match(await p.$eval('[data-cart-link]', (e) => e.getAttribute('aria-label')), /۳ کالا/);
    console.log('PASS WooCommerce badge with mocked same-origin cart response'); await p.close();

    p = await open('header', 390, 'https://gilaclick.ir/', { reduced: true });
    assert.equal(await p.$eval('[data-gch-header]', (e) => getComputedStyle(e).animationName), 'none');
    assert.equal(await p.$eval('[data-gch-header] .logo__trace', (e) => getComputedStyle(e).strokeDashoffset), '0px');
    await p.click('[data-menu-open]'); await delay(80); await closeAndWait(p);
    console.log('PASS reduced-motion drawer and logo'); await p.close();

    p = await open('admin', 390); await delay(1100);
    assert.equal(await p.$eval('[data-gch-header]', (e) => Math.round(e.getBoundingClientRect().top)), 46);
    await p.evaluate(() => scrollTo(0, 300)); await p.waitForFunction(() => document.querySelector('[data-gch-header]').style.getPropertyValue('--gc-admin-offset') === '0px');
    assert.equal(await p.$eval('[data-gch-header]', (e) => Math.round(e.getBoundingClientRect().top)), 0);
    console.log('PASS WordPress admin-bar offset while scrolling'); await p.close();

    p = await open('header', 1440, 'https://gilaclick.ir/', { noJs: true });
    assert.equal(await p.$eval('#main', (e) => getComputedStyle(e).display !== 'none'), true);
    await p.hover('[data-nav-toggle]');
    assert.equal(await p.$eval('.nav-panel', (e) => getComputedStyle(e).visibility), 'visible');
    console.log('PASS readable page and desktop hover fallback without JS (mobile menu requires JS)'); await p.close();

    p = await open('header');
    for (const width of [320, 360, 375, 390, 414, 480, 559, 600, 768, 900, 1024, 1099, 1100, 1280, 1440, 1920]) {
      await p.setViewport({ width, height: 900 }); await delay(30);
      const values = await p.evaluate(() => [innerWidth, document.documentElement.scrollWidth, getComputedStyle(document.querySelector('[data-menu-open]')).display]);
      assert.ok(values[1] <= values[0] + 1, `horizontal overflow at ${width}: ${values}`);
      assert.equal(values[2] === 'none', width >= 1100, `toggle breakpoint at ${width}`);
    }
    console.log('PASS 16 responsive widths without horizontal overflow'); await p.close();

    p = await open('nofont');
    for (const width of [320, 390, 768, 1099, 1100, 1280, 1440]) {
      await p.setViewport({ width, height: 900 }); await delay(30);
      const [view, doc] = await p.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
      assert.ok(doc <= view + 1, `horizontal overflow without an installed font at ${width}: ${doc}`);
    }
    await p.close(); console.log('PASS 7 responsive widths without a registered site font');

    for (const width of [320, 390, 768, 1099, 1100, 1280, 1440]) {
      const a = await open('home', width, 'https://gilaclick.ir/', { reduced: true });
      const b = await open('header', width, 'https://gilaclick.ir/', { reduced: true });
      if (width < 1100) { await a.click('[data-menu-open]'); await b.click('[data-menu-open]'); await delay(100); }
      const measurements = async (page) => page.evaluate(() => {
        const selectors = ['.site-header', '.site-header__bg', '.site-header__inner', '.site-header__brand', '.logo__mark', '.logo__fa', '.site-header__actions', '.menu-toggle', '.site-nav', '.site-nav__list', '.header-cta', '.mobile-nav__panel', '.mobile-nav__head', '.mobile-nav__list', '.mobile-nav__actions'];
        return Object.fromEntries(selectors.map((s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(), c = getComputedStyle(e); return [s, [r.x, r.y, r.width, r.height, c.display, c.fontSize, c.color, c.backgroundColor]]; }));
      });
      const x = await measurements(a), y = await measurements(b);
      for (const k of Object.keys(x)) {
        for (let i = 0; i < 4; i++) assert.ok(Math.abs(x[k][i] - y[k][i]) <= 2, `${width} ${k}: ${x[k]} vs ${y[k]}`);
        assert.deepEqual(x[k].slice(4), y[k].slice(4), `${width} ${k}: CSS mismatch`);
      }
      await a.close(); await b.close();
    }
    console.log('PASS homepage header/drawer visual geometry at 7 widths with a shared mock site font');

    if (axe) {
      for (const width of [390, 1440]) {
        p = await open('header', width);
        if (width < 1100) { await p.click('[data-menu-open]'); await delay(700); }
        else await delay(1100);
        await p.addScriptTag({ content: axe.source });
        const results = await p.evaluate(async (mobile) => (await window.axe.run(mobile ? '[data-gch-drawer]' : '[data-gch-header]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map(n => `${n.target.join(' ')} ${n.failureSummary}`).join('; ')})`), width < 1100);
        assert.deepEqual(results, [], `axe ${width}: ${results.join(', ')}`); await p.close();
      }
      console.log('PASS axe accessibility checks for desktop header and open mobile drawer');
    } else console.log('SKIP axe-core (not installed)');
    assert.deepEqual(errors, [], `browser errors: ${errors.join(', ')}`);
    console.log('ALL HEADER BROWSER TESTS PASSED');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
