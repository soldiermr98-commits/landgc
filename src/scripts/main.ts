import { initHeader } from './modules/header';
import { initNavigation } from './modules/navigation';
import { initReveal } from './modules/reveal';
import { initProgress } from './modules/progress';
import { initVisibility } from './modules/visibility';
import { initSpotlight } from './modules/spotlight';
import { initImageFallbacks } from './modules/image-fallback';
import { initCartBadge } from './modules/cart-badge';
import { initProducts } from './products';

/** Each feature is isolated: one failing module never blocks the others. */
function run(name: string, init: () => unknown): void {
  try {
    const result = init();
    if (result instanceof Promise) result.catch((error) => console.error(`[GilaClick] ${name}:`, error));
  } catch (error) {
    console.error(`[GilaClick] ${name}:`, error);
  }
}

run('header', initHeader);
run('navigation', initNavigation);
run('reveal', initReveal);
document.documentElement.classList.add('motion-ready');
run('progress', initProgress);
run('visibility', initVisibility);
run('spotlight', initSpotlight);
run('image-fallback', initImageFallbacks);
run('products', initProducts);
run('cart-badge', initCartBadge);
