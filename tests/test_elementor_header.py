"""Structural checks for the self-contained Elementor header export.

Run with: python3 -m unittest discover -s tests -p 'test_*.py'
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def flatten(elements):
    for element in elements:
        yield element
        yield from flatten(element.get('elements', []))


def with_class(elements, value):
    return next(e for e in flatten(elements) if value in (e.get('settings', {}).get('_css_classes', '').split()))


class HeaderTemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = json.loads((ROOT / 'gilaclick header.json').read_text(encoding='utf-8'))
        cls.home = json.loads((ROOT / 'gilaclick-elementor.json').read_text(encoding='utf-8'))
        cls.elements = list(flatten(cls.template['content']))
        cls.html = {e['settings']['_title']: e['settings']['html'] for e in cls.elements if e.get('widgetType') == 'html'}
        cls.stage = cls.html['نمای اصلی سربرگ — گرافیک و تعامل']
        cls.drawer = cls.html['منوی موبایل — کد HTML']
        cls.style = cls.html['⚙️ استایل‌ها و تنظیمات — حذف نشود']
        cls.runtime = cls.html['⚙️ رفتار و اتصال سربرگ — حذف نشود']

    def test_header_export_and_unique_element_ids(self):
        self.assertEqual(self.template['type'], 'header')
        self.assertEqual(self.template['version'], '0.4')
        self.assertEqual(len(self.template['content']), 4)
        ids = [e['id'] for e in self.elements]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual([e['settings']['css_classes'].split()[-1] for e in self.template['content']],
                         ['gch-style-root', 'gch-header-root', 'gch-drawer-root', 'gch-runtime-root'])

    def test_editable_widgets_and_homepage_bindings_remain(self):
        for key in range(201, 241):
            with self.subTest(key=key):
                control = with_class(self.template['content'], 'gc-bind-' + str(key))
                self.assertIn(control.get('widgetType'), ('heading', 'button', 'icon'))
                self.assertIn('data-gc-bind="' + str(key) + '"', self.stage)
                if key not in (207, 210, 213, 216, 221, 224, 227, 230, 238):
                    self.assertIn('data-gc-mirror="' + str(key) + '"', self.drawer)
        self.assertIn('gc-header-menu-order', json.dumps(self.template, ensure_ascii=False))
        self.assertIn('gc-header-action-order', json.dumps(self.template, ensure_ascii=False))

    def test_user_customization_and_real_service_destinations(self):
        control = with_class(self.template['content'], 'gc-bind-232')['settings']
        self.assertEqual(control['text'], 'خدمات و تعرفه')
        self.assertEqual(control['link']['url'], 'https://gilaclick.ir/price-web-services/')
        for markup, attr in [(self.stage, 'data-gc-bind'), (self.drawer, 'data-gc-mirror')]:
            footer = re.search(r'<a\b[^>]*' + attr + r'="232"[^>]*>.*?</a>', markup, re.S).group()
            self.assertIn('خدمات و تعرفه', footer)
            self.assertIn('https://gilaclick.ir/price-web-services/', footer)
        for key, fragment in [(220, 'web'), (223, 'seo'), (226, 'support'), (229, 'dev')]:
            expected = 'https://gilaclick.ir/#service-' + fragment
            self.assertEqual(with_class(self.template['content'], 'gc-bind-' + str(key))['settings']['link']['url'], expected)
            self.assertIn('href="' + expected + '"', self.stage)
            self.assertIn('href="' + expected + '"', self.drawer)
        self.assertEqual(with_class(self.template['content'], 'gc-bind-202')['settings']['typography_font_family'], 'peyda')

    def test_accessibility_and_unique_sprite_ids(self):
        self.assertIn('aria-controls="gch-mobile-nav"', self.stage)
        self.assertIn('aria-expanded="false"', self.stage)
        self.assertIn('data-menu-open=""', self.stage)
        self.assertIn('id="gch-mobile-nav"', self.drawer)
        for attr in ('data-mobile-nav=""', 'data-mobile-panel=""', 'data-menu-close=""', 'role="dialog"', 'aria-modal="true"'):
            self.assertIn(attr, self.drawer)
        for target in re.findall(r'aria-controls="([^"]+)"', self.stage):
            self.assertIn('id="' + target + '"', self.stage + self.drawer)
        uses = set(re.findall(r'href="#(gch-i-[\w-]+)"', self.stage + self.drawer))
        symbols = re.findall(r'<symbol id="(gch-i-[\w-]+)"', self.style)
        self.assertEqual(uses, set(symbols))
        self.assertEqual(len(symbols), len(set(symbols)))

    def test_scoped_embedded_css_and_runtime_match_sources(self):
        css = (ROOT / 'assets/css/elementor-header-standalone.css').read_text(encoding='utf-8')
        js = (ROOT / 'assets/js/elementor-header-standalone.js').read_text(encoding='utf-8')
        self.assertIn(css, self.style)
        exported = json.dumps(self.template, ensure_ascii=False)
        self.assertNotRegex(exported, r'(?i)@font-face|data:font/|base64,')
        self.assertNotIn('GilaClick Header Fallback', exported)
        self.assertIn("'peyda'", css)
        self.assertIn('data-gch-spacer', self.style)
        self.assertNotIn('body.elementor-page', self.style)
        self.assertNotIn('data-cursor-aura', self.style)
        self.assertNotIn('data-scroll-bar', self.style)
        self.assertNotIn('window.GC =', self.runtime)
        before, after = js.split('/*__HEADER_META__*/{}')
        self.assertIn(before, self.runtime)
        self.assertIn(after, self.runtime)
        meta = re.search(r'var META = (\{.*?\});\n  var ownScript', self.runtime, re.S)
        self.assertIsNotNone(meta)
        self.assertEqual(set(json.loads(meta.group(1))), {str(n) for n in range(201, 241)})

    def test_unedited_control_settings_equal_homepage(self):
        for key in range(201, 241):
            separate = dict(with_class(self.template['content'], 'gc-bind-' + str(key))['settings'])
            home = dict(with_class(self.home['content'], 'gc-bind-' + str(key))['settings'])
            if key == 202:
                separate.pop('typography_typography')
                separate.pop('typography_font_family')
            if key in (220, 223, 226, 229):
                separate['link'] = dict(separate['link'])
                separate['link']['url'] = separate['link']['url'].removeprefix('https://gilaclick.ir/')
            if key == 232:  # the uploaded header intentionally customized this control
                continue
            self.assertEqual(separate, home, f'control {key} changed unexpectedly')


if __name__ == '__main__':
    unittest.main()
