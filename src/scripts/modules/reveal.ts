import { prefersReducedMotion } from '../utils/env';

let observer: IntersectionObserver | null = null;

/** Scroll-triggered reveal (fade/slide). Each element animates once, then is unobserved. */
export function initReveal(): void {
  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  observeReveals(document);
}

/** Registers [data-reveal] elements inside `root` (also used for content rendered later). */
export function observeReveals(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)').forEach((el) => {
    if (observer) observer.observe(el);
    else el.classList.add('is-revealed');
  });
}
