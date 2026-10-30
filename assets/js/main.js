/* ==========================================================================
   GilaClick — entry point. Loaded last (all scripts use `defer`, so the DOM
   is ready). Starts every registered module, each in isolation.
   ========================================================================== */
(function () {
  'use strict';

  var GC = window.GC;
  var root = document.documentElement;

  if (!GC || typeof GC.start !== 'function') {
    root.classList.add('reveal-fallback');
    return;
  }

  GC.start();

  // Safety nets: if a module could not run, never leave content hidden.
  if (typeof GC.observeReveals !== 'function') root.classList.add('reveal-fallback');
  GC.$$('[data-split]:not(.is-split)').forEach(function (el) {
    el.classList.add('is-split');
  });
})();
