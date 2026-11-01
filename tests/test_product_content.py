"""Structural and data regressions for the Single Product exports.

Run with: python3 -m unittest discover -s tests -p 'test_product_*.py'
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def walk(elements):
    for element in elements:
        yield element
        yield from walk(element.get('elements', []))


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class ProductContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'assets/data/product-preview-fa.json').read_text(encoding='utf-8'))
        cls.template = json.loads((ROOT / 'gilaclick-product-elementor.json').read_text(encoding='utf-8'))
        cls.static = (ROOT / 'gilaclick-product.html').read_text(encoding='utf-8')
        cls.elements = list(walk(cls.template['content']))
        cls.parser = PageParser()
        cls.parser.feed(cls.static)

    def test_template_is_a_dynamic_single_product_document(self):
        self.assertEqual((self.template['type'], self.template['version']), ('product', '0.4'))
        self.assertEqual(len(self.elements), len({element['id'] for element in self.elements}))
        required = {
            'woocommerce-product-title', 'woocommerce-product-short-description',
            'woocommerce-product-images', 'woocommerce-product-price', 'woocommerce-product-stock',
            'woocommerce-product-add-to-cart', 'woocommerce-product-content',
            'woocommerce-product-additional-information', 'woocommerce-product-data-tabs',
            'woocommerce-product-meta', 'woocommerce-product-related', 'woocommerce-breadcrumb',
            'woocommerce-notices',
        }
        self.assertTrue(required <= {e.get('widgetType') for e in self.elements})
        title = next(e for e in self.elements if e.get('widgetType') == 'woocommerce-product-title')
        self.assertIn('woocommerce-product-title-tag', title['settings']['__dynamic__']['title'])
        # The template must not turn a single observed product into site-wide data.
        raw = json.dumps(self.template, ensure_ascii=False)
        for sample in (self.data['name'], self.data['price'], self.data['related']['name']):
            self.assertNotIn(sample, raw)
        html_widgets = '\n'.join(e['settings'].get('html', '') for e in self.elements if e.get('widgetType') == 'html')
        self.assertNotRegex(html_widgets, r'<(?:header|footer)\b')  # The site's actual header/footer remain in use.

    def test_snapshot_has_explicit_date_real_product_and_destination(self):
        self.assertEqual(self.data['observed_on'], '2026-11-01')
        self.assertEqual(self.data['observed_on_fa'], '۱۰ آبان ۱۴۰۵')
        for text in (self.data['name'], self.data['price'], self.data['currency'],
                     self.data['related']['name'], self.data['related']['price'], self.data['observed_on_fa']):
            self.assertIn(text, self.static)
        self.assertIn('قیمت نهایی در فروشگاه بررسی می‌شود', self.static)
        self.assertIn('<meta name="robots" content="noindex,nofollow">', self.static)
        self.assertIn('lang="fa" dir="rtl"', self.static)
        forms = [a for t, a in self.parser.tags if t == 'form']
        self.assertEqual(len(forms), 1)
        self.assertEqual(forms[0].get('action'), self.data['source'])
        self.assertEqual(forms[0].get('method'), 'post')
        inputs = [a for t, a in self.parser.tags if t in ('input', 'button')]
        self.assertTrue(any(a.get('name') == 'add-to-cart' and a.get('value') == str(self.data['id']) for a in inputs))
        links = [a.get('href', '') for t, a in self.parser.tags if t == 'a']
        self.assertIn(self.data['related']['url'], links)
        self.assertIn('https://gilaclick.ir/contact-us/', links)
        self.assertFalse(any(href in ('#', 'javascript:void(0)') for href in links))

    def test_actual_sample_content_not_fictitious_reviews_or_sale(self):
        self.assertEqual(len(re.findall(r'<h1\b', self.static, re.I)), 1)
        self.assertEqual(sum(t == 'main' for t, _ in self.parser.tags), 1)
        self.assertEqual(sum(t == 'header' for t, _ in self.parser.tags), 1)
        self.assertEqual(sum(t == 'footer' for t, _ in self.parser.tags), 1)
        self.assertIn('مزایای کلیدی افزونه', self.static)
        for item in self.data['faq']:
            self.assertIn(item['question'], self.static)
            self.assertIn(item['answer'], self.static)
        self.assertNotRegex(self.static, r'<(?:del|ins)\b')  # The observed product had no sale.
        self.assertNotIn('woocommerce-review__author', self.static)  # Its reviews API was empty.
        self.assertIn('data-gpd-original="' + self.data['cover'] + '"', self.static)
        self.assertIn('data-gpd-original="' + self.data['screenshot'] + '"', self.static)
        self.assertIn('data-gpd-original="' + self.data['related']['image'] + '"', self.static)

    def test_both_outputs_embed_current_maintained_assets(self):
        embedded = '\n'.join(e['settings'].get('html', '') for e in self.elements if e.get('widgetType') == 'html')
        for path in ('assets/css/product.css', 'assets/js/product.js'):
            asset = (ROOT / path).read_text(encoding='utf-8').strip()
            self.assertIn(asset, self.static, path)
            self.assertIn(asset, embedded, path)
        compat = (ROOT / 'assets/js/product-editor-compat.js').read_text(encoding='utf-8').strip()
        self.assertIn(compat, embedded)
        self.assertNotIn(compat, self.static)  # The shim is only needed inside the Elementor editor.
        self.assertIn((ROOT / 'assets/css/product-header-preview.css').read_text(encoding='utf-8').strip(), self.static)
        self.assertNotRegex(self.static.lower(), r'@font-face|data:font/')
        self.assertIn("'peyda'", self.static.lower())


if __name__ == '__main__':
    unittest.main()
