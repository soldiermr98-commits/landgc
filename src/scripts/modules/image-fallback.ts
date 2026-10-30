/**
 * Adds `.is-broken` to `target` when an image fails to load, so a branded placeholder is
 * shown instead of a broken-image icon (e.g. if the media host is unreachable).
 */
export function bindImageFallback(img: HTMLImageElement, target: Element = img): void {
  const mark = () => target.classList.add('is-broken');
  if (img.complete && img.getAttribute('src') && img.naturalWidth === 0) mark();
  else img.addEventListener('error', mark, { once: true });
}

export function initImageFallbacks(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-fallback]').forEach((img) => bindImageFallback(img));
}
