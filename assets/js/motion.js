/* ==========================================================================
   GilaClick — motion & interaction modules
   Every effect degrades gracefully:
   - prefers-reduced-motion → everything is shown in its final state
   - touch / coarse pointers and small screens → no tilt, magnetic buttons,
     cursor light or pointer parallax
   - continuous CSS animations pause while their section is off-screen
   ========================================================================== */
(function () {
  'use strict';

  var GC = window.GC;
  var env = GC.env;
  var hasIO = 'IntersectionObserver' in window;

  /* ------------------------------------------------------------------------
     Split headings — [data-split] headings are split into words that rise
     out of a mask. [data-split="load"] plays on page load, the rest when
     revealed. [data-split-unit] children stay one unit (keeps gradients).
     ------------------------------------------------------------------------ */
  function makeWord(content, index) {
    var w = document.createElement('span');
    var inner = document.createElement('span');
    w.className = 'w';
    inner.className = 'w__i';
    inner.style.setProperty('--wi', index);
    if (content) inner.appendChild(content);
    w.appendChild(inner);
    return w;
  }

  function splitWords(el) {
    var index = 0;
    var last = null;

    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              var word = makeWord(document.createTextNode(part), index++);
              last = word.firstChild;
              frag.appendChild(word);
            }
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          if (child.hasAttribute('data-split-unit')) {
            var unit = makeWord(null, index++);
            child.parentNode.replaceChild(unit, child);
            unit.firstChild.appendChild(child);
            last = unit.firstChild;
          } else {
            walk(child);
          }
        }
      });
    })(el);

    // once the last word has landed, drop the masks (never clip descenders)
    if (last) {
      el.addEventListener('transitionend', function done(event) {
        if (event.target !== last || event.propertyName !== 'transform') return;
        el.classList.add('is-split-done');
        el.removeEventListener('transitionend', done);
      });
    }
  }

  GC.define('split', function () {
    if (env.reducedMotion) return;
    GC.$$('[data-split]').forEach(function (el) {
      try {
        splitWords(el);
      } catch (error) {
        console.error('[GilaClick] split failed', error);
      }
      el.classList.add('is-split');
      if (el.getAttribute('data-split') === 'load') {
        // two frames: commit the hidden state before transitioning
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.classList.add('is-split-in');
          });
        });
      }
    });
  });

  /* ------------------------------------------------------------------------
     Scroll reveal — [data-reveal] elements get .is-revealed once, when they
     enter the viewport. [data-stagger] numbers its children automatically.
     ------------------------------------------------------------------------ */
  var revealIO = null;

  function applyStagger(scope) {
    GC.$$('[data-stagger]', scope).forEach(function (group) {
      var i = 0;
      GC.$$('[data-reveal]', group).forEach(function (el) {
        if (el.closest('[data-stagger]') !== group) return;
        if (!el.style.getPropertyValue('--reveal-i')) el.style.setProperty('--reveal-i', i);
        i++;
      });
    });
  }

  function reveal(el) {
    el.classList.add('is-revealed');
  }

  GC.observeReveals = function (scope) {
    scope = scope || document;
    applyStagger(scope.parentNode || scope);
    var items = GC.$$('[data-reveal]:not(.is-revealed)', scope);
    if (scope.matches && scope.matches('[data-reveal]:not(.is-revealed)')) items.unshift(scope);
    if (!revealIO || env.reducedMotion) {
      items.forEach(reveal);
      return;
    }
    items.forEach(function (el) {
      revealIO.observe(el);
    });
  };

  GC.define('reveal', function () {
    if (hasIO && !env.reducedMotion) {
      revealIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            // reveal on entering, and instantly for anything already scrolled past
            if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
              reveal(entry.target);
              revealIO.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
    }
    GC.observeReveals(document);
  });

  /* ------------------------------------------------------------------------
     Count-up — [data-count-to="10"] counts ۰ → ۱۰ when visible.
     The real number is in the HTML, so no-JS / reduced-motion show it as is.
     ------------------------------------------------------------------------ */
  GC.define('counters', function () {
    var els = GC.$$('[data-count-to]');
    if (!els.length || env.reducedMotion || !hasIO) return;

    function run(el) {
      var to = Number(el.getAttribute('data-count-to')) || 0;
      var delay = Number(el.getAttribute('data-count-delay')) || 0;
      var duration = 1500;
      el.textContent = GC.faDigits(0);
      setTimeout(function () {
        var start = performance.now();
        requestAnimationFrame(function tick(now) {
          var t = Math.min(1, (now - start) / duration);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = GC.faDigits(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        });
      }, delay);
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          run(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    els.forEach(function (el) {
      io.observe(el);
    });
  });

  /* ------------------------------------------------------------------------
     Scramble — Latin labels ([data-scramble], monospace) decode themselves
     when they come into view, and again on hover.
     ------------------------------------------------------------------------ */
  GC.define('scramble', function () {
    var els = GC.$$('[data-scramble]');
    if (!els.length || env.reducedMotion || !hasIO) return;
    var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/=';

    function scramble(el) {
      if (el._scrambling) return;
      el._scrambling = true;
      var text = el.getAttribute('data-text') || el.textContent;
      el.setAttribute('data-text', text);
      var len = text.length;
      var duration = 700 + len * 30;
      var start = performance.now();
      requestAnimationFrame(function tick(now) {
        var t = (now - start) / duration;
        var out = '';
        for (var i = 0; i < len; i++) {
          var ch = text.charAt(i);
          out += t >= 0.25 + (i / len) * 0.75 || ch === ' ' ? ch : CHARS.charAt((Math.random() * CHARS.length) | 0);
        }
        el.textContent = out;
        if (t < 1) requestAnimationFrame(tick);
        else {
          el.textContent = text;
          el._scrambling = false;
        }
      });
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var delay = entry.target.closest('.hero') ? 700 : 0;
          setTimeout(function () {
            scramble(entry.target);
          }, delay);
        });
      },
      // tags around the core chip only appear late in the section — wait for them
      { rootMargin: '0px 0px -50% 0px' }
    );

    els.forEach(function (el) {
      io.observe(el);
      var host = el.closest('.cc__tag, .hv__tab') || el;
      host.addEventListener('pointerenter', function () {
        scramble(el);
      });
    });
  });

  /* ------------------------------------------------------------------------
     Scroll progress — [data-progress] elements get --p: 0 when their top
     enters the bottom of the viewport → 1 when their bottom leaves the top.
     Drives parallax, scroll-drawn circuits and section lighting.
     ------------------------------------------------------------------------ */
  GC.define('progress', function () {
    var els = GC.$$('[data-progress]');
    if (!els.length || env.reducedMotion) return;
    var visible = new Set(els);

    if (hasIO) {
      visible = new Set();
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          });
          GC.requestFrame();
        },
        { rootMargin: '15% 0px 15% 0px' }
      );
      els.forEach(function (el) {
        io.observe(el);
      });
    }

    GC.onScroll(function (y, vh) {
      var changes = [];
      visible.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var v = GC.clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(3);
        if (el._p !== v) changes.push([el, v]);
      });
      if (!changes.length) return;
      return function () {
        changes.forEach(function (c) {
          c[0]._p = c[1];
          c[0].style.setProperty('--p', c[1]);
        });
      };
    });
  });

  /* ------------------------------------------------------------------------
     Hero scroll-out — --out: 0 at the top of the page → 1 once the hero has
     scrolled away. Written only on the elements that use it.
     ------------------------------------------------------------------------ */
  GC.define('heroScroll', function () {
    var hero = GC.$('[data-hero]');
    if (!hero || env.reducedMotion) return;
    var targets = GC.$$('.hero__content, .hero__visual, .hero__scroll', hero);
    var last = '';
    GC.onScroll(function () {
      var r = hero.getBoundingClientRect();
      var v = GC.clamp(-r.top / Math.max(1, r.height), 0, 1).toFixed(3);
      if (v === last) return;
      last = v;
      return function () {
        targets.forEach(function (el) {
          el.style.setProperty('--out', v);
        });
      };
    });
  });

  /* ------------------------------------------------------------------------
     Pause continuous animations while a section is off-screen.
     ------------------------------------------------------------------------ */
  GC.define('visibility', function () {
    if (!hasIO) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
        });
      },
      { rootMargin: '120px 0px 120px 0px' }
    );
    GC.$$('[data-visibility]').forEach(function (el) {
      io.observe(el);
    });
  });

  /* ------------------------------------------------------------------------
     Pointer effects (mouse / trackpad only)
     - [data-spotlight] → --mx / --my (lit borders, glows, glare)
     - [data-tilt]      → --rx / --ry (3D tilt, max angle = attribute value)
     - [data-magnetic]  → --mag-x / --mag-y (buttons lean towards the cursor)
     - cursor light over [data-tone="dark"] surfaces
     - hero parallax    → --hx / --hy on the hero (-1 … 1)
     One delegated listener, at most one rAF per frame.
     ------------------------------------------------------------------------ */
  GC.define('pointer', function () {
    if (!env.finePointer || env.reducedMotion) return;

    var aura = GC.$('[data-cursor-aura]');
    var hero = GC.$('[data-hero]');
    var px = -9999;
    var py = -9999;
    var target = null;
    var queued = false;
    var tiltEl = null;
    var magEl = null;

    // smoothed values (cursor light + hero parallax)
    var smooth = { ax: 0, ay: 0, hx: 0, hy: 0, thx: 0, thy: 0, running: false, auraOn: false };

    function resetTilt(el) {
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    }

    function resetMag(el) {
      el.classList.remove('is-magnetized');
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    }

    function frame() {
      queued = false;
      var rich = env.richPointer;
      var t = target && target.nodeType === 1 ? target : null;

      var spot = t && t.closest('[data-spotlight]');
      if (spot) {
        var rs = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', (px - rs.left).toFixed(0) + 'px');
        spot.style.setProperty('--my', (py - rs.top).toFixed(0) + 'px');
      }

      var tilt = rich && t ? t.closest('[data-tilt]') : null;
      if (tilt !== tiltEl) {
        if (tiltEl) resetTilt(tiltEl);
        tiltEl = tilt;
      }
      if (tiltEl) {
        var rt = tiltEl.getBoundingClientRect();
        var max = parseFloat(tiltEl.getAttribute('data-tilt')) || 4;
        var nx = (px - rt.left) / rt.width - 0.5;
        var ny = (py - rt.top) / rt.height - 0.5;
        tiltEl.classList.add('is-tilting');
        tiltEl.style.setProperty('--ry', (nx * max * 2).toFixed(2) + 'deg');
        tiltEl.style.setProperty('--rx', (-ny * max * 2).toFixed(2) + 'deg');
      }

      var mag = rich && t ? t.closest('[data-magnetic]') : null;
      if (mag !== magEl) {
        if (magEl) resetMag(magEl);
        magEl = mag;
      }
      if (magEl) {
        var rm = magEl.getBoundingClientRect();
        var dx = px - (rm.left + rm.width / 2);
        var dy = py - (rm.top + rm.height / 2);
        magEl.classList.add('is-magnetized');
        magEl.style.setProperty('--mag-x', GC.clamp(dx * 0.22, -10, 10).toFixed(1) + 'px');
        magEl.style.setProperty('--mag-y', GC.clamp(dy * 0.32, -7, 7).toFixed(1) + 'px');
      }

      if (aura) {
        var on = rich && !!(t && t.closest('[data-tone="dark"]'));
        if (on !== smooth.auraOn) {
          smooth.auraOn = on;
          aura.classList.toggle('is-active', on);
          if (on && smooth.ax === 0 && smooth.ay === 0) {
            smooth.ax = px;
            smooth.ay = py;
          }
        }
      }

      if (hero && rich) {
        var rh = hero.getBoundingClientRect();
        if (py >= rh.top && py <= rh.bottom && rh.bottom > 0) {
          smooth.thx = GC.clamp(((px - rh.left) / rh.width) * 2 - 1, -1, 1);
          smooth.thy = GC.clamp(((py - rh.top) / rh.height) * 2 - 1, -1, 1);
        } else {
          smooth.thx = 0;
          smooth.thy = 0;
        }
      }

      startSmooth();
    }

    function startSmooth() {
      if (smooth.running) return;
      smooth.running = true;
      requestAnimationFrame(stepSmooth);
    }

    function stepSmooth() {
      var moving = false;
      if (aura && smooth.auraOn) {
        smooth.ax += (px - smooth.ax) * 0.16;
        smooth.ay += (py - smooth.ay) * 0.16;
        aura.style.transform = 'translate3d(' + smooth.ax.toFixed(1) + 'px,' + smooth.ay.toFixed(1) + 'px,0)';
        moving = moving || Math.abs(px - smooth.ax) + Math.abs(py - smooth.ay) > 0.6;
      }
      if (hero) {
        smooth.hx += (smooth.thx - smooth.hx) * 0.07;
        smooth.hy += (smooth.thy - smooth.hy) * 0.07;
        var dh = Math.abs(smooth.thx - smooth.hx) + Math.abs(smooth.thy - smooth.hy);
        if (dh < 0.002) {
          smooth.hx = smooth.thx;
          smooth.hy = smooth.thy;
        } else {
          moving = true;
        }
        hero.style.setProperty('--hx', smooth.hx.toFixed(3));
        hero.style.setProperty('--hy', smooth.hy.toFixed(3));
      }
      if (moving) requestAnimationFrame(stepSmooth);
      else smooth.running = false;
    }

    function queue() {
      if (!queued) {
        queued = true;
        requestAnimationFrame(frame);
      }
    }

    document.addEventListener(
      'pointermove',
      function (event) {
        if (event.pointerType === 'touch') return;
        px = event.clientX;
        py = event.clientY;
        target = event.target;
        queue();
      },
      { passive: true }
    );

    // the element under a still cursor changes while scrolling
    GC.onScroll(function () {
      if (px < 0) return;
      target = document.elementFromPoint(px, py);
      queue();
    });

    document.documentElement.addEventListener('pointerleave', function () {
      target = null;
      px = py = -9999;
      if (tiltEl) resetTilt(tiltEl);
      if (magEl) resetMag(magEl);
      tiltEl = magEl = null;
      smooth.thx = smooth.thy = 0;
      if (aura) {
        smooth.auraOn = false;
        aura.classList.remove('is-active');
      }
      startSmooth();
    });
  });

  /* ------------------------------------------------------------------------
     Click ripple on buttons
     ------------------------------------------------------------------------ */
  GC.define('ripple', function () {
    if (env.reducedMotion) return;
    document.addEventListener(
      'pointerdown',
      function (event) {
        var btn = event.target.closest && event.target.closest('.btn:not(.btn--link)');
        if (!btn) return;
        var r = btn.getBoundingClientRect();
        var dot = document.createElement('span');
        dot.className = 'btn__ripple';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.setProperty('--rx', event.clientX - r.left + 'px');
        dot.style.setProperty('--ry', event.clientY - r.top + 'px');
        btn.appendChild(dot);
        dot.addEventListener('animationend', function () {
          dot.remove();
        });
      },
      { passive: true }
    );
  });

  /* ------------------------------------------------------------------------
     Page chrome — scroll progress bar, back-to-top ring, section rail.
     ------------------------------------------------------------------------ */
  GC.define('chrome', function () {
    var bar = GC.$('[data-scroll-bar]');
    var toTop = GC.$('[data-to-top]');
    var ring = GC.$('[data-to-top-ring]');
    var rail = GC.$('[data-rail]');
    var fill = GC.$('[data-rail-fill]');
    var links = rail ? GC.$$('[data-rail-link]', rail) : [];
    var targets = links.map(function (a) {
      return document.getElementById(a.getAttribute('href').slice(1));
    });
    var tops = [];
    var docHeight = 0;
    var lastActive = -1;

    function measure() {
      var y = window.scrollY;
      tops = targets.map(function (el) {
        return el ? el.getBoundingClientRect().top + y : 0;
      });
      docHeight = document.documentElement.scrollHeight;
      GC.requestFrame();
    }

    // measured after layout (ResizeObserver fires right after the first one),
    // never forcing a synchronous layout while the page is starting up
    window.addEventListener('load', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
    else requestAnimationFrame(function () { setTimeout(measure, 0); });

    GC.onScroll(function (y, vh) {
      // positions are cached (measure()), so this phase reads nothing from layout
      return function () {
        var progress = GC.clamp(y / Math.max(1, docHeight - vh), 0, 1);
        if (bar) bar.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
        if (ring) ring.style.strokeDashoffset = (1 - progress).toFixed(4);

        var past = y > vh * 0.6;
        if (toTop) toTop.classList.toggle('is-visible', past);
        if (!rail) return;
        rail.classList.toggle('is-visible', past);

        var probe = y + vh * 0.42;
        var active = 0;
        for (var i = 0; i < tops.length; i++) if (tops[i] <= probe) active = i;
        var next = active + 1 < tops.length ? tops[active + 1] : docHeight;
        var frac = GC.clamp((probe - tops[active]) / Math.max(1, next - tops[active]), 0, 1);
        var amount = links.length > 1 ? GC.clamp((active + frac) / (links.length - 1), 0, 1) : 1;
        if (fill) fill.style.transform = 'scaleY(' + amount.toFixed(4) + ')';

        if (active !== lastActive) {
          lastActive = active;
          links.forEach(function (a, index) {
            a.classList.toggle('is-active', index === active);
            a.classList.toggle('is-passed', index < active);
            if (index === active) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        }
      };
    });
  });

  /* ------------------------------------------------------------------------
     Scroll-lit paragraphs — words brighten as the paragraph is read.
     ------------------------------------------------------------------------ */
  GC.define('scrollWords', function () {
    if (env.reducedMotion) return;
    var els = GC.$$('[data-scroll-words]');
    if (!els.length) return;

    els.forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach(function (word, i) {
        if (i) el.appendChild(document.createTextNode(' '));
        var span = document.createElement('span');
        span.className = 'sw';
        span.style.setProperty('--i', i);
        span.textContent = word;
        el.appendChild(span);
      });
      el.style.setProperty('--n', words.length);
    });

    GC.onScroll(function (y, vh) {
      var changes = [];
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var v = GC.clamp((vh * 0.92 - r.top) / (vh * 0.42 + r.height * 0.6), 0, 1).toFixed(3);
        if (el._sp !== v) changes.push([el, v]);
      });
      if (!changes.length) return;
      return function () {
        changes.forEach(function (c) {
          c[0]._sp = c[1];
          c[0].style.setProperty('--sp', c[1]);
        });
      };
    });
  });

  /* ------------------------------------------------------------------------
     Process rail — draws with scroll; each step lights up as it is reached.
     ------------------------------------------------------------------------ */
  GC.define('process', function () {
    var track = GC.$('[data-process]');
    if (!track) return;
    var rail = GC.$('.process__rail', track);
    var steps = GC.$$('[data-process-step]', track);
    var nodes = steps.map(function (s) {
      return GC.$('.process__node', s);
    });

    if (env.reducedMotion) {
      track.style.setProperty('--rail', 1);
      steps.forEach(function (s) {
        s.classList.add('is-lit');
      });
      return;
    }

    var vertical = window.matchMedia('(max-width: 899.98px)');
    var last = '';

    GC.onScroll(function (y, vh) {
      var r = track.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var amount = vertical.matches
        ? (vh * 0.75 - r.top) / Math.max(1, r.height * 0.9)
        : (vh * 0.82 - r.top) / (vh * 0.42);
      amount = GC.clamp(amount, 0, 1);
      var v = amount.toFixed(3);
      if (v === last) return;
      last = v;

      var rr = rail.getBoundingClientRect();
      var lit = nodes.map(function (node) {
        var rn = node.getBoundingClientRect();
        var at = vertical.matches
          ? (rn.top + rn.height / 2 - rr.top) / Math.max(1, rr.height)
          : (rr.right - (rn.left + rn.width / 2)) / Math.max(1, rr.width);
        return amount >= GC.clamp(at, 0, 1) - 0.01;
      });
      return function () {
        track.style.setProperty('--rail', v);
        steps.forEach(function (step, i) {
          step.classList.toggle('is-lit', lit[i]);
        });
      };
    });
  });

  /* ------------------------------------------------------------------------
     Ticker — fills each row and duplicates it for a seamless loop.
     ------------------------------------------------------------------------ */
  function fillTicker(row) {
    var inner = GC.$('.ticker__inner', row);
    var track = GC.$('.ticker__track', row);
    if (!inner || !track) return;
    var base = Array.prototype.slice.call(track.children);
    var guard = 0;
    var need = Math.max(row.clientWidth, window.innerWidth);
    while (track.scrollWidth < need && guard++ < 12) {
      base.forEach(function (li) {
        track.appendChild(li.cloneNode(true));
      });
    }
    inner.appendChild(track.cloneNode(true));
    // constant speed (~55px/s) whatever the content length
    inner.style.setProperty('--ticker-t', Math.round(track.scrollWidth / 55) + 's');
  }

  GC.define('ticker', function () {
    GC.$$('[data-ticker]').forEach(function (row) {
      GC.whenNear(row, fillTicker, '500px');
    });
  });

  /* ------------------------------------------------------------------------
     Broken images → neutral branded placeholder (never a broken icon).
     ------------------------------------------------------------------------ */
  GC.bindImageFallback = function (img, host) {
    function fail() {
      img.classList.add('is-broken');
      if (host) host.classList.add('is-broken');
    }
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
    else img.addEventListener('error', fail, { once: true });
  };

  GC.define('images', function () {
    GC.$$('img[data-fallback]').forEach(function (img) {
      GC.bindImageFallback(img, null);
    });
  });

  /* ------------------------------------------------------------------------
     Footer year (Persian calendar)
     ------------------------------------------------------------------------ */
  GC.define('year', function () {
    var el = GC.$('[data-year]');
    if (!el) return;
    // Solar Hijri year: the Persian year starts at Nowruz (≈ 21 March)
    var d = new Date();
    var afterNowruz = d.getMonth() > 2 || (d.getMonth() === 2 && d.getDate() >= 21);
    el.textContent = GC.faDigits(d.getFullYear() - (afterNowruz ? 621 : 622));
  });
})();
