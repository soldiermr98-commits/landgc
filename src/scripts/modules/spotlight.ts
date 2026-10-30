import { canHover, prefersReducedMotion } from '../utils/env';

/**
 * Pointer-following light for [data-spotlight] cards: sets --mx / --my (px) used by the
 * card's lit border and inner glow. One delegated listener, throttled to one write per frame.
 */
export function initSpotlight(): void {
  if (!canHover() || prefersReducedMotion()) return;

  let frame = 0;
  let pending: { card: HTMLElement; x: number; y: number } | null = null;

  const apply = () => {
    frame = 0;
    if (!pending) return;
    const { card, x, y } = pending;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${Math.round(x - rect.left)}px`);
    card.style.setProperty('--my', `${Math.round(y - rect.top)}px`);
  };

  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      const card = (event.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]');
      if (!card) return;
      pending = { card, x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    },
    { passive: true },
  );
}
