/* FAQ-only progressive enhancement. Content and links remain available without JavaScript. */
(function () {
  'use strict';

  function init(root) {
    if (!root || root.dataset.gfReady === '1') return;
    root.dataset.gfReady = '1';
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'fa');
    if (document.body.classList.contains('elementor-editor-active') || document.body.classList.contains('elementor-editor-preview') || /[?&]elementor-preview=/.test(location.search)) {
      root.classList.remove('gf-prejs');
      return;
    }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var small = window.matchMedia('(max-width: 900px)');
    var header = root.querySelector('.ga-header');
    var nav = root.querySelector('.ga-primary-nav');
    var menuToggle = root.querySelector('.ga-menu-toggle a');
    var controls = root.querySelector('.gf-controls');
    var search = root.querySelector('[data-gf-search]');
    var clearButtons = root.querySelectorAll('[data-gf-clear]');
    var results = root.querySelector('[data-gf-results]');
    var empty = root.querySelector('[data-gf-empty]');
    var groups = Array.prototype.slice.call(root.querySelectorAll('.gf-group'));
    var items = Array.prototype.slice.call(root.querySelectorAll('.gf-item'));
    var filters = Array.prototype.slice.call(root.querySelectorAll('[data-gf-filter]'));
    var schema = root.querySelector('[data-gf-schema]');
    var active = 'all';
    var persianDigits = '۰۱۲۳۴۵۶۷۸۹';

    function toPersian(value) { return String(value).replace(/\d/g, function (digit) { return persianDigits[Number(digit)]; }); }
    function textOf(item) {
      var question = item.querySelector('.gf-question .elementor-heading-title');
      var answer = item.querySelector('.gf-answer .elementor-widget-container') || item.querySelector('.gf-answer');
      return ((question && question.textContent) || '') + ' ' + ((answer && answer.textContent) || '');
    }
    function normalize(value) {
      return String(value || '').normalize('NFKC').toLowerCase()
        .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
        .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
        .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06f0); })
        .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200c-\u200f\ufeff\s]/g, '');
    }
    function editSchema(visibleItems) {
      if (!schema) return;
      var questions = visibleItems.map(function (item) {
        var q = item.querySelector('.gf-question .elementor-heading-title');
        var answer = item.querySelector('.gf-answer .elementor-widget-container') || item.querySelector('.gf-answer');
        if (!q || !answer) return null;
        return { '@type': 'Question', name: q.textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: answer.innerHTML.trim() } };
      }).filter(Boolean);
      schema.textContent = questions.length ? JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions }) : '';
    }

    // The server-rendered headings and answer widgets stay editable in Elementor.
    // Only the front end wraps each heading in a native button for keyboard access.
    items.forEach(function (item, index) {
      var title = item.querySelector('.gf-question .elementor-heading-title');
      var panel = item.querySelector('.gf-answer');
      if (!title || !panel) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gf-accordion-trigger';
      button.id = 'gf-question-' + (index + 1);
      button.setAttribute('aria-controls', 'gf-answer-' + (index + 1));
      button.setAttribute('aria-expanded', 'false');
      while (title.firstChild) button.appendChild(title.firstChild);
      title.appendChild(button);
      panel.id = 'gf-answer-' + (index + 1);
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', button.id);
      panel.hidden = true;
      var running = null;
      button.addEventListener('click', function () {
        var open = button.getAttribute('aria-expanded') !== 'true';
        var start = panel.hidden ? 0 : panel.getBoundingClientRect().height;
        if (running) { running.cancel(); running = null; }
        button.setAttribute('aria-expanded', String(open));
        item.classList.toggle('gf-open', open);
        if (open) panel.hidden = false;
        if (reduced.matches || typeof panel.animate !== 'function') {
          panel.hidden = !open;
          return;
        }
        var end = open ? panel.scrollHeight : 0;
        panel.style.overflow = 'hidden';
        running = panel.animate([{ height: start + 'px' }, { height: end + 'px' }], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
        running.onfinish = function () { panel.hidden = !open; panel.style.overflow = ''; running = null; };
        running.oncancel = function () { panel.style.overflow = ''; };
      });
    });

    if (nav && menuToggle) {
      menuToggle.setAttribute('role', 'button');
      menuToggle.setAttribute('aria-controls', nav.id || 'ga-main-nav');
      function closeMenu(restore) {
        menuToggle.setAttribute('aria-expanded', 'false');
        if (small.matches) nav.hidden = true;
        if (restore) menuToggle.focus();
      }
      function syncMenu() { menuToggle.setAttribute('aria-expanded', 'false'); nav.hidden = small.matches; }
      syncMenu();
      menuToggle.addEventListener('click', function (event) { event.preventDefault(); if (!small.matches) return; nav.hidden = !nav.hidden; menuToggle.setAttribute('aria-expanded', String(!nav.hidden)); });
      menuToggle.addEventListener('keydown', function (event) { if (event.key === ' ') { event.preventDefault(); menuToggle.click(); } });
      nav.addEventListener('click', function (event) { if (event.target.closest('a')) closeMenu(false); });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && small.matches && !nav.hidden) closeMenu(true); });
      document.addEventListener('click', function (event) { if (small.matches && !nav.hidden && !event.target.closest('.ga-header')) closeMenu(false); });
      if (small.addEventListener) small.addEventListener('change', syncMenu); else small.addListener(syncMenu);
    }

    // A page imported with Elementor Full Width may use the site's own fixed
    // header instead of the optional FAQ header. Account for either on mobile;
    // never change or hide the site's header, drawer or third-party widgets.
    var externalHeaders = Array.prototype.slice.call(document.querySelectorAll(
      '[data-gch-header], [data-gf-fixed-header], .elementor-location-header, #masthead, .site-header'
    )).filter(function (candidate) { return !root.contains(candidate); });
    function updateMetrics() {
      var bar = document.getElementById('wpadminbar');
      var admin = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
      // Update our own sticky header's top before measuring its rectangle.
      root.style.setProperty('--gf-admin-offset', admin + 'px');
      var headerHeight = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0;
      if (small.matches) {
        var top = admin;
        var candidates = externalHeaders.slice();
        // The editor may leave an empty header container after its contents
        // have been removed in favour of the site-wide header.
        if (header && (header.children.length || header.textContent.trim())) candidates.push(header);
        candidates.map(function (candidate) {
          return { element: candidate, rect: candidate.getBoundingClientRect(), style: getComputedStyle(candidate) };
        }).sort(function (a, b) { return a.rect.top - b.rect.top; }).forEach(function (candidate) {
          var rect = candidate.rect, style = candidate.style;
          if ((style.position === 'sticky' || style.position === 'fixed') &&
              style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 &&
              rect.height <= Math.min(window.innerHeight / 2, 240) && rect.top <= top + 32 && rect.bottom > top) {
            top = rect.bottom;
          }
        });
        headerHeight = Math.max(0, top - admin);
      }
      var controlHeight = controls && getComputedStyle(controls).position === 'sticky' ? controls.getBoundingClientRect().height : 0;
      root.style.setProperty('--gf-header-height', Math.ceil(headerHeight) + 'px');
      root.style.setProperty('--gf-controls-height', Math.ceil(controlHeight) + 'px');
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(updateMetrics);
      if (header) ro.observe(header);
      if (controls) ro.observe(controls);
      externalHeaders.forEach(function (candidate) { ro.observe(candidate); });
    }
    var metricsScheduled = false;
    function scheduleMetrics() {
      if (metricsScheduled) return;
      metricsScheduled = true;
      requestAnimationFrame(function () { metricsScheduled = false; updateMetrics(); });
    }
    window.addEventListener('resize', scheduleMetrics, { passive: true });
    window.addEventListener('scroll', scheduleMetrics, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMetrics);

    function refresh(animateChanges) {
      var query = normalize(search && search.value);
      var visible = [];
      groups.forEach(function (group) {
        var groupItems = Array.prototype.slice.call(group.querySelectorAll('.gf-item'));
        var groupMatches = active === 'all' || group.id === 'gf-group-' + active;
        var count = 0;
        groupItems.forEach(function (item) {
          var show = groupMatches && (!query || normalize(textOf(item)).indexOf(query) !== -1);
          var wasHidden = item.hidden;
          item.hidden = !show;
          if (show) {
            count += 1;
            visible.push(item);
            if (wasHidden && animateChanges && !reduced.matches && item.animate) {
              item.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
                { duration: 260, delay: Math.min((count - 1) * 30, 120), easing: 'cubic-bezier(.22,1,.36,1)' });
            }
          }
        });
        group.hidden = count === 0;
      });
      filters.forEach(function (filter) { filter.setAttribute('aria-pressed', String(filter.getAttribute('data-gf-filter') === active)); });
      if (results) results.textContent = query ? toPersian(visible.length) + ' نتیجه برای جست‌وجوی شما' : toPersian(visible.length) + ' پرسش';
      if (empty) empty.hidden = visible.length > 0;
      clearButtons.forEach(function (button) { if (button.hasAttribute('data-gf-search-clear')) button.hidden = !search || !search.value; });
      editSchema(visible);
    }
    filters.forEach(function (filter) {
      filter.setAttribute('role', 'button');
      filter.addEventListener('click', function (event) {
        event.preventDefault();
        active = filter.getAttribute('data-gf-filter');
        refresh(true);
        var group = active === 'all' ? root.querySelector('#gf-questions') : root.querySelector('#gf-group-' + active);
        if (!group || group.hidden) group = empty && !empty.hidden ? empty : root.querySelector('#gf-questions');
        if (group) group.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      });
      filter.addEventListener('keydown', function (event) { if (event.key === ' ') { event.preventDefault(); filter.click(); } });
    });
    if (search) {
      search.addEventListener('input', function () { refresh(true); });
      search.addEventListener('search', function () { refresh(true); });
      var form = search.closest('form');
      if (form) form.addEventListener('submit', function (event) { event.preventDefault(); });
    }
    clearButtons.forEach(function (button) {
      button.addEventListener('click', function () { if (search) { search.value = ''; search.focus(); } refresh(true); });
    });
    root.classList.remove('gf-prejs');
    root.classList.add('gf-js');
    updateMetrics();
    refresh();

    // IntersectionObserver drives both reveals and pausing of off-screen art.
    var zones = Array.prototype.slice.call(root.querySelectorAll('.gf-zone'));
    var revealItems = Array.prototype.slice.call(root.querySelectorAll('.gf-reveal'));
    var art = root.querySelector('.gf-hero-art');
    if (!reduced.matches && 'IntersectionObserver' in window) {
      root.classList.add('gf-motion');
      revealItems.forEach(function (item, index) { item.style.setProperty('--gf-delay-index', String(index % 4)); });
      var revealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('gf-visible'); observer.unobserve(entry.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: .05 });
      revealItems.forEach(function (item) { revealObserver.observe(item); });
      var zoneObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { entry.target.classList.toggle('gf-paused', !entry.isIntersecting); if (entry.isIntersecting) entry.target.classList.add('gf-on'); });
      }, { rootMargin: '120px 0px', threshold: .01 });
      zones.forEach(function (zone) { zone.classList.add('gf-paused'); });
      requestAnimationFrame(function () { requestAnimationFrame(function () { zones.forEach(function (zone) { zoneObserver.observe(zone); }); }); });
    } else {
      revealItems.forEach(function (item) { item.classList.add('gf-visible'); });
      zones.forEach(function (zone) { zone.classList.add('gf-on'); });
    }
    document.addEventListener('visibilitychange', function () { root.classList.toggle('gf-document-hidden', document.hidden); });
    var desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
    var hero = root.querySelector('.gf-hero');
    if (art && hero && !reduced.matches) {
      var ticking = false;
      function parallax() {
        ticking = false;
        if (!desktopPointer.matches) { art.style.setProperty('--gf-scroll-shift', '0px'); return; }
        var rect = hero.getBoundingClientRect();
        var shift = rect.bottom > 0 ? Math.max(-22, Math.min(22, -rect.top * .055)) : 0;
        art.style.setProperty('--gf-scroll-shift', shift.toFixed(1) + 'px');
      }
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
      hero.addEventListener('pointermove', function (event) {
        if (!desktopPointer.matches) return;
        var box = hero.getBoundingClientRect();
        art.style.setProperty('--gf-pointer-x', ((event.clientX - box.left) / box.width - .5).toFixed(2) * 12 + 'px');
        art.style.setProperty('--gf-pointer-y', ((event.clientY - box.top) / box.height - .5).toFixed(2) * 10 + 'px');
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { art.style.setProperty('--gf-pointer-x', '0px'); art.style.setProperty('--gf-pointer-y', '0px'); });
    }
  }
  var script = document.currentScript;
  var root = script && script.closest('.gf-page');
  if (root) init(root);
  else document.querySelectorAll('.gf-page').forEach(init);
})();
