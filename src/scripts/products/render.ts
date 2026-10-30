import { observeReveals } from '../modules/reveal';
import { bindImageFallback } from '../modules/image-fallback';
import type { PriceView, ProductView } from './types';

/** Maximum number of non-featured products on the homepage (the shop has the full list). */
const MAX_GRID = 5;

const IMAGE_SIZES = {
  featured: '(min-width: 1024px) 800px, 100vw',
  card: '(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw',
};

function template(root: HTMLElement, name: string): DocumentFragment {
  const tpl = root.querySelector<HTMLTemplateElement>(`template[data-tpl="${name}"]`);
  if (!tpl) throw new Error(`Missing template: ${name}`);
  return tpl.content.cloneNode(true) as DocumentFragment;
}

function slot<T extends Element = HTMLElement>(scope: ParentNode, name: string): T | null {
  return scope.querySelector<T>(`[data-slot="${name}"]`);
}

function priceNode(root: HTMLElement, price: PriceView): DocumentFragment {
  if (price.kind === 'inquiry') return template(root, 'price-inquiry');

  const frag = template(root, 'price');
  const amount = slot<HTMLDataElement>(frag, 'amount')!;
  const unit = slot(frag, 'unit')!;
  const prefix = slot(frag, 'prefix')!;
  unit.textContent = price.unit;
  if (price.prefix) {
    prefix.textContent = price.prefix;
    prefix.hidden = false;
  }

  if (price.kind === 'range') {
    amount.textContent = `${price.min} تا ${price.max}`;
    amount.removeAttribute('value');
  } else {
    amount.textContent = price.amount;
    amount.value = String(price.value);
    if (price.regular) {
      const regular = slot(frag, 'regular')!;
      regular.textContent = `${price.regular} ${price.unit}`;
      regular.hidden = false;
    }
  }
  return frag;
}

function buildCard(root: HTMLElement, vm: ProductView, featured: boolean): DocumentFragment {
  const frag = template(root, featured ? 'featured' : 'card');

  const media = slot<HTMLAnchorElement>(frag, 'media')!;
  const img = slot<HTMLImageElement>(frag, 'image')!;
  media.href = vm.url;
  if (vm.image) {
    img.src = vm.image.src;
    if (vm.image.srcset) {
      img.srcset = vm.image.srcset;
      img.sizes = featured ? IMAGE_SIZES.featured : IMAGE_SIZES.card;
    }
    img.alt = vm.image.alt;
    bindImageFallback(img, media);
  } else {
    img.remove();
    media.classList.add('is-broken');
  }

  slot(frag, 'category')!.textContent = vm.category;

  const title = slot<HTMLAnchorElement>(frag, 'title')!;
  title.href = vm.url;
  title.textContent = vm.name;

  slot(frag, 'summary')!.textContent = vm.summary;

  const list = slot(frag, 'highlights');
  if (list) {
    for (const text of vm.highlights) {
      const item = template(root, 'highlight');
      slot(item, 'text')!.textContent = text;
      list.append(item);
    }
  }

  slot(frag, 'price')!.append(priceNode(root, vm.price));

  const details = slot<HTMLAnchorElement>(frag, 'details')!;
  details.href = vm.url;
  details.setAttribute('aria-label', `مشاهده جزئیات محصول ${vm.name}`);

  const cart = slot<HTMLAnchorElement>(frag, 'add-to-cart');
  if (cart && vm.addToCartUrl) {
    cart.href = vm.addToCartUrl;
    cart.setAttribute('aria-label', `افزودن ${vm.name} به سبد خرید`);
    cart.hidden = false;
  }
  return frag;
}

function finish(root: HTMLElement, grid: HTMLElement, state: string) {
  grid.querySelectorAll('[data-skeleton]').forEach((el) => el.remove());
  grid.setAttribute('aria-busy', 'false');
  root.dataset.state = state;
  observeReveals(grid);
}

export function renderProducts(root: HTMLElement, views: ProductView[], featuredId: number | null): void {
  const grid = root.querySelector<HTMLElement>('[data-products-grid]');
  const anchor = grid?.querySelector('[data-products-custom]') ?? null;
  if (!grid) return;

  const featured = views.find((v) => v.id === featuredId) ?? views[0];
  const rest = views.filter((v) => v !== featured).slice(0, MAX_GRID);

  const frag = document.createDocumentFragment();
  if (featured) frag.append(buildCard(root, featured, true));
  for (const vm of rest) frag.append(buildCard(root, vm, false));
  grid.insertBefore(frag, anchor);
  finish(root, grid, 'ready');
}

export function renderNotice(root: HTMLElement, copy: { title: string; body: string }, state: string): void {
  const grid = root.querySelector<HTMLElement>('[data-products-grid]');
  if (!grid) return;
  const frag = template(root, 'notice');
  slot(frag, 'title')!.textContent = copy.title;
  slot(frag, 'body')!.textContent = copy.body;
  grid.insertBefore(frag, grid.querySelector('[data-products-custom]'));
  finish(root, grid, state);
}
