/**
 * Background circuit fields for each section type.
 *
 * Coordinates are in each field's viewBox. Traces are routed through the margins and the
 * empty bands of a section (above/below content, outer gutters) so they never sit behind
 * running text. All geometry is computed at build time.
 */
import { bus, trace, type BusOptions, type Pt, type Trace } from '../../lib/circuit';

export interface FieldTrace extends Trace {
  /** Travelling light pulse. `len` is the dash length relative to the trace (pathLength = 1). */
  pulse?: { dur: number; delay: number; len: number };
  draw?: { delay: number };
}

/** Pulses travel at a constant speed and keep the same visual size on every trace. */
const PULSE_SPEED = 120; // viewBox units per second while travelling
const PULSE_SIZE = 26; // viewBox units
const TRAVEL_SHARE = 0.62; // share of the cycle spent travelling (rest = pause)

function pulseFor(length: number, delay: number) {
  const travel = length / PULSE_SPEED;
  return {
    dur: Math.round((travel / TRAVEL_SHARE) * 10) / 10,
    delay,
    len: Math.round((PULSE_SIZE / length) * 1000) / 1000,
  };
}

export interface FieldNode {
  at: Pt;
  kind: 'via' | 'glow' | 'pad';
}

export interface Field {
  width: number;
  height: number;
  traces: FieldTrace[];
  nodes: FieldNode[];
}

interface Deco {
  /** trace index → start delay in seconds */
  pulses?: Record<number, number>;
  /** trace indexes whose end node glows */
  glow?: number[];
  /** draw-in on load, base delay in seconds */
  draw?: number;
  /** add a node at the start of each trace too */
  startNodes?: boolean;
}

class FieldBuilder {
  private traces: FieldTrace[] = [];
  private nodes: FieldNode[] = [];

  constructor(
    private width: number,
    private height: number,
  ) {}

  private add(items: Trace[], deco: Deco) {
    items.forEach((t, i) => {
      const delay = deco.pulses?.[i];
      this.traces.push({
        ...t,
        pulse: delay !== undefined ? pulseFor(t.length, delay) : undefined,
        draw: deco.draw !== undefined ? { delay: deco.draw + i * 0.14 } : undefined,
      });
      this.nodes.push({ at: t.end, kind: deco.glow?.includes(i) ? 'glow' : 'via' });
      if (deco.startNodes) this.nodes.push({ at: t.start, kind: 'pad' });
    });
    return this;
  }

  bus(center: Pt[], options: BusOptions, deco: Deco = {}) {
    return this.add(bus(center, options), deco);
  }

  line(points: Pt[], deco: Deco = {}) {
    return this.add([trace(points)], deco);
  }

  build(): Field {
    return { width: this.width, height: this.height, traces: this.traces, nodes: this.nodes };
  }
}

/* Hero — 1440×900. Text column on the right (RTL), illustration on the left. */
const hero = new FieldBuilder(1440, 900)
  .bus([[560, -20], [560, 66], [516, 110], [150, 110]], { count: 4, gap: 12, stagger: 38 }, {
    pulses: { 1: 0.6 },
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
  })
  .bus([[1460, 756], [1384, 756], [1322, 818], [950, 818]], { count: 4, gap: 12, stagger: 36 }, {
    pulses: { 1: 0.2 },
    glow: [3],
  })
  .line([[1460, 214], [1414, 214], [1392, 236], [1392, 560]], { draw: 0.8 })
  .build();

/* Light sections — 1440×1100, very subtle. Heading sits top-right (RTL). */
const light = new FieldBuilder(1440, 1100)
  .bus([[-20, 104], [146, 104], [196, 154], [196, 300]], { count: 3, gap: 12, stagger: 34 }, {
    pulses: { 1: 1 },
  })
  .line([[1460, 430], [1404, 430], [1372, 462], [1372, 780]], { pulses: { 0: 4 } })
  .bus([[-20, 1010], [36, 1010], [66, 980], [66, 640]], { count: 2, gap: 12, stagger: 60 })
  .build();

/* Dark sections — 1440×900, corners and outer gutters only. */
const dark = new FieldBuilder(1440, 900)
  .bus([[1460, 64], [1300, 64], [1258, 106], [1080, 106]], { count: 3, gap: 12, stagger: 40 }, {
    pulses: { 1: 0.8 },
    glow: [2],
  })
  .bus([[-20, 846], [196, 846], [238, 804], [440, 804]], { count: 3, gap: 12, stagger: 40 }, {
    pulses: { 0: 2.4 },
  })
  .line([[1394, 300], [1394, 700]], { startNodes: true })
  .build();

/* Green «why» section — 1440×800, mirrored top corners around a centred heading. */
const green = new FieldBuilder(1440, 800)
  .bus([[-20, 88], [176, 88], [218, 130], [218, 250]], { count: 3, gap: 12, stagger: 30 }, {
    pulses: { 1: 0.5 },
  })
  .bus([[1460, 88], [1264, 88], [1222, 130], [1222, 250]], { count: 3, gap: 12, stagger: 30, reverseStagger: true }, {
    pulses: { 1: 3.2 },
    glow: [0],
  })
  .build();

/* Final CTA panel — 1200×520. Content is centred; traces use side gutters and bottom band. */
const cta = new FieldBuilder(1200, 520)
  .bus([[-20, 118], [92, 118], [132, 158], [132, 420]], { count: 3, gap: 14, stagger: 44 }, {
    pulses: { 1: 0.4 },
    glow: [0],
  })
  .bus([[1220, 402], [1108, 402], [1068, 362], [1068, 100]], { count: 3, gap: 14, stagger: 44 }, {
    pulses: { 1: 2 },
    glow: [2],
  })
  .bus([[290, 540], [290, 500], [326, 470], [910, 470]], { count: 2, gap: 12, stagger: 120 }, {
    pulses: { 0: 1.2 },
  })
  .build();

export const fields = { hero, light, dark, green, cta } as const;
export type FieldName = keyof typeof fields;
