/* Elementor's Product Images widget can call Woo's gallery before Woo's footer
 * script has registered it in the editor iframe. This editor-only temporary
 * no-op is replaced by WooCommerce's real method at DOM ready; Woo then
 * initializes its own galleries normally. It is never installed on the live
 * product page. */
(function () {
  'use strict';
  if (!/(?:\?|&)elementor-preview=/.test(window.location.search) &&
      !document.body.classList.contains('elementor-editor-active')) return;
  var $ = window.jQuery;
  if (!$ || !$.fn || $.fn.wc_product_gallery) return;
  var temporary = function () { return this; };
  $.fn.wc_product_gallery = temporary;
  window.addEventListener('load', function () {
    if ($.fn.wc_product_gallery === temporary) delete $.fn.wc_product_gallery;
  }, { once: true });
}());
