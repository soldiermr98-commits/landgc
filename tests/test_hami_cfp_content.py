"""Structural regressions for the dedicated Hami product template."""
import json
import re
import subprocess
import sys
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def walk(elements):
    for element in elements:
        yield element
        yield from walk(element.get('elements', []))


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class HamiContentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.copy = json.loads((ROOT / 'assets/data/hami-cfp-fa.json').read_text())
        cls.sample = json.loads((ROOT / 'assets/data/product-preview-fa.json').read_text())
        cls.template = json.loads((ROOT / 'gilaclick-hami-call-for-price-elementor.json').read_text())
        cls.html = (ROOT / 'gilaclick-hami-call-for-price.html').read_text()
        cls.elements = list(walk(cls.template['content']))
        cls.tags = Tags()
        cls.tags.feed(cls.html)

    def test_dedicated_template_uses_live_woocommerce_widgets(self):
        self.assertEqual(self.template['type'], 'product')
        self.assertEqual(self.copy['product_id_observed'], 5289)
        self.assertEqual(self.template['content'][0]['settings']['css_classes'], 'hcf-page')
        self.assertEqual(self.template['page_settings'], {})  # Display conditions must be set manually.
        widgets = [item.get('widgetType') for item in self.elements]
        for widget in ('woocommerce-product-images', 'woocommerce-product-price',
                       'woocommerce-product-stock', 'wc-add-to-cart',
                       'woocommerce-notices', 'woocommerce-product-meta',
                       'woocommerce-product-additional-information',
                       'woocommerce-product-data-tabs', 'woocommerce-product-related'):
            self.assertEqual(widgets.count(widget), 1, widget)
        self.assertGreater(widgets.count('heading'), 30)
        self.assertGreater(widgets.count('text-editor'), 10)
        self.assertGreaterEqual(widgets.count('button'), 3)
        # Header and footer are *not* part of the imported product template.
        raw = json.dumps(self.template, ensure_ascii=False)
        self.assertNotIn('<header class=', raw)
        self.assertNotIn('<footer class=', raw)
        self.assertNotIn('۱٬۴۸۰٬۰۰۰', raw)  # The selling price comes from WooCommerce.
        self.assertNotIn('woocommerce-review__author', raw)
        purchase = next(item for item in self.elements if item.get('widgetType') == 'wc-add-to-cart')
        self.assertEqual(purchase['settings']['text'], 'خرید افزونه')
        self.assertEqual(purchase['settings']['show_quantity'], 'yes')  # Native Woo form, not AJAX-only.
        self.assertEqual(purchase['settings']['_element_cache'], 'yes')  # Elementor's "Inactive" element cache.
        self.assertNotIn('product_id', purchase['settings'])  # Use the current product.
        main = next(item for item in self.elements if item.get('settings', {}).get('_element_id') == 'hcf-main')
        children = [item.get('settings', {}).get('_element_id') for item in main['elements']]
        self.assertLess(children.index('hcf-related'), children.index('hcf-reviews'))
        content = next(item for item in self.elements if item.get('settings', {}).get('css_classes') == 'hcf-content')
        self.assertFalse(any(item.get('settings', {}).get('_element_id') == 'hcf-reviews' for item in walk(content['elements'])))

    def test_editable_content_and_real_media(self):
        by_class = {item.get('settings', {}).get('_css_classes'): item
                    for item in self.elements if item.get('elType') == 'widget'}
        screen = by_class['hcf-capture-image']
        self.assertEqual(screen['widgetType'], 'text-editor')
        markup = screen['settings']['editor']
        self.assertIn(self.sample['screenshot'], markup)
        self.assertIn(self.sample['screenshot_alt'], markup)
        self.assertIn('aria-label="بزرگ‌نمایی تصویر تنظیمات حامی"', markup)
        self.assertIn('loading="lazy"', markup)
        self.assertIn('width="1000" height="669"', markup)
        self.assertIn('<table>', by_class['hcf-table']['settings']['editor'])
        for item in self.copy['faq']:
            self.assertIn(item['question'], self.html)
            self.assertIn(item['answer'], self.html)
        self.assertEqual(len(self.copy['faq']), 7)
        self.assertEqual(len(self.copy['features']), 5)
        self.assertEqual(len(self.copy['steps']), 4)
        self.assertIn(self.copy['source_technical'], self.html)
        self.assertNotIn('Lorem ipsum', self.html)

    def test_preview_is_honestly_dated_and_links_to_the_real_store(self):
        self.assertEqual(len([1 for tag, _ in self.tags.tags if tag == 'h1']), 1)
        self.assertEqual(len([1 for tag, _ in self.tags.tags if tag == 'header']), 1)
        self.assertEqual(len([1 for tag, _ in self.tags.tags if tag == 'footer']), 1)
        forms = [attrs for tag, attrs in self.tags.tags if tag == 'form' and attrs.get('class') == 'cart']
        self.assertEqual(len(forms), 1)
        self.assertEqual(forms[0]['action'], self.sample['source'])
        self.assertEqual(forms[0]['method'], 'post')
        self.assertIn('<span class="elementor-button-text">خرید افزونه</span></span></button></form>', self.html)
        self.assertLess(self.html.index('id="hcf-related"'), self.html.index('id="hcf-reviews"'))
        self.assertLess(self.html.index('id="hcf-reviews"'), self.html.index('<section class="e-con e-con-full hcf-final">'))
        self.assertIn(self.copy['observed_on_fa'], self.html)
        self.assertIn(self.sample['related']['url'], self.html)
        self.assertIn('data-hcf-original="' + self.sample['cover'] + '"', self.html)
        self.assertIn('data-hcf-original="' + self.sample['screenshot'] + '"', self.html)
        self.assertNotRegex(self.html, r'<(?:del|ins)\b')  # Observed without a sale.
        self.assertNotIn('woocommerce-review__author', self.html)
        for tag, attrs in self.tags.tags:
            if tag == 'a':
                self.assertNotIn(attrs.get('href'), ('#', 'javascript:void(0)'))

    def test_assets_are_scoped_font_is_not_embedded_and_build_is_reproducible(self):
        css = (ROOT / 'assets/css/hami-cfp.css').read_text().strip()
        js = (ROOT / 'assets/js/hami-cfp.js').read_text().strip()
        blocks = '\n'.join(item['settings'].get('html', '') for item in self.elements
                           if item.get('widgetType') == 'html')
        self.assertIn(css, blocks)
        self.assertIn(js, blocks)
        self.assertIn(css, self.html)
        self.assertIn(js, self.html)
        for output in (blocks, self.html):
            self.assertNotIn('@font-face', output)
            self.assertNotIn('data:font/', output)
            self.assertNotIn('HCFPreviewFallback', output)
        self.assertIn('peyda', css.lower())
        self.assertIn('prefers-reduced-motion', css)
        self.assertRegex(css, r'\.hcf-add form\.cart \.quantity\s*\{\s*display:\s*none\s*!important')
        self.assertIn('prefers-reduced-motion', js)
        self.assertRegex(css, r'(?m)^\.hcf-page')
        before = (self.html, (ROOT / 'gilaclick-hami-call-for-price-elementor.json').read_text())
        subprocess.run([sys.executable, 'scripts/build_hami_cfp.py'], cwd=ROOT, check=True,
                       stdout=subprocess.DEVNULL)
        after = ((ROOT / 'gilaclick-hami-call-for-price.html').read_text(),
                 (ROOT / 'gilaclick-hami-call-for-price-elementor.json').read_text())
        self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
