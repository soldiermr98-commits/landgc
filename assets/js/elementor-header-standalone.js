/* Standalone version of the homepage Elementor header bridge and interactions.
 * The build script substitutes the homepage's header-only binding metadata.
 * It deliberately does not initialize window.GC or touch unrelated sections. */
(function () {
  'use strict';

  var META = /*__HEADER_META__*/{};
  var ownScript = document.currentScript;
  var host = (ownScript && ownScript.closest('[data-elementor-type]')) || document;
  var editing = /(?:\?|&)elementor-preview=/.test(location.search) ||
    document.body.classList.contains('elementor-editor-active') ||
    (window.elementorFrontend && typeof window.elementorFrontend.isEditMode === 'function' && window.elementorFrontend.isEditMode());
  var reflected = new WeakMap();

  function content(widget) {
    if (!widget) return null;
    for (var i = 0; i < widget.children.length; i++) {
      if (widget.children[i].classList.contains('elementor-widget-container')) return widget.children[i];
    }
    return widget;
  }
  function unwrap(container, widget) {
    var source = content(widget);
    if (!container || !source) return;
    var fragment = document.createDocumentFragment();
    while (source.firstChild) fragment.appendChild(source.firstChild);
    container.replaceWith(fragment);
  }
  function directText(target, text) {
    if (!target) return;
    var nodes = Array.prototype.filter.call(target.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    if (!nodes.length) { target.appendChild(document.createTextNode(text)); return; }
    var old = nodes[0].textContent;
    nodes[0].textContent = (old.match(/^\s*/) || [''])[0] + text + (old.match(/\s*$/) || [''])[0];
    nodes.slice(1).forEach(function (n) { n.textContent = ''; });
  }

  // Preserve Elementor's URL options and user attributes, without overwriting
  // the runtime's own data/ARIA hooks or copying Elementor layout classes.
  function customAttribute(name) {
    if (/^data-(?:gc-|gch-|menu-|nav-|cart-)/.test(name)) return false;
    if (/^data-(?:id|e-type|element_type|widget_type|settings)$/.test(name)) return false;
    if (/^aria-(?:current|expanded|controls|modal)$/.test(name)) return false;
    if (/^(?:class|style|href|target|rel)$/.test(name) || /^on/i.test(name)) return false;
    if (/^data-elementor-(?:setting|inline-edit)/.test(name)) return false;
    return /^[a-z_:][\w:.-]*$/.test(name);
  }
  function reflectAttributes(target, wrapper, source, mirror, isLink, key) {
    if (!target) return;
    var next = {};
    function collect(element, isSource) {
      if (!element) return;
      Array.prototype.forEach.call(element.attributes, function (attr) {
        var n = attr.name.toLowerCase();
        if (isLink && isSource && /^(?:href|target|rel)$/.test(n)) next[n] = attr.value;
        else if (customAttribute(n) && !(n === 'id' && (mirror || editing))) next[n] = attr.value;
      });
    }
    collect(wrapper, false);
    collect(source, true);
    var states = reflected.get(target);
    if (!states) { states = {}; reflected.set(target, states); }
    var state = states[key];
    if (!state) state = states[key] = { baseline: {}, applied: [] };
    state.applied.forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(next, name)) return;
      if (state.baseline[name] === null) target.removeAttribute(name);
      else target.setAttribute(name, state.baseline[name]);
    });
    if (isLink) {
      // A cleared Elementor URL really should clear the rendered URL as well.
      ['href', 'target', 'rel'].forEach(function (name) {
        if (!Object.prototype.hasOwnProperty.call(next, name)) target.removeAttribute(name);
      });
    }
    Object.keys(next).forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(state.baseline, name)) state.baseline[name] = target.getAttribute(name);
      target.setAttribute(name, next[name]);
    });
    state.applied = Object.keys(next);
  }
  function replaceIcon(target, mirror, source, meta) {
    if (!source) return;
    var parts = meta.defaultIcon.split(/\s+/);
    var defaultIcon = (source.tagName.toLowerCase() === 'i' && parts.every(function (c) { return source.classList.contains(c); })) ||
      (source.tagName.toLowerCase() === 'svg' && source.classList.contains('e-' + parts[0] + '-' + parts[1].replace(/^fa-/, '')));
    function update(slot, original) {
      if (!slot) return;
      if (defaultIcon) {
        if (slot.dataset.gcIconChanged === '1') {
          slot.innerHTML = original;
          delete slot.dataset.gcIconChanged;
        }
        return;
      }
      var copy = source.cloneNode(true);
      copy.classList.add('gc-header-custom-icon');
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('focusable', 'false');
      slot.replaceChildren(copy);
      slot.dataset.gcIconChanged = '1';
    }
    update(target, meta.originalIcon);
    update(mirror, meta.mirrorOriginalIcon);
  }
  function syncOrder(group, stage, drawer) {
    var header = stage.querySelector('[data-gch-header]');
    if (!header) return;
    function keyFrom(el, prefix) {
      for (var i = 0; i < el.classList.length; i++) if (el.classList[i].indexOf(prefix) === 0) return el.classList[i].slice(prefix.length);
      return '';
    }
    function keys(selector, prefix) {
      return Array.prototype.map.call(group.querySelectorAll(selector), function (el) { return keyFrom(el, prefix); }).filter(Boolean);
    }
    function order(parent, attribute, ordered, footer) {
      if (!parent) return;
      ordered.forEach(function (key, index) {
        var child = parent.querySelector('[' + attribute + '="' + key + '"]');
        if (child && child.parentElement === parent) {
          parent.insertBefore(child, footer || null);
          if (attribute === 'data-gc-nav-item' || attribute === 'data-gc-sub-item') child.style.setProperty('--i', index);
        }
      });
    }
    order(header.querySelector('.site-header__inner'), 'data-gc-header-block', keys('.gc-header-block-order .gc-header-block', 'gc-header-block-'));
    var menuKeys = keys('.gc-header-menu-order .gc-header-nav-item', 'gc-nav-key-');
    order(header.querySelector('.site-nav__list'), 'data-gc-nav-item', menuKeys);
    if (drawer) order(drawer.querySelector('.mobile-nav__list'), 'data-gc-nav-item', menuKeys);
    ['store', 'services'].forEach(function (name) {
      var subkeys = keys('.gc-subgroup-' + name + ' .gc-header-sub-item', 'gc-sub-key-');
      var mainItem = header.querySelector('[data-gc-nav-item="' + name + '"]');
      var mobileItem = drawer && drawer.querySelector('[data-gc-nav-item="' + name + '"]');
      var mobileList = mobileItem && mobileItem.querySelector('.mobile-nav__sub');
      order(mainItem && mainItem.querySelector('.nav-panel__list'), 'data-gc-sub-item', subkeys);
      order(mobileList, 'data-gc-sub-item', subkeys, mobileList && mobileList.querySelector('[data-gc-sub-footer]'));
    });
    order(header.querySelector('.site-header__actions'), 'data-gc-action', keys('.gc-header-action-order .gc-header-action-control', 'gc-action-'));
  }
  function applyControl(stage, drawer, element) {
    var key, meta;
    for (var i = 0; i < element.classList.length; i++) {
      var match = /^gc-bind-(\d+)$/.exec(element.classList[i]);
      if (match) { key = match[1]; meta = META[key]; break; }
    }
    if (!meta) return;
    var target = stage.querySelector('[data-gc-bind="' + key + '"]');
    var mirror = drawer && drawer.querySelector('[data-gc-mirror="' + key + '"]');
    if (!target) return;
    if (meta.kind === 'header-text' || meta.kind === 'header-direct') {
      var heading = element.querySelector('.elementor-heading-title');
      if (!heading) return;
      if (meta.kind === 'header-direct') { directText(target, heading.textContent); directText(mirror, heading.textContent); }
      else { target.textContent = heading.textContent; if (mirror) mirror.textContent = heading.textContent; }
      reflectAttributes(target, element, heading, false, false, key);
      reflectAttributes(mirror, element, heading, true, false, key);
    } else if (meta.kind === 'header-action-label') {
      var actionHeading = element.querySelector('.elementor-heading-title');
      if (!actionHeading) return;
      reflectAttributes(target, element, actionHeading, false, false, key);
      reflectAttributes(mirror, element, actionHeading, true, false, key);
      var actionLabel = actionHeading.textContent;
      target.setAttribute('aria-label', actionLabel);
      var hiddenLabel = target.querySelector('.header-cta__label');
      if (hiddenLabel) hiddenLabel.textContent = actionLabel;
      directText(mirror, actionLabel);
    } else if (meta.kind === 'header-link') {
      var link = element.querySelector('a.elementor-button');
      var label = element.querySelector('.elementor-button-text');
      if (!link || !label) return;
      reflectAttributes(target, element, link, false, true, key);
      reflectAttributes(mirror, element, link, true, true, key);
      var title = meta.labelSelector && target.querySelector(meta.labelSelector);
      if (title) title.textContent = label.textContent;
      else directText(target, label.textContent);
      directText(mirror, label.textContent);
    } else if (meta.kind === 'header-icon') {
      var iconWrapper = element.querySelector('.elementor-icon');
      var icon = iconWrapper && iconWrapper.querySelector('i,svg,img');
      replaceIcon(target, mirror, icon, meta);
      if (meta.link && iconWrapper) {
        var iconLink = stage.querySelector('[data-gc-icon-link="' + key + '"]');
        var mirrorLink = drawer && drawer.querySelector('[data-gc-mirror-icon-link="' + key + '"]');
        var source = iconWrapper.tagName === 'A' ? iconWrapper : null;
        reflectAttributes(iconLink, element, source, false, true, key);
        reflectAttributes(mirrorLink, element, source, true, true, key);
      } else {
        // The hamburger control edits an icon inside a real button; its
        // user-defined attributes belong on the button, not just the glyph.
        var iconTarget = key === '238' ? target.closest('[data-menu-open]') : target;
        reflectAttributes(iconTarget, element, iconWrapper, false, false, key);
        reflectAttributes(mirror, element, iconWrapper, true, false, key);
      }
    }
  }
  function applyAll(group, drawer) {
    var stage = group && group.querySelector('.gc-stage');
    if (!stage) return;
    group.querySelectorAll('.gc-header-controls .gc-control').forEach(function (el) { applyControl(stage, drawer, el); });
    syncOrder(group, stage, drawer);
  }
  function markCurrent(header, drawer) {
    function normalized(path) { return (path.replace(/\/+$/, '') || '/'); }
    [header, drawer].forEach(function (scope) {
      if (!scope) return;
      scope.querySelectorAll('[data-gc-nav-item] > a, [data-gc-nav-item] > .site-nav__link[href]').forEach(function (a) {
        a.removeAttribute('aria-current');
        try {
          var url = new URL(a.getAttribute('href'), location.href);
          if (url.origin === location.origin && normalized(url.pathname) === normalized(location.pathname) && !url.hash) a.setAttribute('aria-current', 'page');
        } catch (error) { /* an invalid URL cannot represent the current page */ }
      });
    });
  }
  function navLine(header) {
    var list = header.querySelector('[data-nav-list]');
    var line = header.querySelector('[data-nav-line]');
    if (!list || !line) return;
    var nav = list.parentNode;
    function move(link) {
      if (!link || !nav.offsetWidth) { line.classList.remove('is-ready'); return; }
      var n = nav.getBoundingClientRect(), b = link.getBoundingClientRect();
      line.style.setProperty('--x', (b.left - n.left + 12).toFixed(1) + 'px');
      line.style.setProperty('--w', Math.max(0, b.width - 24).toFixed(1) + 'px');
      line.classList.add('is-ready');
    }
    function place() { move(list.querySelector('.site-nav__link[aria-current="page"]')); }
    list.querySelectorAll('.site-nav__link').forEach(function (link) {
      link.addEventListener('pointerenter', function () { move(link); });
      link.addEventListener('focus', function () { move(link); });
    });
    list.addEventListener('pointerleave', place);
    list.addEventListener('focusout', function (event) { if (!list.contains(event.relatedTarget)) place(); });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', place);
    window.addEventListener('load', place);
    window.addEventListener('resize', place, { passive: true });
    window.addEventListener('popstate', function () { markCurrent(header, host.querySelector('[data-gch-drawer]')); place(); });
    requestAnimationFrame(place);
  }
  function navPanels(header) {
    var items = Array.prototype.slice.call(header.querySelectorAll('[data-nav-item]'));
    var closeTimer = 0, hoverOpenedAt = 0;
    function setOpen(item, open) {
      item.classList.toggle('is-open', open);
      var toggle = item.querySelector('[data-nav-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    }
    function closeAll(except) { items.forEach(function (item) { if (item !== except) setOpen(item, false); }); }
    items.forEach(function (item) {
      var toggle = item.querySelector('[data-nav-toggle]');
      if (!toggle) return;
      toggle.addEventListener('click', function () {
        var open = item.classList.contains('is-open');
        if (open && performance.now() - hoverOpenedAt < 450) return;
        closeAll(item); setOpen(item, !open);
      });
      item.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(closeTimer);
        if (!item.classList.contains('is-open')) hoverOpenedAt = performance.now();
        closeAll(item); setOpen(item, true);
      });
      item.addEventListener('pointerleave', function (event) {
        if (event.pointerType === 'mouse') closeTimer = setTimeout(function () { setOpen(item, false); }, 200);
      });
      item.addEventListener('focusout', function (event) { if (!item.contains(event.relatedTarget)) setOpen(item, false); });
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && item.classList.contains('is-open')) { setOpen(item, false); toggle.focus(); }
      });
    });
    document.addEventListener('click', function (event) {
      if (!items.some(function (item) { return item.contains(event.target); })) closeAll();
    });
  }
  function docking(header, drawer) {
    var busy = false;
    function update() {
      busy = false;
      var bar = document.getElementById('wpadminbar');
      var offset = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
      header.style.setProperty('--gc-admin-offset', offset + 'px');
      if (drawer) drawer.style.setProperty('--gc-admin-offset', offset + 'px');
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    }
    function schedule() { if (!busy) { busy = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule);
    update();
  }
  function mobileDrawer(header, drawer) {
    var opener = header.querySelector('[data-menu-open]');
    var panel = drawer && drawer.querySelector('[data-mobile-panel]');
    if (!opener || !panel) return;
    var opened = false, hideTimer = 0, previousFocus = null, inerted = [], hadLock = false;
    var focusable = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    function visible(el) { return !!(el.getClientRects().length) && !el.closest('[inert]'); }
    function trap(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      var items = Array.prototype.filter.call(panel.querySelectorAll(focusable), visible);
      if (!items.length) { event.preventDefault(); return; }
      var first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    // Inert siblings at each ancestor level, not just <main>: a theme may use
    // arbitrary wrappers and the header template may render before the page.
    function inertBackground() {
      inerted = [];
      for (var node = drawer; node && node !== document.body; node = node.parentElement) {
        var parent = node.parentElement;
        if (!parent) break;
        Array.prototype.forEach.call(parent.children, function (sibling) {
          if (sibling === node || /^(SCRIPT|STYLE|LINK|META)$/.test(sibling.tagName) || sibling.hasAttribute('inert')) return;
          sibling.setAttribute('inert', ''); inerted.push(sibling);
        });
      }
    }
    function open() {
      if (opened) return;
      opened = true; clearTimeout(hideTimer);
      previousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : opener;
      drawer.hidden = false;
      void drawer.offsetWidth;
      drawer.classList.add('is-open');
      opener.setAttribute('aria-expanded', 'true');
      hadLock = document.documentElement.classList.contains('gch-menu-open');
      document.documentElement.classList.add('gch-menu-open');
      inertBackground();
      document.addEventListener('keydown', trap);
      var closeButton = panel.querySelector('button[data-menu-close]');
      if (closeButton) closeButton.focus({ preventScroll: true });
    }
    function close(restoreFocus) {
      if (!opened) return;
      opened = false;
      drawer.classList.remove('is-open');
      opener.setAttribute('aria-expanded', 'false');
      if (!hadLock) document.documentElement.classList.remove('gch-menu-open');
      inerted.forEach(function (el) { el.removeAttribute('inert'); }); inerted = [];
      document.removeEventListener('keydown', trap);
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      hideTimer = setTimeout(function () { if (!opened) drawer.hidden = true; }, reduced ? 0 : 560);
      if (restoreFocus !== false && previousFocus && previousFocus.focus && visible(previousFocus)) previousFocus.focus({ preventScroll: true });
    }
    opener.addEventListener('click', open);
    drawer.addEventListener('click', function (event) {
      if (event.target.closest('[data-menu-close]')) close();
      else if (event.target.closest('a[href]')) close(false);
    });
    var desktop = window.matchMedia('(min-width: 1100px)');
    var onDesktop = function (event) { if (event.matches) close(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else if (desktop.addListener) desktop.addListener(onDesktop);
  }
  function cartBadge(header) {
    var badge = header.querySelector('[data-cart-count]'), link = header.querySelector('[data-cart-link]');
    if (!badge || !link || !/(?:^|;\s*)woocommerce_items_in_cart=1(?:;|$)/.test(document.cookie)) return;
    var label = link.getAttribute('aria-label') || 'سبد خرید';
    fetch('/wp-json/wc/store/v1/cart', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cart) {
        var count = Number(cart && cart.items_count) || 0;
        if (count <= 0) return;
        var text = String(count).replace(/\d/g, function (digit) { return '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]; });
        badge.textContent = text; badge.hidden = false; link.setAttribute('aria-label', label + ' — ' + text + ' کالا');
      }).catch(function () { /* The cart badge is optional. */ });
  }
  function initialize() {
    var group = host.querySelector('.gch-header-root');
    var drawerRoot = host.querySelector('.gch-drawer-root');
    var drawer = drawerRoot && drawerRoot.querySelector('[data-gch-drawer]');
    if (!group || !drawer) return false;
    if (editing) {
      if (host.__gchEditorObserver) host.__gchEditorObserver.disconnect();
      var timer;
      function queue() {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var current = host.querySelector('.gch-header-root');
          var mobile = host.querySelector('[data-gch-drawer]');
          if (current) applyAll(current, mobile);
        }, 120);
      }
      host.__gchEditorObserver = new MutationObserver(function (records) {
        if (records.some(function (r) {
          var el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
          if (el && el.closest('.gc-header-controls')) return true;
          if (r.type !== 'childList') return false;
          return Array.prototype.some.call(r.addedNodes, function (node) {
            return node.nodeType === 1 && (node.matches('.gch-header-root, .gch-drawer-root, .gc-header-controls') ||
              !!node.querySelector('.gch-header-root, .gch-drawer-root, .gc-header-controls'));
          });
        })) queue();
      });
      host.__gchEditorObserver.observe(host === document ? document.body : host, { subtree: true, childList: true, characterData: true, attributes: true });
      queue();
      return true;
    }
    applyAll(group, drawer);
    var stage = group.querySelector('.gc-stage');
    var header = stage && stage.querySelector('[data-gch-header]');
    if (!header || header.hasAttribute('data-gch-ready')) return !!header;
    var drawerWidget = drawerRoot.querySelector('.gc-system-widget');
    var styleRoot = host.querySelector('.gch-style-root');
    var styleWidget = styleRoot && styleRoot.querySelector('.gc-system-widget');
    // Only remove wrappers belonging to this header template, never other page sections.
    unwrap(group, stage);
    unwrap(drawerRoot, drawerWidget);
    unwrap(styleRoot, styleWidget);
    markCurrent(header, drawer);
    header.setAttribute('data-gch-ready', '');
    drawer.setAttribute('data-gch-ready', '');
    docking(header, drawer);
    navLine(header);
    navPanels(header);
    mobileDrawer(header, drawer);
    cartBadge(header);
    return true;
  }
  if (!initialize() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
