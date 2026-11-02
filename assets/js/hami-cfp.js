/* Lightweight progressive enhancement. WooCommerce remains responsible for commerce and reviews. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }
  function upgradePreviewImages(root) {
    function upgrade(img) {
      var original = img.getAttribute('data-hcf-original');
      if (!original) return;
      var probe = new Image();
      probe.onload = function () { img.src = original; };
      probe.src = original;
    }
    var observer = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        upgrade(entry.target);
      });
    }, { rootMargin: '300px 0px' }) : null;
    root.querySelectorAll('img[data-hcf-original]').forEach(function (img) {
      if (img.loading === 'lazy' && observer) observer.observe(img);
      else upgrade(img);
    });
  }
  function headerOffset(root) {
    var last = -1;
    function update() {
      var admin = document.getElementById('wpadminbar');
      var bottom = admin && getComputedStyle(admin).position !== 'absolute' ? Math.max(0, admin.getBoundingClientRect().bottom) : 0;
      document.querySelectorAll('.ga-header, .elementor-location-header, .site-header, #masthead, .gch-header, [data-hcf-fixed-header]').forEach(function (header) {
        var style = getComputedStyle(header);
        var rect = header.getBoundingClientRect();
        if ((style.position === 'sticky' || style.position === 'fixed') && rect.height && rect.top <= bottom + 3 && rect.bottom > bottom) bottom = rect.bottom;
      });
      var next = Math.ceil(bottom);
      if (next !== last) { last = next; root.style.setProperty('--hcf-top', next + 'px'); }
    }
    var pending = false;
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; update(); });
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    if ('ResizeObserver' in window) {
      var observer = new ResizeObserver(schedule);
      document.querySelectorAll('.ga-header, .elementor-location-header, .site-header, #masthead, .gch-header, #wpadminbar, [data-hcf-fixed-header]').forEach(function (el) { observer.observe(el); });
    }
    update();
  }
  function setupAnchors(root, reduced) {
    root.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#hcf-"]');
      if (!link || !root.contains(link)) return;
      var target = root.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', link.getAttribute('href'));
    });
  }
  function setupFaq(root, reduced) {
    root.querySelectorAll('.hcf-faq-item').forEach(function (item, index) {
      var title = item.querySelector('.hcf-faq-question .elementor-heading-title');
      var answer = item.querySelector('.hcf-faq-answer');
      if (!title || !answer || title.querySelector('button')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'hcf-faq-trigger';
      while (title.firstChild) button.appendChild(title.firstChild);
      title.appendChild(button);
      answer.id = answer.id || 'hcf-answer-' + (index + 1);
      button.setAttribute('aria-controls', answer.id);
      button.setAttribute('aria-expanded', 'false');
      answer.hidden = true;
      var animation = null;
      var targetOpen = false;
      button.addEventListener('click', function () {
        var startHeight = answer.hidden ? 0 : answer.getBoundingClientRect().height;
        var startOpacity = answer.hidden ? 0 : parseFloat(getComputedStyle(answer).opacity);
        if (animation) { animation.onfinish = animation.oncancel = null; animation.cancel(); animation = null; }
        targetOpen = !targetOpen;
        button.setAttribute('aria-expanded', String(targetOpen));
        if (targetOpen) answer.hidden = false;
        if (reduced.matches || typeof answer.animate !== 'function') {
          answer.hidden = !targetOpen;
          answer.style.overflow = '';
          return;
        }
        var height = answer.scrollHeight;
        answer.style.overflow = 'hidden';
        animation = answer.animate([{ height: startHeight + 'px', opacity: startOpacity }, { height: (targetOpen ? height : 0) + 'px', opacity: targetOpen ? 1 : 0 }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
        animation.onfinish = function () { answer.hidden = !targetOpen; answer.style.overflow = ''; animation = null; };
        animation.oncancel = function () { answer.style.overflow = ''; animation = null; };
      });
    });
  }
  function setupTabs(root) {
    var tabs = root.querySelector('.hcf-tabs .woocommerce-tabs, .hcf-tabs .wc-tabs-wrapper');
    if (!tabs) return;
    var links = Array.from(tabs.querySelectorAll('ul.tabs > li > a'));
    var panels = links.map(function (link) {
      var id = (link.getAttribute('href') || '').split('#')[1];
      var panel = id && document.getElementById(id);
      return panel && tabs.contains(panel) ? panel : null;
    });
    if (!links.length || panels.some(function (panel) { return !panel; })) return;
    var list = tabs.querySelector('ul.tabs');
    var nativeWoo = !!(window.jQuery && typeof window.wc_single_product_params !== 'undefined');
    list.setAttribute('role', 'tablist');
    links.forEach(function (link, index) {
      var holder = link.parentElement;
      link.id = link.id || (holder.id || 'hcf-tab-' + (index + 1)) + '-link';
      holder.setAttribute('role', 'presentation');
      holder.removeAttribute('aria-controls');
      link.setAttribute('role', 'tab');
      link.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', link.id);
    });
    function sync(index) {
      links.forEach(function (link, i) {
        var active = i === index;
        // Woo uses the parent list item's selected state. The actual focusable
        // tab is the link, so keep its ARIA in sync without changing Woo's UI.
        if (link.parentElement.hasAttribute('aria-selected')) link.parentElement.removeAttribute('aria-selected');
        link.setAttribute('aria-selected', String(active));
        link.setAttribute('tabindex', active ? '0' : '-1');
        if (!nativeWoo) {
          link.parentElement.classList.toggle('active', active);
          panels[i].hidden = !active;
        }
      });
    }
    function activeIndex() {
      var active = links.findIndex(function (link) { return link.parentElement.classList.contains('active'); });
      return Math.max(0, active);
    }
    function select(index, focus) {
      if (nativeWoo) links[index].click();
      sync(index);
      if (focus) links[index].focus();
    }
    links.forEach(function (link, index) {
      if (!nativeWoo) link.addEventListener('click', function (event) { event.preventDefault(); select(index, false); });
      link.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowLeft') next = (index + 1) % links.length;
        else if (event.key === 'ArrowRight') next = (index - 1 + links.length) % links.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = links.length - 1;
        else return;
        event.preventDefault(); select(next, true);
      });
    });
    if (nativeWoo) {
      if ('MutationObserver' in window) {
        var observer = new MutationObserver(function () { sync(activeIndex()); });
        links.forEach(function (link) { observer.observe(link.parentElement, { attributes: true, attributeFilter: ['class', 'aria-selected'] }); });
      }
      sync(activeIndex());
    } else {
      var selected = links.findIndex(function (link) { return link.getAttribute('href') === location.hash; });
      if (selected < 0 && /(?:reviews|comment-)/.test(location.hash)) selected = links.findIndex(function (link) { return link.closest('.reviews_tab'); });
      sync(Math.max(0, selected));
    }
  }
  function setupGallery(root) {
    var gallery = root.querySelector('.hcf-woo-gallery');
    var zoom = root.querySelector('.hcf-zoom');
    var capture = root.querySelector('.hcf-capture-image');
    var dialog = root.querySelector('.hcf-lightbox');
    if (!gallery || !zoom || !dialog) return;
    var slides = Array.from(gallery.querySelectorAll('.woocommerce-product-gallery__wrapper > .woocommerce-product-gallery__image'));
    // Some existing media have no alt text. Give otherwise unnamed Woo image
    // links a usable name without overwriting media-library descriptions.
    slides.forEach(function (slide, index) {
      var link = slide.querySelector('a');
      var img = link && link.querySelector('img');
      if (link && !link.getAttribute('aria-label') && !link.getAttribute('aria-labelledby') &&
          !link.textContent.trim() && (!img || !img.getAttribute('alt'))) {
        link.setAttribute('aria-label', 'بزرگ‌نمایی تصویر ' + (index + 1) + ' محصول');
      }
    });
    var nativeSlider = typeof window.wc_single_product_params !== 'undefined' && window.wc_single_product_params.flexslider_enabled;
    if (slides.length > 1 && !nativeSlider) {
      var thumbs = document.createElement('div');
      thumbs.className = 'hcf-fallback-thumbs';
      thumbs.setAttribute('aria-label', 'انتخاب تصویر محصول');
      var buttons = slides.map(function (slide, index) {
        var button = document.createElement('button');
        var image = slide.querySelector('img:not(.zoomImg)');
        var thumb = document.createElement('img');
        button.type = 'button';
        button.setAttribute('aria-label', 'تصویر ' + (index + 1) + ' از ' + slides.length);
        thumb.src = slide.getAttribute('data-thumb') || (image && (image.currentSrc || image.src)) || '';
        thumb.alt = '';
        button.appendChild(thumb);
        button.addEventListener('click', function () { select(index); });
        thumbs.appendChild(button);
        return button;
      });
      function select(index) {
        slides.forEach(function (slide, i) { slide.hidden = i !== index; slide.classList.toggle('hcf-active-image', i === index); });
        buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === index)); });
      }
      gallery.appendChild(thumbs);
      select(0);
    } else if (nativeSlider && slides.length > 1) {
      // Woo thumbnails are images; make the native controls operable by keyboard.
      var observer;
      function enableThumbs() {
        var images = gallery.querySelectorAll('.flex-control-thumbs img');
        images.forEach(function (image, index) {
          if (image.dataset.hcfKeyboard) return;
          image.dataset.hcfKeyboard = '1'; image.tabIndex = 0; image.setAttribute('role', 'button');
          image.setAttribute('aria-label', 'مشاهده تصویر ' + (index + 1) + ' از ' + images.length);
          image.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); image.click(); } });
        });
        if (images.length && observer) observer.disconnect();
      }
      if ('MutationObserver' in window) { observer = new MutationObserver(enableThumbs); observer.observe(gallery, { childList: true, subtree: true }); }
      enableThumbs();
      window.addEventListener('load', enableThumbs, { once: true });
      if (observer) setTimeout(function () { observer.disconnect(); }, 10000);
    }
    function photo(img) {
      if (!img) return null;
      var anchor = img.closest('a');
      var src = (anchor && anchor.getAttribute('href')) || img.getAttribute('data-large_image') || img.currentSrc || img.src;
      // Standalone preview falls back to the genuine screenshot crop when offline.
      if (img.hasAttribute('data-hcf-original') && img.currentSrc && img.currentSrc.indexOf('data:') === 0) src = img.currentSrc;
      if (!src || /woocommerce-placeholder/i.test(src)) return null;
      return { src: src, alt: img.alt || '' };
    }
    function items() {
      var result = [];
      gallery.querySelectorAll('.woocommerce-product-gallery__image img:not(.zoomImg)').forEach(function (img) {
        var p = photo(img); if (p && !result.some(function (entry) { return entry.src === p.src; })) result.push(p);
      });
      var extra = capture && photo(capture.querySelector('img'));
      if (extra && !result.some(function (entry) { return entry.src === extra.src; })) result.push(extra);
      return result;
    }
    if (gallery.querySelector('.woocommerce-product-gallery__image img:not(.zoomImg)')) zoom.hidden = false;
    var image = dialog.querySelector('img');
    var close = dialog.querySelector('[data-hcf-close]');
    var previous = dialog.querySelector('[data-hcf-prev]');
    var next = dialog.querySelector('[data-hcf-next]');
    var list = [];
    var index = 0;
    var opener = null;
    function render() {
      if (!list.length) return;
      index = (index + list.length) % list.length;
      image.src = list[index].src; image.alt = list[index].alt;
      previous.hidden = next.hidden = list.length < 2;
    }
    function open(at, trigger) {
      list = items();
      if (!list.length) return false;
      index = Math.max(0, Math.min(at, list.length - 1)); opener = trigger; render();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      close.focus(); return true;
    }
    zoom.addEventListener('click', function () {
      var active = gallery.querySelector('.flex-active-slide img:not(.zoomImg), .hcf-active-image img:not(.zoomImg)');
      var activePhoto = photo(active);
      var current = items();
      open(activePhoto ? Math.max(0, current.findIndex(function (p) { return p.src === activePhoto.src; })) : 0, zoom);
    });
    if (capture) capture.addEventListener('click', function (event) {
      var link = event.target.closest('a');
      var p = photo(capture.querySelector('img'));
      if (!link || !p) return;
      var index = items().findIndex(function (entry) { return entry.src === p.src; });
      if (index >= 0 && open(index, link)) event.preventDefault();
    });
    function finish() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.removeAttribute('open');
      if (opener) opener.focus();
    }
    close.addEventListener('click', finish);
    previous.addEventListener('click', function () { index--; render(); });
    next.addEventListener('click', function () { index++; render(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) finish(); });
    dialog.addEventListener('cancel', function () { setTimeout(function () { if (opener) opener.focus(); }, 0); });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' && list.length > 1) { event.preventDefault(); previous.click(); }
      if (event.key === 'ArrowLeft' && list.length > 1) { event.preventDefault(); next.click(); }
      if (event.key === 'Escape' && typeof dialog.close !== 'function') { event.preventDefault(); finish(); }
    });
  }
  function motion(root, reduced) {
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    var elements = root.querySelectorAll('.hcf-reveal');
    var reveal = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('hcf-visible'); observer.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px -4% 0px', threshold: .03 });
    elements.forEach(function (el, index) { el.style.setProperty('--hcf-delay', (index % 3 * 75) + 'ms'); reveal.observe(el); });
    root.classList.add('hcf-motion');
    var hero = root.querySelector('.hcf-hero-visual');
    if (hero) {
      var orbit = new IntersectionObserver(function (entries) { root.classList.toggle('hcf-orbit-running', entries[0].isIntersecting); }, { threshold: .01 });
      orbit.observe(hero);
    }
    if (reduced.addEventListener) reduced.addEventListener('change', function () { if (reduced.matches) root.classList.remove('hcf-motion', 'hcf-orbit-running'); });
  }
  function init(root) {
    if (root.dataset.hcfReady || document.body.classList.contains('elementor-editor-active') || document.body.classList.contains('elementor-editor-preview') || /(?:\?|&)elementor-preview=/.test(location.search)) return;
    root.dataset.hcfReady = '1';
    var main = root.querySelector('.hcf-main');
    if (main && !main.matches('main,[role="main"]') && !document.querySelector('main,[role="main"]')) main.setAttribute('role', 'main');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    upgradePreviewImages(root);
    headerOffset(root);
    setupAnchors(root, reduced);
    setupFaq(root, reduced);
    setupTabs(root);
    setupGallery(root);
    var additional = root.querySelector('.hcf-additional');
    if (additional && !additional.querySelector('.shop_attributes tr')) additional.hidden = true;
    var related = root.querySelector('.hcf-related');
    if (related && !related.querySelector('li.product')) related.hidden = true;
    root.classList.add('hcf-js');
    motion(root, reduced);
  }
  ready(function () { document.querySelectorAll('.hcf-page').forEach(init); });
}());
