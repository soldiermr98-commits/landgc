import { prefersReducedMotion } from '../utils/env';

/**
 * Exposes each [data-progress] element's scroll progress as the CSS variable --p (0 → 1):
 * 0 when its top reaches the bottom of the viewport, 1 when its bottom leaves the top.
 * CSS uses it for scroll-linked drawing, light shifts and gentle parallax.
 * Only elements near the viewport are measured, at most once per frame.
 */
export function initProgress(): void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-progress]'));
  if (!elements.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.style.setProperty('--p', '1'));
    return;
  }

  const active = new Set<HTMLElement>();
  let frame = 0;

  const measure = (targets: Iterable<HTMLElement>) => {
    const vh = window.innerHeight;
    const values: [HTMLElement, string][] = [];
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      values.push([el, p.toFixed(4)]);
    }
    // write after all reads to avoid layout thrashing
    for (const [el, value] of values) el.style.setProperty('--p', value);
  };

  const schedule = () => {
    if (frame || !active.size) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure(active);
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) active.add(el);
        else {
          active.delete(el);
          measure([el]); // settle at 0 or 1 when leaving
        }
      }
      schedule();
    },
    { rootMargin: '15% 0px' },
  );

  measure(elements);
  elements.forEach((el) => io.observe(el));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}
