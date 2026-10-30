/* ==========================================================================
   GilaClick — live products from the WooCommerce Store API
   GET {storeApi}/products (public, no keys). Name, price, image and link
   always come from the store — nothing product-related is hardcoded.

   Featured product: a product starred as «featured» in WooCommerce wins;
   otherwise config.products.preferredFeaturedId; otherwise the newest one.
   Card summary: the product's short description → config summaries → an
   excerpt of the description. If the API is unreachable, a notice with a
   link to the shop replaces the cards (the layout never breaks).
   ========================================================================== */
(function () {
  'use strict';

  var GC = window.GC;
  var MAX_GRID = 5;
  var IMAGE_SIZES = {
    featured: '(min-width: 1024px) 800px, 100vw',
    card: '(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw',
  };
  var FIELDS = [
    'id',
    'name',
    'permalink',
    'type',
    'short_description',
    'description',
    'on_sale',
    'prices',
    'images',
    'categories',
    'is_purchasable',
    'is_in_stock',
  ].join(',');

  var parser = new DOMParser();
  var faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

  /* ---- API ------------------------------------------------------------------ */

  function endpoint(base, params) {
    var url = new URL(base.replace(/\/+$/, '') + '/products', window.location.href);
    Object.keys(params).forEach(function (key) {
      url.searchParams.set(key, String(params[key]));
    });
    return url.href;
  }

  function getProducts(url, timeoutMs) {
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);
    return fetch(url, { headers: { Accept: 'application/json' }, signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error('Store API responded ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Unexpected Store API payload');
        return data.filter(function (p) {
          return p && typeof p.id === 'number' && typeof p.name === 'string';
        });
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function loadProducts(cfg) {
    var none = function () {
      return [];
    };
    return Promise.all([
      getProducts(endpoint(cfg.apiBase, { per_page: cfg.perPage, _fields: FIELDS }), cfg.timeoutMs),
      getProducts(endpoint(cfg.apiBase, { featured: 'true', per_page: 1, _fields: FIELDS }), cfg.timeoutMs).catch(none),
    ]).then(function (res) {
      var products = res[0].slice();
      var featured = res[1];
      var has = function (id) {
        return products.some(function (p) { return p.id === id; });
      };

      if (featured[0]) {
        if (!has(featured[0].id)) products.unshift(featured[0]);
        return { products: products, featuredId: featured[0].id };
      }

      var preferred = cfg.preferredFeaturedId;
      if (preferred && has(preferred)) return { products: products, featuredId: preferred };
      if (!preferred) return { products: products, featuredId: products[0] ? products[0].id : null };

      return getProducts(endpoint(cfg.apiBase, { include: preferred, _fields: FIELDS }), cfg.timeoutMs)
        .catch(none)
        .then(function (extra) {
          if (extra[0]) {
            products.unshift(extra[0]);
            return { products: products, featuredId: extra[0].id };
          }
          return { products: products, featuredId: products[0] ? products[0].id : null };
        });
    });
  }

  /* ---- Model ---------------------------------------------------------------- */

  function htmlToText(html) {
    if (!html) return '';
    var text = parser.parseFromString(html, 'text/html').body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[،,.؛:]+$/, '') + '…';
  }

  function safeUrl(value) {
    if (!value) return null;
    try {
      var url = new URL(value, window.location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function safeSrcset(srcset) {
    return (srcset || '')
      .split(',')
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return safeUrl(part.split(/\s+/)[0]) !== null; })
      .join(', ');
  }

  var NUMBERED = /^\s*[0-9۰-۹]{1,2}\s*[.)\-–:]\s*/;

  /** Feature highlights from numbered headings in the product description. */
  function extractHighlights(html, max) {
    max = max || 3;
    if (!html) return [];
    var doc = parser.parseFromString(html, 'text/html');
    var found = [];
    var nodes = doc.querySelectorAll('h2, h3, h4, strong, b');
    for (var i = 0; i < nodes.length && found.length < max; i++) {
      var text = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!NUMBERED.test(text)) continue;
      var clean = text
        .replace(NUMBERED, '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/[.:؛،]+$/, '')
        .trim();
      if (clean.length < 4 || clean.length > 90 || found.indexOf(clean) > -1) continue;
      found.push(clean);
    }
    return found;
  }

  function summaryFor(product, summaries) {
    var short = htmlToText(product.short_description);
    if (short) return truncate(short, 190);
    var curated = summaries[String(product.id)];
    if (curated) return curated;
    if (product.description) {
      var paragraphs = parser.parseFromString(product.description, 'text/html').querySelectorAll('p');
      for (var i = 0; i < paragraphs.length; i++) {
        var text = (paragraphs[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length >= 40) return truncate(text, 170);
      }
    }
    return '';
  }

  function toPriceView(product) {
    var prices = product.prices;
    if (!prices) return { kind: 'inquiry' };

    var minor = Number(prices.currency_minor_unit) || 0;
    var toValue = function (raw) {
      return raw === undefined || raw === null || raw === '' ? NaN : Number(raw) / Math.pow(10, minor);
    };
    var unit = (prices.currency_suffix || '').trim() || (prices.currency_prefix ? '' : prices.currency_symbol || '');
    var prefix = (prices.currency_prefix || '').trim();

    if (prices.price_range) {
      var min = toValue(prices.price_range.min_amount);
      var maxV = toValue(prices.price_range.max_amount);
      if (isFinite(min) && isFinite(maxV) && maxV > 0) {
        return { kind: 'range', min: faNumber.format(min), max: faNumber.format(maxV), unit: unit, prefix: prefix };
      }
    }

    var value = toValue(prices.price);
    // zero / hidden price (e.g. «Call for Price») → link to the product page instead
    if (!isFinite(value) || value <= 0) return { kind: 'inquiry' };

    var regular = toValue(prices.regular_price);
    var onSale = Boolean(product.on_sale) && isFinite(regular) && regular > value;
    return {
      kind: 'single',
      value: value,
      amount: faNumber.format(value),
      regular: onSale ? faNumber.format(regular) : '',
      unit: unit,
      prefix: prefix,
    };
  }

  function toProductView(product, opts) {
    var url = safeUrl(product.permalink);
    if (!url) return null;
    var name = htmlToText(product.name) || product.name;
    var image = product.images && product.images[0];
    var imageSrc = safeUrl(image && image.src);
    var purchasable =
      product.is_purchasable !== false && product.is_in_stock !== false && (product.type || 'simple') === 'simple';
    var price = toPriceView(product);

    var addToCartUrl = null;
    if (purchasable && price.kind === 'single') {
      var cart = new URL(opts.cartUrl, window.location.href);
      cart.searchParams.set('add-to-cart', String(product.id));
      addToCartUrl = cart.href;
    }

    return {
      id: product.id,
      name: name,
      url: url,
      category: htmlToText(product.categories && product.categories[0] && product.categories[0].name),
      image: imageSrc ? { src: imageSrc, srcset: safeSrcset(image.srcset), alt: htmlToText(image.alt) || name } : null,
      summary: summaryFor(product, opts.summaries),
      highlights: opts.featured ? extractHighlights(product.description) : [],
      price: price,
      addToCartUrl: addToCartUrl,
    };
  }

  /* ---- Render (fills the <template>s in index.html) ---------------------- */

  function template(root, name) {
    var tpl = GC.$('template[data-tpl="' + name + '"]', root);
    if (!tpl) throw new Error('Missing template: ' + name);
    return tpl.content.cloneNode(true);
  }

  function slot(scope, name) {
    return scope.querySelector('[data-slot="' + name + '"]');
  }

  function priceNode(root, price) {
    if (price.kind === 'inquiry') return template(root, 'price-inquiry');
    var frag = template(root, 'price');
    var amount = slot(frag, 'amount');
    slot(frag, 'unit').textContent = price.unit;
    if (price.prefix) {
      var prefix = slot(frag, 'prefix');
      prefix.textContent = price.prefix;
      prefix.hidden = false;
    }
    if (price.kind === 'range') {
      amount.textContent = price.min + ' تا ' + price.max;
      amount.removeAttribute('value');
    } else {
      amount.textContent = price.amount;
      amount.value = String(price.value);
      if (price.regular) {
        var regular = slot(frag, 'regular');
        regular.textContent = price.regular + ' ' + price.unit;
        regular.hidden = false;
      }
    }
    return frag;
  }

  function buildCard(root, vm, featured) {
    var frag = template(root, featured ? 'featured' : 'card');
    var media = slot(frag, 'media');
    var img = slot(frag, 'image');
    media.href = vm.url;
    if (vm.image) {
      img.src = vm.image.src;
      if (vm.image.srcset) {
        img.srcset = vm.image.srcset;
        img.sizes = featured ? IMAGE_SIZES.featured : IMAGE_SIZES.card;
      }
      img.alt = vm.image.alt;
      GC.bindImageFallback(img, media);
    } else {
      img.remove();
      media.classList.add('is-broken');
    }

    slot(frag, 'category').textContent = vm.category;
    var title = slot(frag, 'title');
    title.href = vm.url;
    title.textContent = vm.name;
    slot(frag, 'summary').textContent = vm.summary;

    var list = slot(frag, 'highlights');
    if (list) {
      vm.highlights.forEach(function (text, i) {
        var item = template(root, 'highlight');
        slot(item, 'text').textContent = text;
        item.firstElementChild.style.setProperty('--i', i);
        list.appendChild(item);
      });
    }

    slot(frag, 'price').appendChild(priceNode(root, vm.price));

    var details = slot(frag, 'details');
    details.href = vm.url;
    details.setAttribute('aria-label', 'مشاهده جزئیات محصول ' + vm.name);

    var cart = slot(frag, 'add-to-cart');
    if (cart && vm.addToCartUrl) {
      cart.href = vm.addToCartUrl;
      cart.setAttribute('aria-label', 'افزودن ' + vm.name + ' به سبد خرید');
      cart.hidden = false;
    }
    return frag;
  }

  function finish(root, grid, state) {
    GC.$$('[data-skeleton]', grid).forEach(function (el) {
      el.remove();
    });
    grid.setAttribute('aria-busy', 'false');
    root.setAttribute('data-state', state);
    if (GC.observeReveals) GC.observeReveals(grid);
    GC.requestFrame();
  }

  function renderProducts(root, views, featuredId) {
    var grid = GC.$('[data-products-grid]', root);
    if (!grid) return;
    var anchor = GC.$('[data-products-custom]', grid);
    var featured =
      views.filter(function (v) { return v.id === featuredId; })[0] || views[0];
    var rest = views.filter(function (v) { return v !== featured; }).slice(0, MAX_GRID);

    var frag = document.createDocumentFragment();
    if (featured) frag.appendChild(buildCard(root, featured, true));
    rest.forEach(function (vm) {
      frag.appendChild(buildCard(root, vm, false));
    });
    grid.insertBefore(frag, anchor);
    finish(root, grid, 'ready');
  }

  function renderNotice(root, copy, state) {
    var grid = GC.$('[data-products-grid]', root);
    if (!grid) return;
    var frag = template(root, 'notice');
    slot(frag, 'title').textContent = copy.title;
    slot(frag, 'body').textContent = copy.body;
    grid.insertBefore(frag, GC.$('[data-products-custom]', grid));
    finish(root, grid, state);
  }

  /* ---- Module -------------------------------------------------------------- */

  GC.define('products', function () {
    var root = GC.$('[data-products-root]');
    var settings = GC.config.products;
    if (!root || !settings || !GC.config.storeApi) return;

    var cfg = {
      apiBase: GC.config.storeApi,
      perPage: settings.perPage || 6,
      timeoutMs: settings.timeoutMs || 9000,
      preferredFeaturedId: settings.preferredFeaturedId || null,
      summaries: settings.summaries || {},
      cartUrl: GC.config.cartUrl || '/cart/',
    };

    return loadProducts(cfg)
      .then(function (result) {
        var views = result.products
          .map(function (p) {
            return toProductView(p, { summaries: cfg.summaries, cartUrl: cfg.cartUrl, featured: p.id === result.featuredId });
          })
          .filter(Boolean);
        if (!views.length) {
          renderNotice(root, settings.copy.empty, 'empty');
          return;
        }
        renderProducts(root, views, result.featuredId);
      })
      .catch(function (error) {
        console.warn('[GilaClick] Products could not be loaded from the Store API.', error);
        renderNotice(root, settings.copy.unavailable, 'error');
      });
  });

  // exposed for testing / reuse
  GC.products = { toPriceView: toPriceView, extractHighlights: extractHighlights, toProductView: toProductView };
})();
