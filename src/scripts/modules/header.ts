/** Docks the header (light floating bar → full-width translucent bar) once the page scrolls. */
export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;

  let frame = 0;
  const update = () => {
    frame = 0;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  update();
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
}
