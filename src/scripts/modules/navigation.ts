import { prefersReducedMotion } from '../utils/env';

/** Desktop disclosure panels (hover for mouse, click/Enter for touch & keyboard). */
function initDesktopPanels(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-item]'));
  if (!items.length) return;

  let closeTimer = 0;
  let hoverOpenedAt = 0;

  const setOpen = (item: HTMLElement, open: boolean) => {
    item.classList.toggle('is-open', open);
    item.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', String(open));
  };
  const closeAll = (except?: HTMLElement) => items.forEach((i) => i !== except && setOpen(i, false));

  for (const item of items) {
    const toggle = item.querySelector<HTMLButtonElement>('[data-nav-toggle]');
    if (!toggle) continue;

    toggle.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      // A mouse click right after hover-open should not immediately close the panel.
      if (isOpen && performance.now() - hoverOpenedAt < 450) return;
      closeAll(item);
      setOpen(item, !isOpen);
    });

    item.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      window.clearTimeout(closeTimer);
      if (!item.classList.contains('is-open')) hoverOpenedAt = performance.now();
      closeAll(item);
      setOpen(item, true);
    });

    item.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      closeTimer = window.setTimeout(() => setOpen(item, false), 200);
    });

    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget as Node | null)) setOpen(item, false);
    });

    item.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && item.classList.contains('is-open')) {
        setOpen(item, false);
        toggle.focus();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!items.some((i) => i.contains(event.target as Node))) closeAll();
  });
}

const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Mobile off-canvas menu: focus trap, Escape, inert background, scroll lock. */
function initMobileDrawer(): void {
  const drawer = document.querySelector<HTMLElement>('[data-mobile-nav]');
  const opener = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  const panel = drawer?.querySelector<HTMLElement>('[data-mobile-panel]');
  if (!drawer || !opener || !panel) return;

  const background = ['.site-header', 'main', '.site-footer']
    .map((sel) => document.querySelector<HTMLElement>(sel))
    .filter((el): el is HTMLElement => Boolean(el));
  let lastFocus: HTMLElement | null = null;
  let hideTimer = 0;

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function open() {
    window.clearTimeout(hideTimer);
    lastFocus = document.activeElement as HTMLElement | null;
    drawer!.hidden = false;
    void drawer!.offsetWidth; // commit the hidden→visible change before animating
    drawer!.classList.add('is-open');
    opener!.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('is-locked');
    background.forEach((el) => el.setAttribute('inert', ''));
    panel!.querySelector<HTMLElement>('[data-menu-close]')?.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    if (drawer!.hidden) return;
    drawer!.classList.remove('is-open');
    opener!.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('is-locked');
    background.forEach((el) => el.removeAttribute('inert'));
    document.removeEventListener('keydown', onKeydown);
    hideTimer = window.setTimeout(() => (drawer!.hidden = true), prefersReducedMotion() ? 0 : 420);
    lastFocus?.focus({ preventScroll: true });
  }

  opener.addEventListener('click', open);
  drawer.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', close));
  drawer.querySelectorAll('[data-menu-link]').forEach((el) => el.addEventListener('click', close));
  window.matchMedia('(min-width: 1100px)').addEventListener('change', (e) => e.matches && close());
}

export function initNavigation(): void {
  initDesktopPanels();
  initMobileDrawer();
}
