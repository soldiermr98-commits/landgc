/* ==========================================================================
   GilaClick — circuit artwork generator
   Builds every PCB illustration on the page as inline SVG:
     [data-circuit="hero|light|dark|green|cta"]  background fields
     [data-circuit="hero-visual"]                wires of the hero illustration
     [data-circuit="core-chip"]                  the capabilities core chip
   Traces are offset polylines («buses») with 45° bends, like real PCB routing.
   Styling and animation live in assets/css/circuits.css.

   [data-draw] on a field: "load" (draws in on page load), "scroll" (follows
   the section's scroll progress) or "reveal" (draws when its container is
   revealed). Without JS the artwork is simply absent — it is decorative.
   ========================================================================== */
(function () {
  'use strict';

  var GC = window.GC;

  /* ---- Geometry ----------------------------------------------------------- */

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  function normal(a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  }

  /** Offsets a polyline sideways by d, keeping parallel spacing through bends. */
  function offsetPolyline(points, d) {
    if (d === 0 || points.length < 2) return points.map(function (p) { return [p[0], p[1]]; });
    var normals = points.slice(0, -1).map(function (p, i) { return normal(p, points[i + 1]); });
    return points.map(function (p, i) {
      if (i === 0) return [p[0] + normals[0][0] * d, p[1] + normals[0][1] * d];
      if (i === points.length - 1) {
        var n = normals[normals.length - 1];
        return [p[0] + n[0] * d, p[1] + n[1] * d];
      }
      var a = normals[i - 1];
      var b = normals[i];
      var k = d / (1 + a[0] * b[0] + a[1] * b[1]);
      return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
    });
  }

  /** Shortens the last segment so parallel traces end staggered. */
  function trimEnd(points, amount) {
    var out = points.map(function (p) { return [p[0], p[1]]; });
    if (amount <= 0 || out.length < 2) return out;
    var a = out[out.length - 2];
    var b = out[out.length - 1];
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var t = Math.max(0, (len - amount) / len);
    out[out.length - 1] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return out;
  }

  function polylineLength(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    return total;
  }

  function trace(points) {
    var last = points[points.length - 1];
    return {
      d: points.map(function (p, i) { return (i ? 'L' : 'M') + round(p[0]) + ' ' + round(p[1]); }).join(' '),
      start: [round(points[0][0]), round(points[0][1])],
      end: [round(last[0]), round(last[1])],
      length: round(polylineLength(points)),
    };
  }

  /** A bundle of parallel traces around a centre line. */
  function bus(center, opts) {
    var count = opts.count;
    var gap = opts.gap;
    var stagger = opts.stagger || 0;
    var out = [];
    for (var i = 0; i < count; i++) {
      var offset = (i - (count - 1) / 2) * gap;
      var order = opts.reverseStagger ? count - 1 - i : i;
      out.push(trace(trimEnd(offsetPolyline(center, offset), order * stagger)));
    }
    return out;
  }

  /* ---- Pulses --------------------------------------------------------------
     A pulse travels for TRAVEL_SHARE of its cycle, then rests. Keep in sync
     with @keyframes gc-pulse-travel / gc-arrive in assets/css/motion.css. */
  var TRAVEL_SHARE = 0.62;

  function pulseFor(length, delay, speed, size) {
    var travel = length / speed;
    return {
      dur: Math.round((travel / TRAVEL_SHARE) * 10) / 10,
      delay: delay,
      len: Math.round((size / length) * 1000) / 1000,
    };
  }

  function pulseStyle(p) {
    return '--pulse-dur:' + p.dur + 's;--pulse-delay:' + p.delay + 's;--pulse-len:' + p.len;
  }

  /* ---- Background fields -------------------------------------------------- */

  function Field(width, height) {
    this.width = width;
    this.height = height;
    this.traces = [];
    this.nodes = [];
    this.groups = 0;
  }

  Field.prototype.add = function (items, deco) {
    var self = this;
    var group = this.groups++;
    deco = deco || {};
    items.forEach(function (t, i) {
      var delay = deco.pulses ? deco.pulses[i] : undefined;
      self.traces.push({
        d: t.d,
        start: t.start,
        end: t.end,
        length: t.length,
        pulse: delay !== undefined ? pulseFor(t.length, delay, 120, 26) : null,
        drawDelay: (deco.draw !== undefined ? deco.draw : 0.15 + group * 0.22) + i * 0.12,
      });
      self.nodes.push({ at: t.end, kind: deco.glow && deco.glow.indexOf(i) > -1 ? 'glow' : 'via' });
      if (deco.startNodes) self.nodes.push({ at: t.start, kind: 'pad' });
    });
    return this;
  };

  Field.prototype.bus = function (center, opts, deco) {
    return this.add(bus(center, opts), deco);
  };

  Field.prototype.line = function (points, deco) {
    return this.add([trace(points)], deco);
  };

  var FIELDS = {
    /* Hero — 1440×900. Text column on the right (RTL), illustration on the left. */
    hero: new Field(1440, 900)
      .bus([[560, -20], [560, 66], [516, 110], [150, 110]], { count: 4, gap: 12, stagger: 38 }, {
        pulses: { 1: 0.6, 3: 3.4 },
        glow: [0],
        draw: 0.15,
      })
      .bus([[1460, 136], [1262, 136], [1222, 96], [990, 96]], { count: 3, gap: 12, stagger: 34 }, {
        pulses: { 0: 2.2 },
        draw: 0.35,
      })
      .bus([[372, 930], [372, 852], [414, 810], [720, 810]], { count: 3, gap: 12, stagger: 42 }, {
        pulses: { 2: 3 },
        glow: [1],
        draw: 0.55,
      })
      .bus([[1460, 756], [1384, 756], [1322, 818], [950, 818]], { count: 4, gap: 12, stagger: 36 }, {
        pulses: { 1: 0.2, 3: 4.1 },
        glow: [3],
        draw: 0.7,
      })
      .line([[1460, 214], [1414, 214], [1392, 236], [1392, 560]], { draw: 0.9, pulses: { 0: 1.6 } }),

    /* Light sections — 1440×1100, very subtle. Heading sits top-right (RTL). */
    light: new Field(1440, 1100)
      .bus([[-20, 104], [146, 104], [196, 154], [196, 300]], { count: 3, gap: 12, stagger: 34 }, {
        pulses: { 1: 1 },
      })
      .line([[1460, 430], [1404, 430], [1372, 462], [1372, 780]], { pulses: { 0: 4 } })
      .bus([[-20, 1010], [36, 1010], [66, 980], [66, 640]], { count: 2, gap: 12, stagger: 60 }, {
        pulses: { 0: 2.5 },
      }),

    /* Dark sections — 1440×900, corners and outer gutters only. */
    dark: new Field(1440, 900)
      .bus([[1460, 64], [1300, 64], [1258, 106], [1080, 106]], { count: 3, gap: 12, stagger: 40 }, {
        pulses: { 1: 0.8 },
        glow: [2],
      })
      .bus([[-20, 846], [196, 846], [238, 804], [440, 804]], { count: 3, gap: 12, stagger: 40 }, {
        pulses: { 0: 2.4 },
      })
      .line([[1394, 300], [1394, 700]], { startNodes: true, pulses: { 0: 1.5 } }),

    /* Green «why» section — 1440×800, mirrored top corners around a centred heading. */
    green: new Field(1440, 800)
      .bus([[-20, 88], [176, 88], [218, 130], [218, 250]], { count: 3, gap: 12, stagger: 30 }, {
        pulses: { 1: 0.5 },
      })
      .bus([[1460, 88], [1264, 88], [1222, 130], [1222, 250]], { count: 3, gap: 12, stagger: 30, reverseStagger: true }, {
        pulses: { 1: 3.2 },
        glow: [0],
      }),

    /* Final CTA panel — 1200×520. Content is centred; traces use side gutters and bottom band. */
    cta: new Field(1200, 520)
      .bus([[-20, 118], [92, 118], [132, 158], [132, 420]], { count: 3, gap: 14, stagger: 44 }, {
        pulses: { 1: 0.4 },
        glow: [0],
        draw: 0.2,
      })
      .bus([[1220, 402], [1108, 402], [1068, 362], [1068, 100]], { count: 3, gap: 14, stagger: 44 }, {
        pulses: { 1: 2 },
        glow: [2],
        draw: 0.45,
      })
      .bus([[290, 540], [290, 500], [326, 470], [910, 470]], { count: 2, gap: 12, stagger: 120 }, {
        pulses: { 0: 1.2 },
        draw: 0.7,
      }),
  };

  var uid = 0;

  function renderField(el) {
    var field = FIELDS[el.getAttribute('data-circuit')];
    if (!field) return;
    var mode = el.getAttribute('data-draw') || '';
    var glowId = 'cf-glow-' + ++uid;
    var traceClass = 'cf__trace' + (mode === 'load' ? ' cf__trace--load' : mode === 'reveal' ? ' cf__trace--reveal' : '');

    var traces = field.traces
      .map(function (t) {
        var style = mode === 'load' || mode === 'reveal' ? ' style="--draw-delay:' + t.drawDelay.toFixed(2) + 's"' : '';
        return '<path class="' + traceClass + '" d="' + t.d + '" pathLength="1"' + style + '/>';
      })
      .join('');

    var pulsed = field.traces.filter(function (t) { return t.pulse; });
    // pulses start once a load/reveal trace has been drawn
    var lag = mode === 'load' ? 2 : mode === 'reveal' ? 1.6 : 0;

    var pulses = pulsed
      .map(function (t) {
        var p = { dur: t.pulse.dur, delay: round(t.pulse.delay + lag), len: t.pulse.len };
        return (
          '<g class="cf__pulse" style="' + pulseStyle(p) + '">' +
          '<path class="cf__pulse-halo" d="' + t.d + '" pathLength="1"/>' +
          '<path class="cf__pulse-core" d="' + t.d + '" pathLength="1"/></g>'
        );
      })
      .join('');

    var arrivals = pulsed
      .map(function (t) {
        var p = { dur: t.pulse.dur, delay: round(t.pulse.delay + lag), len: t.pulse.len };
        return '<circle class="cf__arrive" cx="' + t.end[0] + '" cy="' + t.end[1] + '" r="9" style="' + pulseStyle(p) + '"/>';
      })
      .join('');

    var blink = 0;
    var nodes = field.nodes
      .map(function (n) {
        var x = n.at[0];
        var y = n.at[1];
        if (n.kind === 'glow') {
          return (
            '<g class="cf__node cf__node--glow"><circle cx="' + x + '" cy="' + y + '" r="22" fill="url(#' + glowId + ')" class="cf__glow"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="3.4" class="cf__dot cf__dot--lit"/></g>'
          );
        }
        if (n.kind === 'pad') return '<circle cx="' + x + '" cy="' + y + '" r="2.2" class="cf__dot"/>';
        var led =
          blink++ % 3 === 1
            ? '<circle cx="' + x + '" cy="' + y + '" r="2.4" class="cf__blink" style="--blink-delay:' + ((blink * 1.7) % 5).toFixed(1) + 's"/>'
            : '';
        return (
          '<g class="cf__node"><circle cx="' + x + '" cy="' + y + '" r="5.4" class="cf__ring"/>' +
          '<circle cx="' + x + '" cy="' + y + '" r="2.4" class="cf__dot"/>' + led + '</g>'
        );
      })
      .join('');

    el.innerHTML =
      '<svg class="cf__svg" viewBox="0 0 ' + field.width + ' ' + field.height + '" preserveAspectRatio="xMidYMid slice" focusable="false">' +
      '<defs><radialGradient id="' + glowId + '"><stop offset="0" class="cf__glow-stop"/><stop offset="1" class="cf__glow-stop cf__glow-stop--end"/></radialGradient></defs>' +
      '<g class="cf__traces">' + traces + '</g>' +
      '<g class="cf__pulses">' + pulses + '</g>' +
      '<g class="cf__arrivals">' + arrivals + '</g>' +
      '<g class="cf__nodes">' + nodes + '</g>' +
      '</svg>';
  }

  /* ---- Hero illustration wires (viewBox 600 × 560) -------------------------
     The panel occupies x 84–516, y 124–424 (matches .hv__panel in CSS). */
  function renderHeroVisual(svg) {
    var groups = [
      { traces: bus([[178, 124], [178, 86], [146, 54], [30, 54]], { count: 3, gap: 12, stagger: 24 }), pulse: { 1: 0.4 } },
      { traces: bus([[292, 124], [292, 72], [314, 50], [314, 20]], { count: 2, gap: 12, stagger: 16 }), pulse: { 0: 2.1 }, glow: [0] },
      { traces: bus([[516, 226], [556, 226], [584, 254], [584, 374]], { count: 3, gap: 12, stagger: 22 }), pulse: { 1: 1.3 }, glow: [2] },
      { traces: bus([[84, 196], [44, 196], [20, 220], [20, 330]], { count: 2, gap: 12, stagger: 18 }), pulse: { 0: 3.6 } },
      { traces: bus([[318, 424], [318, 466], [290, 494], [168, 494]], { count: 3, gap: 12, stagger: 26 }), pulse: { 1: 3 } },
      {
        traces: [trace([[434, 424], [434, 474], [454, 494], [516, 494]]), trace([[446, 424], [446, 470], [458, 482], [516, 482]])],
        pulse: { 0: 4.4 },
        chip: true,
      },
    ];

    var wires = [];
    groups.forEach(function (g, gi) {
      g.traces.forEach(function (t, i) {
        wires.push({
          t: t,
          pulse: g.pulse && g.pulse[i] !== undefined ? pulseFor(t.length, g.pulse[i], 95, 18) : null,
          glow: !!(g.glow && g.glow.indexOf(i) > -1),
          endNode: !g.chip, // the last bus terminates in the chip
          delay: 0.35 + gi * 0.16 + i * 0.07,
        });
      });
    });

    var out = [];
    out.push(
      '<defs>' +
        '<radialGradient id="hv-glow-lime"><stop offset="0" stop-color="#a3f451" stop-opacity="0.75"/><stop offset="1" stop-color="#a3f451" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="hv-glow-green"><stop offset="0" stop-color="#19c58b" stop-opacity="0.7"/><stop offset="1" stop-color="#19c58b" stop-opacity="0"/></radialGradient>' +
        '<pattern id="hv-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.9" fill="rgb(163 244 81 / 0.12)"/></pattern>' +
      '</defs>' +
      '<rect x="0" y="0" width="600" height="560" fill="url(#hv-dots)" class="hv__dots"/>'
    );

    out.push('<g class="hv__wires">');
    wires.forEach(function (w) {
      out.push('<path d="' + w.t.d + '" pathLength="1" class="hv__wire" style="--draw-delay:' + w.delay.toFixed(2) + 's"/>');
    });
    out.push('</g><g class="hv__pulses">');
    wires.forEach(function (w) {
      if (!w.pulse) return;
      out.push(
        '<g class="hv__pulse" style="' + pulseStyle(w.pulse) + '">' +
          '<path d="' + w.t.d + '" pathLength="1" class="hv__pulse-halo"/>' +
          '<path d="' + w.t.d + '" pathLength="1" class="hv__pulse-core"/></g>'
      );
    });
    out.push('</g><g class="hv__arrivals">');
    wires.forEach(function (w) {
      if (!w.pulse || !w.endNode) return;
      out.push('<circle class="hv__arrive" cx="' + w.t.end[0] + '" cy="' + w.t.end[1] + '" r="9" style="' + pulseStyle(w.pulse) + '"/>');
    });
    out.push('</g><g class="hv__nodes">');
    wires.forEach(function (w) {
      if (!w.endNode) return;
      var x = w.t.end[0];
      var y = w.t.end[1];
      if (w.glow) {
        var lime = y < 100;
        out.push(
          '<g><circle cx="' + x + '" cy="' + y + '" r="20" fill="url(#' + (lime ? 'hv-glow-lime' : 'hv-glow-green') + ')" class="hv__halo"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="3.6" class="' + (lime ? 'hv__node-lime' : 'hv__node-green') + '"/></g>'
        );
      } else {
        out.push(
          '<g class="hv__via"><circle cx="' + x + '" cy="' + y + '" r="5.2" class="hv__via-ring"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="2.3" class="hv__via-dot"/></g>'
        );
      }
    });
    out.push('</g><g class="hv__pads">');
    wires.forEach(function (w) {
      out.push('<rect x="' + (w.t.start[0] - 2.5) + '" y="' + (w.t.start[1] - 2.5) + '" width="5" height="5" rx="1" class="hv__pad"/>');
    });
    out.push('</g>');

    // IC chip (the outer group is animated; the inner one carries the SVG transform)
    var pins = [10, 22, 34, 46];
    out.push('<g class="hv__chip"><g transform="translate(516 470)">');
    out.push('<rect x="0" y="0" width="62" height="40" rx="5" class="hv__chip-body"/>');
    pins.forEach(function (x) {
      out.push('<rect x="' + x + '" y="-6" width="5" height="6" rx="1" class="hv__chip-pin"/>');
      out.push('<rect x="' + x + '" y="40" width="5" height="6" rx="1" class="hv__chip-pin"/>');
    });
    out.push('<circle cx="9" cy="9" r="2" class="hv__chip-dot"/>');
    out.push('<text x="31" y="25" text-anchor="middle" class="hv__chip-label">GC·01</text>');
    out.push('</g></g>');

    svg.innerHTML = out.join('');
  }

  /* ---- Core chip (capabilities, viewBox 520 × 460, body 194–326 × 164–296) */
  function renderCoreChip(svg) {
    var corner = [
      bus([[230, 154], [230, 122], [196, 88], [120, 88]], { count: 2, gap: 20, stagger: 20 }),
      bus([[290, 154], [290, 122], [324, 88], [400, 88]], { count: 2, gap: 20, stagger: 20, reverseStagger: true }),
      bus([[230, 306], [230, 338], [196, 372], [120, 372]], { count: 2, gap: 20, stagger: 20, reverseStagger: true }),
      bus([[290, 306], [290, 338], [324, 372], [400, 372]], { count: 2, gap: 20, stagger: 20 }),
    ];
    var side = []
      .concat(bus([[184, 230], [112, 230], [84, 202], [84, 150]], { count: 3, gap: 20, stagger: 18 }))
      .concat(bus([[336, 230], [408, 230], [436, 258], [436, 310]], { count: 3, gap: 20, stagger: 18 }))
      .concat([trace([[260, 154], [260, 54]]), trace([[260, 306], [260, 410]])]);

    var cornerFlat = [].concat.apply([], corner);
    var all = cornerFlat.concat(side);
    var pulsed = [corner[0][0], corner[1][1], corner[2][1], corner[3][0], side[6]];

    var out = [];
    out.push(
      '<defs>' +
        '<linearGradient id="cc-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d5240"/><stop offset="1" stop-color="#06271f"/></linearGradient>' +
        '<radialGradient id="cc-node-glow"><stop offset="0" stop-color="#a3f451" stop-opacity="0.8"/><stop offset="1" stop-color="#a3f451" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="cc-core-glow"><stop offset="0" stop-color="#a3f451" stop-opacity="0.55"/><stop offset="1" stop-color="#19c58b" stop-opacity="0"/></radialGradient>' +
        '<pattern id="cc-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="rgb(163 244 81 / 0.08)" stroke-width="0.6"/></pattern>' +
      '</defs>'
    );

    out.push(
      '<g class="cc__rings">' +
        '<circle class="cc__ring cc__ring--b" cx="260" cy="230" r="136"/>' +
        '<circle class="cc__ring cc__ring--a" cx="260" cy="230" r="118"/>' +
        '<circle class="cc__ring cc__ring--c" cx="260" cy="230" r="104"/>' +
      '</g>'
    );

    out.push('<g class="cc__traces">');
    all.forEach(function (t) {
      out.push('<path d="' + t.d + '" pathLength="1" class="cc__trace"/>');
    });
    out.push('</g><g class="cc__pulses">');
    var pulses = pulsed.map(function (t, i) {
      return { t: t, p: pulseFor(t.length, round(i * 1.3), 70, 16) };
    });
    pulses.forEach(function (x) {
      out.push(
        '<g class="cc__pulse" style="' + pulseStyle(x.p) + '">' +
          '<path d="' + x.t.d + '" pathLength="1" class="cc__pulse-halo"/>' +
          '<path d="' + x.t.d + '" pathLength="1" class="cc__pulse-core"/></g>'
      );
    });
    out.push('</g><g class="cc__arrivals">');
    pulses.forEach(function (x) {
      out.push('<circle class="cc__arrive" cx="' + x.t.end[0] + '" cy="' + x.t.end[1] + '" r="9" style="' + pulseStyle(x.p) + '"/>');
    });
    out.push('</g><g class="cc__vias">');
    side.slice(0, 6).forEach(function (t) {
      out.push(
        '<g><circle cx="' + t.end[0] + '" cy="' + t.end[1] + '" r="5" class="cc__via-ring"/>' +
          '<circle cx="' + t.end[0] + '" cy="' + t.end[1] + '" r="2.2" class="cc__via-dot"/></g>'
      );
    });
    out.push('<circle cx="260" cy="54" r="20" fill="url(#cc-node-glow)" class="cc__antenna-glow"/>');
    out.push('<circle cx="260" cy="54" r="4" class="cc__antenna"/>');
    out.push('<circle cx="260" cy="410" r="5" class="cc__via-ring"/><circle cx="260" cy="410" r="2.2" class="cc__via-dot"/>');
    cornerFlat.forEach(function (t) {
      out.push('<circle cx="' + t.end[0] + '" cy="' + t.end[1] + '" r="2.6" class="cc__end"/>');
    });
    out.push('</g>');

    // chip
    var pins = [220, 240, 260, 280, 300];
    var sidePins = [190, 210, 230, 250, 270];
    var live = 0;
    function pin(x, y, w, h) {
      var isLive = live++ % 3 === 0;
      return (
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5" class="cc__pin' +
        (isLive ? ' cc__pin--live" style="--pin-delay:' + ((live * 0.35) % 2.4).toFixed(2) + 's"' : '"') +
        '/>'
      );
    }
    out.push('<g class="cc__chip">');
    pins.forEach(function (x) { out.push(pin(x - 3, 154, 6, 10)); });
    pins.forEach(function (x) { out.push(pin(x - 3, 296, 6, 10)); });
    sidePins.forEach(function (y) { out.push(pin(184, y - 3, 10, 6)); });
    sidePins.forEach(function (y) { out.push(pin(326, y - 3, 10, 6)); });
    out.push('<rect x="194" y="164" width="132" height="132" rx="18" fill="url(#cc-body)" class="cc__body"/>');
    out.push('<rect x="206" y="176" width="108" height="108" rx="11" fill="url(#cc-grid)" class="cc__inner"/>');
    out.push('<circle cx="260" cy="222" r="46" fill="url(#cc-core-glow)" class="cc__core-glow"/>');
    out.push('<path d="M206 186 L216 176" class="cc__notch"/>');
    out.push(
      '<g transform="translate(212 178) scale(2.4)">' +
        '<path d="M26.7 13.3A9.5 9.5 0 1 0 29.4 21.3H23.2" pathLength="1" class="cc__mark"/>' +
        '<circle cx="21" cy="21.3" r="2.4" class="cc__mark-node"/></g>'
    );
    out.push('<text x="260" y="276" text-anchor="middle" class="cc__label">GILACLICK · CORE</text>');
    out.push('</g>');

    svg.innerHTML = out.join('');
  }

  GC.circuit = { trace: trace, bus: bus, offsetPolyline: offsetPolyline, fields: FIELDS };

  function render(el) {
    var kind = el.getAttribute('data-circuit');
    if (kind === 'hero-visual') renderHeroVisual(el);
    else if (kind === 'core-chip') renderCoreChip(el);
    else renderField(el);
  }

  GC.define('circuits', function () {
    GC.$$('[data-circuit]').forEach(function (el) {
      // the hero is drawn immediately; everything else just before it scrolls into view
      if (el.closest('.hero')) render(el);
      else GC.whenNear(el, render, '700px');
    });
  });
})();
