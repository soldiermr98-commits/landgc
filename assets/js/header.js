/* ==========================================================================
   GilaClick — header: docking on scroll, sliding nav indicator, dropdown
   panels (hover + click + keyboard), mobile drawer (focus trap, inert
   background, scroll lock) and the cart badge.
   ========================================================================== */
(function () {
  'use strict';

  var GC = window.GC;

  /* ---- Docking: floating bar → full-width translucent bar ---------------- */
  GC.define('header', function () {
    var header = GC.$('[data-header]');
    if (!header) return;
    var docked = null;
    GC.onScroll(function (y) {
      var next = y > 24;
      if (next === docked) return;
      return function () {
        docked = next;
        header.classList.toggle('is-scrolled', next);
      };
    });
  });

  /* ---- Sliding indicator under the desktop navigation -------------------- */
  GC.define('navLine', function () {
    var list = GC.$('[data-nav-list]');
    var line = GC.$('[data-nav-line]');
    if (!list || !line) return;
    var nav = list.parentNode;
    var links = GC.$$('.site-nav__link', list);
    var current = GC.$('.site-nav__link[aria-current="page"]', list);

    function moveTo(link) {
      if (!link || !nav.offsetWidth) {
        line.classList.remove('is-ready');
        return;
      }
      var navBox = nav.getBoundingClientRect();
      var box = link.getBoundingClientRect();
      var inset = 12;
      line.style.setProperty('--x', (box.left - navBox.left + inset).toFixed(1) + 'px');
      line.style.setProperty('--w', Math.max(0, box.width - inset * 2).toFixed(1) + 'px');
      line.classList.add('is-ready');
    }

    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () {
        moveTo(link);
      });
      link.addEventListener('focus', function () {
        moveTo(link);
      });
    });
    list.addEventListener('pointerleave', function () {
      moveTo(current);
    });
    list.addEventListener('focusout', function (event) {
      if (!list.contains(event.relatedTarget)) moveTo(current);
    });

    // place it once fonts have settled, and keep it there on resize
    var place = function () {
      moveTo(current);
    };
    // (document.fonts.ready would force a style recalc during start-up)
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', place);
    window.addEventListener('load', place);
    window.addEventListener('resize', place, { passive: true });
    requestAnimationFrame(function () {
      setTimeout(place, 0); // after the first layout, never forcing one
    });
  });

  /* ---- Desktop dropdown panels ------------------------------------------- */
  GC.define('navPanels', function () {
    var items = GC.$$('[data-nav-item]');
    if (!items.length) return;
    var closeTimer = 0;
    var hoverOpenedAt = 0;

    function setOpen(item, open) {
      item.classList.toggle('is-open', open);
      var toggle = GC.$('[data-nav-toggle]', item);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    }

    function closeAll(except) {
      items.forEach(function (i) {
        if (i !== except) setOpen(i, false);
      });
    }

    items.forEach(function (item) {
      var toggle = GC.$('[data-nav-toggle]', item);
      if (!toggle) return;

      toggle.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        // a click right after a hover-open must not immediately close the panel
        if (isOpen && performance.now() - hoverOpenedAt < 450) return;
        closeAll(item);
        setOpen(item, !isOpen);
      });

      item.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(closeTimer);
        if (!item.classList.contains('is-open')) hoverOpenedAt = performance.now();
        closeAll(item);
        setOpen(item, true);
      });

      item.addEventListener('pointerleave', function (event) {
        if (event.pointerType !== 'mouse') return;
        closeTimer = setTimeout(function () {
          setOpen(item, false);
        }, 200);
      });

      item.addEventListener('focusout', function (event) {
        if (!item.contains(event.relatedTarget)) setOpen(item, false);
      });

      item.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && item.classList.contains('is-open')) {
          setOpen(item, false);
          toggle.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!items.some(function (i) { return i.contains(event.target); })) closeAll();
    });
  });

  /* ---- Mobile drawer ------------------------------------------------------- */
  var FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  GC.define('drawer', function () {
    var drawer = GC.$('[data-mobile-nav]');
    var opener = GC.$('[data-menu-open]');
    var panel = drawer && GC.$('[data-mobile-panel]', drawer);
    if (!drawer || !opener || !panel) return;

    var background = ['.site-header', 'main', '.site-footer', '.rail', '.to-top']
      .map(function (sel) { return GC.$(sel); })
      .filter(Boolean);
    var lastFocus = null;
    var hideTimer = 0;

    function onKeydown(event) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusables = GC.$$(FOCUSABLE, panel).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      clearTimeout(hideTimer);
      lastFocus = document.activeElement;
      drawer.hidden = false;
      void drawer.offsetWidth; // commit hidden → visible before animating
      drawer.classList.add('is-open');
      opener.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('is-locked');
      background.forEach(function (el) {
        el.setAttribute('inert', '');
      });
      var closeBtn = GC.$('[data-menu-close].icon-btn', panel);
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function close() {
      if (drawer.hidden) return;
      drawer.classList.remove('is-open');
      opener.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('is-locked');
      background.forEach(function (el) {
        el.removeAttribute('inert');
      });
      document.removeEventListener('keydown', onKeydown);
      hideTimer = setTimeout(function () {
        drawer.hidden = true;
      }, GC.env.reducedMotion ? 0 : 520);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    opener.addEventListener('click', open);
    GC.$$('[data-menu-close]', drawer).forEach(function (el) {
      el.addEventListener('click', close);
    });
    GC.$$('[data-menu-link]', drawer).forEach(function (el) {
      el.addEventListener('click', close);
    });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', function (event) {
      if (event.matches) close();
    });
  });

  /* ---- Cart badge (only when WooCommerce says the cart has items) --------- */
  GC.define('cartBadge', function () {
    var badge = GC.$('[data-cart-count]');
    var link = GC.$('[data-cart-link]');
    var api = GC.config.storeApi;
    if (!badge || !link || !api) return;
    if (!/(?:^|;\s*)woocommerce_items_in_cart=1(?:;|$)/.test(document.cookie)) return;

    var url = new URL(api.replace(/\/+$/, '') + '/cart', window.location.href);
    if (url.origin !== window.location.origin) return;

    fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (cart) {
        var count = Number(cart && cart.items_count) || 0;
        if (count <= 0) return;
        badge.textContent = GC.faDigits(count);
        badge.hidden = false;
        link.setAttribute('aria-label', 'سبد خرید — ' + GC.faDigits(count) + ' کالا');
      })
      .catch(function () {
        /* the badge is optional */
      });
  });
})();
