/* Product-page progressive enhancement. WooCommerce remains the source of product data and purchasing. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }
  function text(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function normalized(el) { return text(el).normalize('NFKC'); }
  function directContent(widget) {
    return widget && (widget.querySelector(':scope > .elementor-widget-container') || widget);
  }
  function setAnchor(element, fallback) {
    if (!element) return '';
    if (!element.id) element.id = fallback;
    element.classList.add('gpd-anchor');
    return element.id;
  }
  function addPreviewImageFallbacks(root) {
    // The standalone starts with a local, clearly documented fallback. Replace it only
    // after the real store image has actually loaded; without JS the sample remains usable.
    root.querySelectorAll('img[data-gpd-original]').forEach(function (img) {
      var source = img.getAttribute('data-gpd-original');
      if (!source) return;
      var probe = new Image();
      probe.onload = function () { img.src = source; };
      probe.src = source;
    });
  }
  function setupPreviewMenu(root) {
    var header = root.querySelector('.ga-header');
    var nav = header && header.querySelector('.ga-primary-nav');
    var button = header && header.querySelector('.ga-menu-toggle .elementor-button');
    if (!nav || !button) return;
    var small = window.matchMedia('(max-width: 900px)');
    if (!nav.id) nav.id = 'gpd-preview-nav';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-controls', nav.id);
    function close(restore) {
      if (small.matches) nav.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (restore) button.focus();
    }
    function resize() { nav.hidden = small.matches; button.setAttribute('aria-expanded', 'false'); }
    resize();
    button.addEventListener('click', function (e) {
      e.preventDefault();
      if (!small.matches) return;
      nav.hidden = !nav.hidden;
      button.setAttribute('aria-expanded', String(!nav.hidden));
    });
    button.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); button.click(); } });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && small.matches && !nav.hidden) close(true); });
    document.addEventListener('click', function (e) { if (small.matches && !nav.hidden && !header.contains(e.target)) close(false); });
    if (small.addEventListener) small.addEventListener('change', resize); else small.addListener(resize);
  }
  function setupHeaderOffset(root) {
    function update() {
      var admin = document.getElementById('wpadminbar');
      var adminBottom = admin && getComputedStyle(admin).position !== 'absolute' ? Math.max(0, admin.getBoundingClientRect().bottom) : 0;
      var top = adminBottom;
      var candidates = document.querySelectorAll('.ga-header, .elementor-location-header, .site-header, #masthead, .gch-header');
      candidates.forEach(function (header) {
        var style = getComputedStyle(header);
        var rect = header.getBoundingClientRect();
        if ((style.position === 'sticky' || style.position === 'fixed') && rect.height && rect.top <= adminBottom + 3 && rect.bottom > top) top = rect.bottom;
      });
      root.style.setProperty('--gpd-top', Math.ceil(top) + 'px');
      root.style.setProperty('--gpd-admin-offset', Math.ceil(adminBottom) + 'px');
    }
    var ticking = false;
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    update();
  }
  function setupIntro(root, content) {
    var short = root.querySelector('.gpd-short');
    if (!short) return;
    if (text(short)) return;
    var first = content && Array.from(content.children).find(function (node) {
      return node.tagName === 'P' && text(node) && !node.querySelector('img, video, iframe, form');
    });
    if (first) {
      var paragraph = document.createElement('p');
      paragraph.className = 'gpd-intro-fallback';
      paragraph.textContent = text(first);
      var inner = directContent(short);
      inner.appendChild(paragraph);
    } else short.classList.add('is-empty');
  }
  function setupFeatures(root, content) {
    if (!content) return null;
    var heading = Array.from(content.children).find(function (node) {
      return /^H[23]$/.test(node.tagName) && /(?:مزایا|مزایای|قابلیت|ویژگی|امکانات)/.test(text(node));
    });
    if (!heading) return null;
    setAnchor(heading, 'gpd-features');
    var node = heading.nextElementSibling;
    var groups = [];
    while (node && node.tagName === 'H3') {
      var group = [node];
      node = node.nextElementSibling;
      while (node && /^(P|UL|OL|BLOCKQUOTE)$/.test(node.tagName) && !node.querySelector('img, video, iframe, form, script, style, table')) {
        group.push(node);
        node = node.nextElementSibling;
      }
      groups.push(group);
    }
    // Only restructure an unambiguous consecutive list of feature headings and text.
    if (groups.length >= 2 && groups.every(function (group) { return group.length > 1; })) {
      var grid = document.createElement('div');
      grid.className = 'gpd-feature-grid';
      heading.after(grid);
      groups.forEach(function (group) {
        var card = document.createElement('div');
        card.className = 'gpd-feature gpd-reveal';
        group.forEach(function (part) { card.appendChild(part); });
        grid.appendChild(card);
      });
      var chips = root.querySelector('.gpd-hero-chips');
      if (chips) groups.slice(0, 3).forEach(function (group) {
        var value = text(group[0]).replace(/^[\d۰-۹٠-٩]+[.\-:：\s]+/, '');
        if (value.length > 43) value = value.slice(0, 43).replace(/\s+\S*$/, '') + '…';
        var chip = document.createElement('span');
        chip.className = 'gpd-chip';
        chip.textContent = value;
        chips.appendChild(chip);
      });
    }
    return heading;
  }
  function setupFaq(content, reduced) {
    if (!content) return null;
    var heading = Array.from(content.children).find(function (node) {
      return /^H[23]$/.test(node.tagName) && /(?:سوالات|سؤالات|پرسش[‌\s]*(?:های)?\s*متداول|FAQ)/i.test(text(node));
    });
    if (!heading) return null;
    setAnchor(heading, 'gpd-faq');
    var question = heading.nextElementSibling;
    var pairs = [];
    while (question && question.tagName === 'P' && question.children.length === 1 && /^(STRONG|B)$/.test(question.firstElementChild.tagName) && /[؟?]\s*$/.test(text(question))) {
      var answer = question.nextElementSibling;
      if (!answer || answer.tagName !== 'P' || !text(answer) || answer.querySelector('form, script, iframe, video')) break;
      pairs.push([question, answer]);
      question = answer.nextElementSibling;
    }
    pairs.forEach(function (pair) {
      var details = document.createElement('details');
      details.className = 'gpd-faq-item';
      var summary = document.createElement('summary');
      var answer = document.createElement('div');
      answer.className = 'gpd-faq-answer';
      pair[0].before(details);
      summary.appendChild(pair[0]);
      answer.appendChild(pair[1]);
      details.appendChild(summary);
      details.appendChild(answer);
      if (typeof details.animate === 'function') {
        var animation;
        var targetOpen = details.open;
        summary.addEventListener('click', function (event) {
          // Remember the requested state while an animation is in flight. Otherwise
          // a rapid close/reopen would still see details.open as true and close again.
          if (reduced.matches) {
            if (animation) {
              animation.onfinish = animation.oncancel = null;
              animation.cancel();
              animation = null;
              details.open = targetOpen;
              answer.style.overflow = '';
            }
            targetOpen = !details.open; // The native click performs the actual toggle.
            return;
          }
          event.preventDefault();
          var opening = !(animation ? targetOpen : details.open);
          var startHeight = details.open ? answer.getBoundingClientRect().height : 0;
          var startOpacity = details.open ? parseFloat(getComputedStyle(answer).opacity) : 0;
          if (animation) {
            animation.onfinish = animation.oncancel = null;
            animation.cancel();
          }
          targetOpen = opening;
          if (opening) details.open = true;
          var height = answer.scrollHeight;
          answer.style.overflow = 'hidden';
          animation = answer.animate(
            [{ height: startHeight + 'px', opacity: startOpacity }, { height: (opening ? height : 0) + 'px', opacity: opening ? 1 : 0 }],
            { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
          animation.onfinish = function () { if (!targetOpen) details.open = false; answer.style.overflow = ''; animation = null; };
          animation.oncancel = function () { answer.style.overflow = ''; animation = null; };
        });
      }
    });
    return heading;
  }
  function setupSpecs(root) {
    var specs = root.querySelector('.gpd-specs');
    var table = specs && specs.querySelector('.shop_attributes');
    var rows = table ? Array.from(table.querySelectorAll('tr')) : [];
    if (!rows.length) { if (specs) specs.hidden = true; return null; }
    setAnchor(specs, 'gpd-specs');
    var quick = root.querySelector('.gpd-quick');
    if (quick) rows.slice(0, 4).forEach(function (row) {
      var label = text(row.querySelector('th'));
      var value = text(row.querySelector('td'));
      if (!label || !value) return;
      var item = document.createElement('div');
      var caption = document.createElement('span');
      var detail = document.createElement('strong');
      item.className = 'gpd-quick-item';
      caption.textContent = label;
      detail.textContent = value;
      item.appendChild(caption);
      item.appendChild(detail);
      quick.appendChild(item);
    });
    return specs;
  }
  function samePanel(panel, reference) {
    if (!panel || !reference) return false;
    if (normalized(panel) === normalized(reference) && normalized(reference)) return true;
    var clone = panel.cloneNode(true);
    var heading = clone.querySelector(':scope > h2');
    if (heading) heading.remove();
    return Boolean(normalized(reference)) && normalized(clone) === normalized(reference);
  }
  function setupFallbackTabs(tabs, links) {
    var panels = links.map(function (link) {
      var id = (link.getAttribute('href') || '').split('#')[1];
      var panel = id && document.getElementById(id);
      return panel && tabs.contains(panel) ? panel : null;
    });
    // If a third-party tab has a different structure, leave its original behaviour intact.
    if (panels.some(function (panel) { return !panel; })) return;
    function select(index, focus) {
      links.forEach(function (link, i) {
        var active = i === index;
        link.setAttribute('aria-selected', String(active));
        link.setAttribute('tabindex', active ? '0' : '-1');
        link.parentElement.classList.toggle('active', active);
        panels[i].hidden = !active;
      });
      if (focus) links[index].focus();
    }
    links.forEach(function (link, index) {
      link.addEventListener('click', function (event) { event.preventDefault(); select(index, false); });
      link.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowLeft') next = (index + 1) % links.length;
        else if (event.key === 'ArrowRight') next = (index - 1 + links.length) % links.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = links.length - 1;
        else return;
        event.preventDefault();
        select(next, true);
      });
    });
    var selected = links.findIndex(function (link) { return link.getAttribute('href') === location.hash; });
    if (selected < 0 && /(?:reviews|comment-)/.test(location.hash)) selected = links.findIndex(function (link) { return link.closest('.reviews_tab'); });
    select(Math.max(0, selected), false);
  }
  function setupExtraTabs(root, content) {
    var extras = root.querySelector('.gpd-extras');
    var tabs = extras && extras.querySelector('.woocommerce-tabs, .wc-tabs-wrapper');
    if (!extras || !tabs) { if (extras) extras.hidden = true; return null; }
    // Remove duplicate default tabs only when their complete content is identical to the native widgets above.
    // Third-party tabs and additional injected content remain untouched.
    var pairs = [
      ['description', content],
      ['additional_information', root.querySelector('.gpd-specs .shop_attributes')]
    ];
    pairs.forEach(function (pair) {
      var link = tabs.querySelector('li.' + pair[0] + '_tab');
      var panel = tabs.querySelector('.woocommerce-Tabs-panel--' + pair[0]);
      var reference = pair[1];
      if (link && panel && samePanel(panel, reference)) {
        link.remove();
        panel.remove();
      }
    });
    var links = Array.from(tabs.querySelectorAll('ul.tabs > li a'));
    var other = Array.from(tabs.children).some(function (el) { return !el.matches('ul.tabs, .woocommerce-Tabs-panel') && text(el); });
    if (!links.length && !other) { extras.hidden = true; return null; }
    setAnchor(extras, 'gpd-extras');
    if (links.length && window.jQuery && typeof window.wc_single_product_params !== 'undefined') {
      var activate = function () {
        if (!tabs.querySelector('ul.tabs > li.active')) {
          var wanted = location.hash && /(?:reviews|comment-)/.test(location.hash) ? tabs.querySelector('li.reviews_tab a') : null;
          window.jQuery(wanted || links[0]).trigger('click');
        }
      };
      setTimeout(activate, 80);
      window.addEventListener('load', activate, { once: true });
    } else if (links.length) {
      // Block themes may not enqueue WooCommerce's legacy single-product script.
      setupFallbackTabs(tabs, links);
    }
    return extras;
  }
  function setupGallery(root) {
    var gallery = root.querySelector('.gpd-gallery');
    var zoom = root.querySelector('.gpd-zoom');
    var dialog = root.querySelector('.gpd-lightbox');
    if (!gallery || !zoom || !dialog) return null;
    function photos() {
      var result = [];
      gallery.querySelectorAll('.woocommerce-product-gallery__image img:not(.zoomImg)').forEach(function (img) {
        var anchor = img.closest('a');
        var src = (anchor && anchor.getAttribute('href')) || img.getAttribute('data-large_image') || img.currentSrc || img.src;
        if (!src || /woocommerce-placeholder/i.test(src)) return;
        // A static preview fallback is intentionally used when the original cannot be loaded.
        if (img.getAttribute('data-gpd-fallback') === null && img.currentSrc && img.currentSrc.indexOf('data:') === 0) src = img.currentSrc;
        if (!result.some(function (photo) { return photo.src === src; })) result.push({ src: src, alt: img.alt || '' });
      });
      return result;
    }
    if (!photos().length) { zoom.hidden = true; return null; }
    zoom.hidden = false;
    setAnchor(gallery, 'gpd-gallery');
    var slides = Array.from(gallery.querySelectorAll('.woocommerce-product-gallery__wrapper > .woocommerce-product-gallery__image'));
    var nativeSlider = typeof window.wc_single_product_params !== 'undefined' && window.wc_single_product_params.flexslider_enabled && window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.flexslider === 'function';
    if (slides.length > 1 && !nativeSlider) {
      // Some themes don't opt in to WooCommerce's FlexSlider. Keep every real image
      // reachable with ordinary buttons rather than stacking images or replacing the gallery.
      var thumbs = document.createElement('div');
      thumbs.className = 'gpd-fallback-thumbs';
      thumbs.setAttribute('aria-label', 'انتخاب تصویر محصول');
      var buttons = slides.map(function (slide, index) {
        var button = document.createElement('button');
        var img = slide.querySelector('img');
        var thumb = document.createElement('img');
        button.type = 'button';
        button.setAttribute('aria-label', 'تصویر ' + (index + 1) + ' از ' + slides.length);
        thumb.src = slide.getAttribute('data-thumb') || (img && (img.currentSrc || img.src)) || '';
        thumb.alt = '';
        button.appendChild(thumb);
        button.addEventListener('click', function () { select(index); });
        thumbs.appendChild(button);
        return button;
      });
      function select(index) {
        slides.forEach(function (slide, i) { slide.hidden = i !== index; slide.classList.toggle('gpd-active-image', i === index); });
        buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === index)); });
      }
      gallery.appendChild(thumbs);
      select(0);
    } else if (nativeSlider && slides.length > 1) {
      // WooCommerce's thumbnail images are clickable; make them keyboard-operable too.
      var observer;
      function enableNativeThumbs() {
        var thumbs = gallery.querySelectorAll('.flex-control-thumbs li img');
        if (!thumbs.length) return;
        thumbs.forEach(function (thumb, index) {
          if (thumb.dataset.gpdKeyboard) return;
          thumb.dataset.gpdKeyboard = '1';
          thumb.setAttribute('tabindex', '0');
          thumb.setAttribute('role', 'button');
          thumb.setAttribute('aria-label', 'مشاهده تصویر ' + (index + 1) + ' از ' + thumbs.length);
          thumb.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); thumb.click(); }
          });
        });
        if (observer) observer.disconnect();
      }
      if ('MutationObserver' in window) { observer = new MutationObserver(enableNativeThumbs); observer.observe(gallery, { childList: true, subtree: true }); }
      enableNativeThumbs();
      window.addEventListener('load', enableNativeThumbs, { once: true });
      if (observer) setTimeout(function () { observer.disconnect(); }, 10000);
    }
    var image = dialog.querySelector('img');
    var close = dialog.querySelector('[data-gpd-close]');
    var previous = dialog.querySelector('[data-gpd-prev]');
    var next = dialog.querySelector('[data-gpd-next]');
    var index = 0;
    var items = [];
    function render() {
      if (!items.length) return;
      index = (index + items.length) % items.length;
      image.src = items[index].src;
      image.alt = items[index].alt;
      previous.hidden = next.hidden = items.length < 2;
    }
    zoom.addEventListener('click', function () {
      items = photos();
      if (!items.length) return;
      var active = gallery.querySelector('.flex-active-slide img, .gpd-active-image img');
      var activeAnchor = active && active.closest('a');
      var activeSrc = activeAnchor && activeAnchor.getAttribute('href');
      index = Math.max(0, items.findIndex(function (item) { return item.src === activeSrc; }));
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      close.focus();
    });
    function closeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.removeAttribute('open');
      zoom.focus();
    }
    close.addEventListener('click', closeDialog);
    previous.addEventListener('click', function () { index -= 1; render(); });
    next.addEventListener('click', function () { index += 1; render(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
    dialog.addEventListener('cancel', function () { setTimeout(function () { zoom.focus(); }, 0); });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' && items.length > 1) { event.preventDefault(); previous.click(); }
      if (event.key === 'ArrowLeft' && items.length > 1) { event.preventDefault(); next.click(); }
      if (event.key === 'Escape' && typeof dialog.close !== 'function') { event.preventDefault(); closeDialog(); }
    });
    return gallery;
  }
  function setupNavigation(root, destinations, reduced) {
    var navWrap = root.querySelector('.gpd-section-nav');
    var nav = navWrap && navWrap.querySelector('nav');
    if (!nav) return;
    destinations.forEach(function (destination) {
      if (!destination[1]) return;
      var id = setAnchor(destination[1], destination[2]);
      var link = document.createElement('a');
      link.href = '#' + id;
      link.textContent = destination[0];
      link.addEventListener('click', function (event) {
        event.preventDefault();
        destination[1].scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(id));
      });
      nav.appendChild(link);
      destination.push(link);
    });
    if (!nav.children.length) return;
    navWrap.classList.add('has-links');
    var ticking = false;
    function update() {
      ticking = false;
      var offset = (parseFloat(getComputedStyle(root).getPropertyValue('--gpd-top')) || 0) + navWrap.getBoundingClientRect().height + 32;
      var positions = destinations.filter(function (item) { return item[1] && item[3]; }).map(function (item) { return { item: item, y: item[1].getBoundingClientRect().top }; });
      positions.sort(function (a, b) { return a.y - b.y; });
      var current = positions[0];
      positions.forEach(function (position) { if (position.y <= offset) current = position; });
      destinations.forEach(function (item) { if (item[3]) item[3].removeAttribute('aria-current'); });
      if (current) current.item[3].setAttribute('aria-current', 'location');
    }
    function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
  }
  function setupMobileCTA(root) {
    var bar = root.querySelector('.gpd-mobile-cta');
    var card = root.querySelector('.gpd-purchase');
    var form = card && card.querySelector('.gpd-add form, .gpd-add a.single_add_to_cart_button');
    if (!bar || !card || !form) return;
    function update() {
      var rect = card.getBoundingClientRect();
      var top = parseFloat(getComputedStyle(root).getPropertyValue('--gpd-top')) || 0;
      bar.classList.toggle('is-visible', rect.bottom < top + 80 || rect.top > window.innerHeight - 110);
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }
  function setupMotion(root, reduced) {
    var elements = root.querySelectorAll('.gpd-reveal');
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    root.classList.add('gpd-motion');
    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('gpd-visible'); obs.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px -5% 0px', threshold: .04 });
    elements.forEach(function (element, index) { element.style.setProperty('--gpd-order', String(index % 3)); observer.observe(element); });
    if (reduced.addEventListener) reduced.addEventListener('change', function () { if (reduced.matches) root.classList.remove('gpd-motion'); });
  }
  function init(root) {
    if (root.dataset.gpdReady || document.body.classList.contains('elementor-editor-active') || document.body.classList.contains('elementor-editor-preview')) return;
    root.dataset.gpdReady = '1';
    var main = root.querySelector('.gpd-main');
    // Some block themes do not provide a main landmark around the template;
    // classic themes often do. Avoid introducing nested or duplicate landmarks.
    if (main && !main.matches('main, [role="main"]') && !document.querySelector('main, [role="main"]')) main.setAttribute('role', 'main');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    addPreviewImageFallbacks(root);
    setupPreviewMenu(root);
    setupHeaderOffset(root);
    var content = directContent(root.querySelector('.gpd-content'));
    root.querySelectorAll('.gpd-content table, .gpd-specs table').forEach(function (table) {
      if (!table.hasAttribute('tabindex')) table.setAttribute('tabindex', '0');
    });
    var description = root.querySelector('.gpd-description');
    if (description && (!content || !text(content) && !content.querySelector('img, video, iframe'))) description.hidden = true;
    setupIntro(root, content);
    var specs = setupSpecs(root);
    // Compare duplicate tabs before enhancing the original DOM.
    var extras = setupExtraTabs(root, content);
    var features = setupFeatures(root, content);
    var faq = setupFaq(content, reduced);
    var gallery = setupGallery(root);
    var guide = content && Array.from(content.children).find(function (node) { return /^H[23]$/.test(node.tagName) && /(?:نصب|راه[‌\s-]*اندازی|مستندات|راهنمای)/.test(text(node)); });
    var support = content && Array.from(content.children).find(function (node) { return /^H[23]$/.test(node.tagName) && /^(?:شرایط\s+)?(?:پشتیبانی|به[‌\s-]*روزرسانی|بروزرسانی)/.test(text(node)); });
    var price = root.querySelector('.gpd-price');
    var priceLabel = root.querySelector('.gpd-price-label');
    if (priceLabel && (!price || !text(price))) priceLabel.hidden = true;
    var related = root.querySelector('.gpd-related');
    if (related && !related.querySelector('li.product')) related.hidden = true;
    root.classList.add('gpd-js');
    setupNavigation(root, [
      ['معرفی', description && !description.hidden ? description : null, 'gpd-description'],
      ['امکانات', features, 'gpd-features'],
      ['گالری', gallery, 'gpd-gallery'],
      ['مشخصات', specs, 'gpd-specs'],
      ['راهنما', guide, 'gpd-guide'],
      ['پشتیبانی و بروزرسانی', support, 'gpd-support'],
      ['سوالات متداول', faq, 'gpd-faq'],
      ['دیدگاه و اطلاعات بیشتر', extras, 'gpd-extras']
    ], reduced);
    setupMobileCTA(root);
    setupMotion(root, reduced);
  }
  ready(function () { document.querySelectorAll('.gpd-page').forEach(init); });
}());
