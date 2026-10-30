/** Pauses CSS animations inside [data-visibility] sections while they are off-screen. */
export function initVisibility(): void {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
    },
    { rootMargin: '120px 0px' },
  );
  document.querySelectorAll('[data-visibility]').forEach((el) => io.observe(el));
}
