"""Content and structural regressions for the FAQ exports.

Run with: python3 -m unittest discover -s tests -p 'test_faq_*.py'
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


def plain(markup):
    class Collector(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
    parser = Collector()
    parser.feed(markup)
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()


def answer_parts(question):
    parts = []
    for block in question['answer']:
        if 'paragraph' in block:
            parts.append(block['paragraph'])
        elif 'list' in block:
            parts.extend(block['list'])
        elif 'definitions' in block:
            parts.extend(x['term'] + ': ' + x['description'] for x in block['definitions'])
        elif 'links' in block:
            parts.extend(x['text'] for x in block['links'])
    return ''.join(parts)


class FAQContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'assets/data/faq-fa.json').read_text(encoding='utf-8'))
        cls.template = json.loads((ROOT / 'gilaclick-faq-elementor.json').read_text(encoding='utf-8'))
        cls.static = (ROOT / 'gilaclick-faq.html').read_text(encoding='utf-8')
        cls.elements = list(walk(cls.template['content']))
        cls.questions = [q for group in cls.data['groups'] for q in group['questions']]

    def test_exact_category_and_question_order(self):
        self.assertEqual([g['id'] for g in self.data['groups']], ['products', 'web', 'seo', 'support'])
        self.assertEqual([len(g['questions']) for g in self.data['groups']], [6, 6, 5, 7])
        self.assertEqual([q['number'] for q in self.questions], list(range(1, 25)))
        headings = [e['settings']['title'] for e in self.elements if 'gf-question' in e.get('settings', {}).get('_css_classes', '').split()]
        self.assertEqual(headings, [q['question'] for q in self.questions])
        for group in self.data['groups']:
            self.assertIn(group['heading'], self.static)
        for question in self.questions:
            self.assertIn(question['question'], self.static)

    def test_all_answers_are_individually_editable_and_complete(self):
        answers = [e['settings']['editor'] for e in self.elements if e.get('widgetType') == 'text-editor' and 'gf-answer' in e['settings'].get('_css_classes', '').split()]
        self.assertEqual(len(answers), 24)
        for q, answer in zip(self.questions, answers):
            with self.subTest(question=q['number']):
                self.assertEqual(plain(answer), answer_parts(q))
                self.assertIn(answer, self.static)

    def test_template_is_native_page_and_ids_unique(self):
        self.assertEqual((self.template['type'], self.template['version']), ('page', '0.4'))
        self.assertEqual(len(self.elements), len({element['id'] for element in self.elements}))
        self.assertEqual(len(re.findall(r'<h1\b', self.static, re.I)), 1)
        self.assertIn(self.data['hero_title'], plain(self.static))
        self.assertIn('typography_font_family', json.dumps(self.template, ensure_ascii=False))
        self.assertIn('peyda', self.static.lower())
        self.assertNotRegex(self.static.lower(), r'@font-face|data:font/|base64,')

    def test_user_text_and_destination_links(self):
        for key in ('hero_subtitle', 'intro_heading', 'intro', 'cta_heading', 'cta_text', 'closing'):
            self.assertIn(self.data[key], self.static)
        for link in ('https://t.me/mdjavad01', 'https://wa.me/989389659910',
                     'https://gilaclick.ir/shop/', 'https://gilaclick.ir/price-web-services/',
                     'https://gilaclick.ir/service/', 'https://gilaclick.ir/about-us/', 'https://gilaclick.ir/contact-us/'):
            self.assertIn(link, self.static)
        for value in ('۵ میلیون تومان', '۴۵ میلیون تومان', '۶۰ میلیون تومان', '۲۰ میلیون تومان', '۶ ماه'):
            self.assertIn(value, self.static)
        self.assertIn('<meta name="description"', self.static)
        self.assertIn('<title>سوالات متداول گیلاکلیک', self.static)

    def test_embedded_assets_match_maintained_sources(self):
        embedded = '\n'.join(e['settings'].get('html', '') for e in self.elements if e.get('widgetType') == 'html')
        for path in ('assets/css/faq.css', 'assets/js/faq.js', 'assets/img/faq-hero.svg', 'assets/img/faq-cta.svg'):
            asset = (ROOT / path).read_text(encoding='utf-8').strip()
            self.assertIn(asset, self.static, path)
            self.assertIn(asset, embedded, path)


if __name__ == '__main__':
    unittest.main()
