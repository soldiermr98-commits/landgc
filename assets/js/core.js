/* ==========================================================================
   GilaClick — core: environment, helpers, shared scroll loop, module registry
   Plain browser JavaScript (no build step). Every file attaches to window.GC
   and registers its modules with GC.define(); main.js starts them, each one
   isolated so a failure in one never breaks the rest of the page.
   ========================================================================== */
(function () {
  'use strict';

  var GC = (window.GC = window.GC || {});
  var root = document.documentElement;

  /* ---- Environment (live media queries) -------------------------------- */
  var mq = {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)'),
    fine: window.matchMedia('(hover: hover) and (pointer: fine)'),
    mobile: window.matchMedia('(max-width: 767.98px)'),
  };

  GC.env = {
    /** user asked the OS for reduced motion */
    get reducedMotion() {
      return mq.reduced.matches;
    },
    /** a precise pointer that can hover (mouse / trackpad) */
    get finePointer() {
      return mq.fine.matches;
    },
    get mobile() {
      return mq.mobile.matches;
    },
    /** rich pointer effects: tilt, magnetic buttons, cursor light, parallax */
    get richPointer() {
      return mq.fine.matches && !mq.reduced.matches && !mq.mobile.matches;
    },
    media: mq,
  };

  /* ---- Helpers ----------------------------------------------------------- */
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  GC.faDigits = function (value) {
    return String(value).replace(/\d/g, function (d) {
      return FA_DIGITS[Number(d)];
    });
  };

  GC.clamp = function (v, min, max) {
    return Math.min(max, Math.max(min, v));
  };

  GC.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  GC.$ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };

  GC.$$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  /** Parses JSON from a <script type="application/json"> element. */
  GC.readJson = function (selector, scope) {
    var el = GC.$(selector, scope);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '');
    } catch (error) {
      console.warn('[GilaClick] Invalid JSON in ' + selector, error);
      return null;
    }
  };

  GC.config = GC.readJson('#gc-config') || {};

  /** Runs fn once el comes within `margin` of the viewport (lazy init for
      below-the-fold work, so the first render stays light). */
  GC.whenNear = function (el, fn, margin) {
    if (!('IntersectionObserver' in window)) return fn(el);
    var io = new IntersectionObserver(
      function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        io.disconnect();
        fn(el);
      },
      { rootMargin: (margin || '600px') + ' 0px' }
    );
    io.observe(el);
  };

  /* ---- Shared scroll / resize loop --------------------------------------
     One passive listener and at most one requestAnimationFrame per frame for
     every scroll-driven effect on the page. Subscribers receive (scrollY, vh)
     and should only MEASURE; if they need to change styles they return a
     function, and all those writes run together afterwards — so layout is
     computed once per frame instead of once per element (no layout thrash). */
  var subscribers = [];
  var ticking = false;

  function flush() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var vh = window.innerHeight;
    var writes = [];
    var i;
    for (i = 0; i < subscribers.length; i++) {
      try {
        var write = subscribers[i](y, vh);
        if (typeof write === 'function') writes.push(write);
      } catch (error) {
        console.error('[GilaClick] scroll subscriber failed', error);
      }
    }
    for (i = 0; i < writes.length; i++) {
      try {
        writes[i]();
      } catch (error) {
        console.error('[GilaClick] scroll update failed', error);
      }
    }
  }

  GC.requestFrame = function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(flush);
    }
  };

  window.addEventListener('scroll', GC.requestFrame, { passive: true });
  window.addEventListener('resize', GC.requestFrame, { passive: true });
  window.addEventListener('load', GC.requestFrame);

  /** Subscribe to the frame-throttled scroll loop (read phase; return a
      function to run in the write phase). Returns an unsubscribe fn. */
  GC.onScroll = function (fn) {
    subscribers.push(fn);
    GC.requestFrame();
    return function () {
      var i = subscribers.indexOf(fn);
      if (i > -1) subscribers.splice(i, 1);
    };
  };

  /* ---- Module registry --------------------------------------------------- */
  var modules = [];

  GC.define = function (name, init) {
    modules.push({ name: name, init: init });
  };

  GC.timings = [];

  GC.start = function () {
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var t0 = performance.now();
      try {
        var result = m.init();
        GC.timings.push([m.name, Math.round((performance.now() - t0) * 10) / 10]);
        if (result && typeof result.then === 'function') {
          result.catch(reportError(m.name));
        }
      } catch (error) {
        reportError(m.name)(error);
      }
    }
    root.classList.add('motion-ready');
  };

  function reportError(name) {
    return function (error) {
      console.error('[GilaClick] module "' + name + '" failed', error);
    };
  }
})();
