/**
 * Build-time geometry for the PCB-style circuit artwork.
 *
 * Traces are described by a centerline made of horizontal, vertical and 45° segments.
 * `bus()` offsets that centerline into evenly spaced parallel traces using miter joins,
 * which keeps the spacing constant through every bend — the way real PCB buses are routed.
 * Everything here runs during the Astro build; the browser only receives SVG paths.
 */

export type Pt = readonly [number, number];

export interface Trace {
  /** SVG path data. */
  d: string;
  start: Pt;
  end: Pt;
  /** Geometric length in viewBox units (used to size and time travelling pulses). */
  length: number;
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** Unit normal (pointing to the left of the travel direction) of segment a→b. */
function normal(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

/** Offsets a polyline by `d` units with miter joins (exact for 45°/90° bends). */
export function offsetPolyline(points: readonly Pt[], d: number): Pt[] {
  if (d === 0 || points.length < 2) return points.map((p) => [p[0], p[1]] as Pt);
  const normals = points.slice(0, -1).map((p, i) => normal(p, points[i + 1]));
  return points.map((p, i) => {
    if (i === 0) return [p[0] + normals[0][0] * d, p[1] + normals[0][1] * d] as Pt;
    if (i === points.length - 1) {
      const n = normals[normals.length - 1];
      return [p[0] + n[0] * d, p[1] + n[1] * d] as Pt;
    }
    const a = normals[i - 1];
    const b = normals[i];
    const k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k] as Pt;
  });
}

/** Moves the last point back along the final segment (used to stagger bus endings). */
export function trimEnd(points: readonly Pt[], amount: number): Pt[] {
  const out = points.map((p) => [p[0], p[1]] as Pt);
  if (amount <= 0 || out.length < 2) return out;
  const a = out[out.length - 2];
  const b = out[out.length - 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t = Math.max(0, (len - amount) / len);
  out[out.length - 1] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return out;
}

export function toPath(points: readonly Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p[0])} ${round(p[1])}`).join(' ');
}

export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

export function trace(points: readonly Pt[]): Trace {
  return {
    d: toPath(points),
    start: [round(points[0][0]), round(points[0][1])],
    end: [round(points[points.length - 1][0]), round(points[points.length - 1][1])],
    length: round(polylineLength(points)),
  };
}

export interface BusOptions {
  /** Number of parallel traces. */
  count: number;
  /** Distance between neighbouring traces. */
  gap: number;
  /** Each trace ends `stagger` units earlier than the previous one (fan-out look). */
  stagger?: number;
  /** Reverse which side gets the longest trace. */
  reverseStagger?: boolean;
}

/** A bundle of parallel traces following `center`. */
export function bus(center: readonly Pt[], { count, gap, stagger = 0, reverseStagger = false }: BusOptions): Trace[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * gap;
    const order = reverseStagger ? count - 1 - i : i;
    return trace(trimEnd(offsetPolyline(center, offset), order * stagger));
  });
}
