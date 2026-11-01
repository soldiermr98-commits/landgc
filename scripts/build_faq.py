#!/usr/bin/env python3
"""Build the FAQ-only static page and Elementor 4 template from shared sources.

The site-wide header and footer files are not modified. Their approved About-page
widgets are copied into the new, standalone Canvas template. FAQ questions and
answers use native Elementor Heading and Text Editor widgets.
"""
from __future__ import annotations

import copy
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'assets/data/faq-fa.json').read_text(encoding='utf-8'))
ABOUT_JSON = json.loads((ROOT / 'gilaclick-about-elementor.json').read_text(encoding='utf-8'))
ABOUT_HTML = (ROOT / 'gilaclick-about.html').read_text(encoding='utf-8')
CSS = (ROOT / 'assets/css/faq.css').read_text(encoding='utf-8')
JS = (ROOT / 'assets/js/faq.js').read_text(encoding='utf-8')
HERO_SVG = (ROOT / 'assets/img/faq-hero.svg').read_text(encoding='utf-8').strip()
CTA_SVG = (ROOT / 'assets/img/faq-cta.svg').read_text(encoding='utf-8').strip()

if '</script' in JS.lower() or '</style' in CSS.lower():
    raise ValueError('Raw style or script contains a closing tag')

counter = 1


def next_id():
    global counter
    value = f'f{counter:06x}'
    counter += 1
    return value


def container(title, classes, elements, tag='div', element_id=None):
    settings = {'content_width': 'full', 'css_classes': classes, '_title': title, 'html_tag': tag}
    if element_id:
        settings['_element_id'] = element_id
    return {'id': next_id(), 'elType': 'container', 'isInner': True, 'isLocked': False, 'settings': settings, 'elements': elements}


def widget(kind, editor_title, classes, **settings):
    values = {'_css_classes': classes, '_title': editor_title}
    values.update(settings)
    return {'id': next_id(), 'elType': 'widget', 'widgetType': kind, 'isInner': True, 'isLocked': False, 'settings': values, 'elements': []}


def heading(title, text, classes, tag='p', register_font=False):
    settings = {'title': text, 'header_size': tag}
    if register_font:
        settings.update(typography_typography='custom', typography_font_family='peyda')
    return widget('heading', title, classes, **settings)


def button(title, label, url, classes, external=False):
    return widget('button', title, classes, text=label,
                  link={'url': url, 'is_external': external, 'nofollow': False, 'custom_attributes': ''},
                  selected_icon={'value': '', 'library': ''})


def html_widget(title, classes, markup):
    return widget('html', title, classes, html=markup)


def answer_html(question):
    chunks = []
    for block in question['answer']:
        if 'paragraph' in block:
            text = html.escape(block['paragraph'])
            if question['number'] in (8, 21):
                text = text.replace('صفحه تعرفه‌ها', '<a href="https://gilaclick.ir/price-web-services/">صفحه تعرفه‌ها</a>')
            chunks.append('<p>' + text + '</p>')
        elif 'list' in block:
            chunks.append('<ul>' + ''.join('<li>' + html.escape(text) + '</li>' for text in block['list']) + '</ul>')
        elif 'definitions' in block:
            chunks.append('<ul>' + ''.join('<li><strong dir="ltr">' + html.escape(x['term']) + ':</strong> ' + html.escape(x['description']) + '</li>' for x in block['definitions']) + '</ul>')
        elif 'links' in block:
            chunks.append('<ul>' + ''.join('<li><a href="' + html.escape(x['url'], quote=True) + '" target="_blank" rel="noopener noreferrer">' + html.escape(x['text']) + '</a></li>' for x in block['links']) + '</ul>')
        else:
            raise ValueError('Unknown answer block')
    return ''.join(chunks)


def digits(value):
    return str(value).translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))


def group_icon(kind):
    paths = {
        'products': '<path d="M4 8h16v12H4zM7 8V6a5 5 0 0 1 10 0v2M8 12h8M8 16h5"/>',
        'web': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9h18M7 7h.01M10 7h.01M8 14l-2 2 2 2M16 14l2 2-2 2M13 13l-2 6"/>',
        'seo': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7.5 12l2.3-2.4 2 1.5 2.8-3"/>',
        'support': '<path d="M4 12a8 8 0 0 1 16 0v5h-4v-6h4M4 11v6h4v-6H4M20 17c0 2-2 3-5 3h-2M10 20h3"/>',
    }
    return '<span class="gf-group-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + paths[kind] + '</svg></span>'


def make_question(question):
    n = question['number']
    return container('پرسش ' + digits(n), 'gf-item gf-n%02d gf-reveal' % n, [
        heading('متن پرسش ' + digits(n), question['question'], 'gf-question', 'h3'),
        widget('text-editor', 'پاسخ ' + digits(n), 'gf-answer', editor=answer_html(question)),
    ], tag='article')


def make_group(group):
    head = container('عنوان دسته', 'gf-group-head', [
        html_widget('نشان دسته', '', group_icon(group['id'])),
        container('عنوان و تعداد پرسش‌ها', 'gf-group-info', [
            heading('عنوان دسته', group['heading'], 'gf-group-title', 'h2'),
            heading('تعداد پرسش‌ها', digits(len(group['questions'])) + ' پرسش در این دسته', 'gf-group-meta'),
        ]),
    ])
    return container(group['heading'], 'gf-group', [head, container('پرسش‌ها و پاسخ‌ها', 'gf-items', [make_question(q) for q in group['questions']])], tag='section', element_id='gf-group-' + group['id'])


def controls_html():
    links = [('<a class="gf-tab" href="#gf-questions" data-gf-filter="all">همه سوالات</a>')]
    for group in DATA['groups']:
        links.append('<a class="gf-tab" href="#gf-group-' + group['id'] + '" data-gf-filter="' + group['id'] + '">' + html.escape(group['tab']) + '</a>')
    icon = '<svg class="gf-search-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>'
    return ('<div class="gf-wrap gf-controls-inner"><nav class="gf-tabs" aria-label="دسته‌بندی پرسش‌ها">' + ''.join(links) + '</nav>'
            '<form class="gf-search" role="search" aria-label="جست‌وجو در پرسش‌ها">' + icon +
            '<label class="gf-sr-only" for="gf-search-input">جست‌وجو در پرسش‌ها و پاسخ‌ها</label>'
            '<input id="gf-search-input" type="search" data-gf-search autocomplete="off" placeholder="جست‌وجو در پرسش‌ها...">'
            '<button class="gf-search-clear" type="button" data-gf-clear data-gf-search-clear aria-label="پاک‌کردن جست‌وجو" hidden>×</button></form></div>')


def aside_html():
    links = ''.join('<a href="#gf-group-' + group['id'] + '" data-gf-filter="' + group['id'] + '">' + html.escape(group['tab']) + '<span>' + digits(len(group['questions'])) + '</span></a>' for group in DATA['groups'])
    return ('<div class="gf-aside-top"><span>مسیرهای پرسش</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></div>'
            '<p>برای یافتن پاسخ، موضوع موردنظرتان را انتخاب کنید.</p><nav class="gf-aside-list" aria-label="مسیرهای پرسش">' + links + '</nav>'
            '<div class="gf-aside-bottom">پاسخ دیگری می‌خواهید؟<br><a href="https://gilaclick.ir/contact-us/">تماس با ما ←</a></div>')


questions = [q for group in DATA['groups'] for q in group['questions']]
if [q['number'] for q in questions] != list(range(1, 25)):
    raise ValueError('The FAQ must retain the 24 questions in their original order')

source_children = ABOUT_JSON['content'][0]['elements']
clone_skip = copy.deepcopy(next(e for e in source_children if e['settings'].get('_title') == 'رفتن به محتوای اصلی'))
clone_header = copy.deepcopy(next(e for e in source_children if e['settings'].get('_title') == 'سربرگ'))
clone_footer = copy.deepcopy(next(e for e in source_children if e['settings'].get('_title') == 'پاورقی'))


def remove_about_current(element):
    settings = element.get('settings', {})
    settings['_css_classes'] = ' '.join(x for x in settings.get('_css_classes', '').split() if x != 'ga-nav-current')
    if settings.get('link', {}).get('custom_attributes') == 'aria-current|page':
        settings['link']['custom_attributes'] = ''
    for child in element.get('elements', []):
        remove_about_current(child)


remove_about_current(clone_header)

early = """<script>
(function(){var s=document.currentScript,r=s&&s.closest('.gf-page');if(!r||document.body.classList.contains('elementor-editor-active')||/[?&]elementor-preview=/.test(location.search))return;r.classList.add('gf-prejs');setTimeout(function(){if(!r.classList.contains('gf-js'))r.classList.remove('gf-prejs')},3500);}());
</script>"""
style = html_widget('⚙️ استایل صفحه — حذف نشود', 'gf-system', '<style>\n' + CSS + '\n</style>' + early)

hero = container('معرفی صفحه پرسش‌ها', 'gf-hero gf-zone gf-dark', [
    container('چیدمان معرفی', 'gf-wrap gf-hero-layout', [
        container('متن و دکمه‌های معرفی', 'gf-hero-copy', [
            heading('عنوان کوچک', DATA['title'], 'gf-eyebrow'),
            heading('عنوان اصلی', 'پاسخ پرسش‌های شما، <em>اینجاست</em>', 'gf-hero-title', 'h1', register_font=True),
            heading('زیرعنوان معرفی', DATA['hero_subtitle'], 'gf-hero-lead'),
            container('دکمه‌های معرفی', 'gf-actions gf-hero-actions', [
                button('رفتن به پرسش‌ها', 'مشاهده پرسش‌ها', '#gf-questions', 'gf-button'),
                button('ارتباط با ما', 'تماس با ما', 'https://gilaclick.ir/contact-us/', 'gf-button gf-button-outline'),
            ]),
            heading('راهنمای دسته‌بندی', 'محصولات دیجیتال، توسعه وب، سئو و پشتیبانی', 'gf-hero-note'),
        ]),
        html_widget('مدار پرسش‌ها — گرافیک', 'gf-hero-art', HERO_SVG + '<div class="gf-hero-badge"><strong>۲۴</strong><span>پرسش و پاسخ<br>در چهار مسیر</span></div>'),
    ]),
    html_widget('نوار معرفی — تزئینی', '', '<div class="gf-hero-bottom"><p><span>از پرسش تا پاسخ، یک مسیر روشن</span><b>راهنمای گیلاکلیک</b></p></div>'),
], tag='section')

sticky = container('دسته‌بندی و جست‌وجو', 'gf-controls', [html_widget('دسته‌ها و جست‌وجوی زنده', '', controls_html())])
intro = container('درباره پرسش‌های متداول', 'gf-intro gf-zone', [
    container('معرفی پرسش‌ها', 'gf-wrap gf-intro-layout', [
        container('متن معرفی', 'gf-intro-copy gf-reveal', [
            heading('عنوان کوچک', 'راهنمای پرسش‌ها', 'gf-kicker'),
            heading('عنوان معرفی', DATA['intro_heading'], 'gf-intro-title', 'h2'),
            heading('متن معرفی', DATA['intro'], 'gf-intro-text'),
        ]),
        html_widget('نمای کلی پرسش‌ها', 'gf-reveal', '<div class="gf-intro-mark"><small>برای هر مرحله از مسیر دیجیتال</small><strong>۲۴ پرسش، ۴ دسته</strong><span>از خرید محصول تا توسعه و پشتیبانی</span></div>'),
    ]),
], tag='section')

results_html = ('<p class="gf-results" data-gf-results role="status" aria-live="polite">۲۴ پرسش</p>'
                '<div class="gf-empty" data-gf-empty hidden><strong>پرسشی پیدا نشد.</strong><span>عبارت دیگری را جست‌وجو کنید یا دسته دیگری را انتخاب کنید.</span>'
                '<br><button type="button" data-gf-clear>پاک‌کردن جست‌وجو</button></div>'
                '<script type="application/ld+json" data-gf-schema></script>')
directory = container('پرسش‌ها و پاسخ‌ها', 'gf-directory', [
    container('چیدمان پرسش‌ها', 'gf-wrap gf-directory-layout', [
        html_widget('راهنمای دسته‌ها', 'gf-aside', aside_html()),
        container('فهرست پرسش‌ها', 'gf-content', [html_widget('وضعیت نتیجه', '', results_html)] + [make_group(g) for g in DATA['groups']]),
    ]),
], tag='section', element_id='gf-questions')

related = container('پیوندهای مرتبط', 'gf-related', [
    container('چیدمان پیوندها', 'gf-wrap gf-related-layout', [
        container('معرفی پیوندها', 'gf-related-copy gf-reveal', [
            heading('عنوان کوچک', 'مسیرهای مرتبط', 'gf-kicker'),
            heading('عنوان پیوندها', 'بیشتر با گیلاکلیک آشنا شوید', 'gf-related-title', 'h2'),
            heading('متن پیوندها', 'برای بررسی جزئیات بیشتر، مسیر موردنظر خود را انتخاب کنید.', 'gf-related-text'),
        ]),
        container('پیوندهای واقعی سایت', 'gf-related-links gf-reveal', [
            button('فروشگاه', 'فروشگاه محصولات', 'https://gilaclick.ir/shop/', 'gf-related-link'),
            button('تعرفه‌ها', 'خدمات و تعرفه‌ها', 'https://gilaclick.ir/price-web-services/', 'gf-related-link'),
            button('خدمات', 'صفحه خدمات', 'https://gilaclick.ir/service/', 'gf-related-link'),
            button('درباره ما', 'درباره گیلاکلیک', 'https://gilaclick.ir/about-us/', 'gf-related-link'),
            button('تماس با ما', 'تماس با ما', 'https://gilaclick.ir/contact-us/', 'gf-related-link'),
        ]),
    ]),
], tag='section')

final = container('ارتباط پایانی', 'gf-final gf-dark gf-zone', [
    container('چیدمان ارتباط پایانی', 'gf-wrap gf-final-layout', [
        container('متن ارتباط پایانی', 'gf-final-copy gf-reveal', [
            heading('عنوان کوچک', 'گفت‌وگو با گیلاکلیک', 'gf-eyebrow'),
            heading('عنوان ارتباط', DATA['cta_heading'], 'gf-final-title', 'h2'),
            heading('متن ارتباط', DATA['cta_text'], 'gf-final-text'),
            container('دکمه‌های ارتباط', 'gf-actions gf-final-actions', [
                button('تلگرام', 'ارتباط در تلگرام', 'https://t.me/mdjavad01', 'gf-button', external=True),
                button('واتساپ', 'ارتباط در واتساپ', 'https://wa.me/989389659910', 'gf-button gf-button-outline', external=True),
            ]),
            heading('عبارت پایانی', DATA['closing'], 'gf-final-sign'),
        ]),
        html_widget('مدار ارتباط — گرافیک', 'gf-cta-art', CTA_SVG),
    ]),
], tag='section')

main = container('محتوای صفحه', 'ga-main', [hero, sticky, intro, directory, related, final], tag='main', element_id='ga-main')
runtime = html_widget('⚙️ رفتار، جست‌وجو و حرکت — حذف نشود', 'gf-system', '<script>\n' + JS + '\n</script>')
root = container('صفحه پرسش‌های متداول گیلاکلیک', 'gf-page', [style, clone_skip, clone_header, main, clone_footer, runtime])
template = {'version': '0.4', 'title': 'پرسش‌های متداول گیلاکلیک', 'type': 'page', 'page_settings': {}, 'content': [root]}


def render(el):
    s = el['settings']
    classes = s.get('css_classes', '') or s.get('_css_classes', '')
    if el['elType'] == 'container':
        tag = s.get('html_tag', 'div')
        ident = ' id="' + html.escape(s['_element_id'], quote=True) + '"' if s.get('_element_id') else ''
        return '<' + tag + ' class="e-con e-con-full ' + html.escape(classes, quote=True) + '"' + ident + '>' + ''.join(render(e) for e in el.get('elements', [])) + '</' + tag + '>\n'
    kind = el['widgetType']
    if kind == 'html':
        inner = s['html']
    elif kind == 'heading':
        tag = s.get('header_size', 'h2')
        inner = '<' + tag + ' class="elementor-heading-title">' + s['title'] + '</' + tag + '>'
    elif kind == 'text-editor':
        inner = s['editor']
    elif kind == 'button':
        link = s.get('link', {})
        url = html.escape(link.get('url', ''), quote=True)
        target = ' target="_blank" rel="noopener noreferrer"' if link.get('is_external') else ''
        inner = '<a class="elementor-button elementor-button-link" href="' + url + '"' + target + '><span class="elementor-button-content-wrapper"><span class="elementor-button-text">' + html.escape(s.get('text', '')) + '</span></span></a>'
    else:
        raise ValueError('Unsupported standalone widget: ' + kind)
    return '<div class="elementor-widget elementor-widget-' + kind + ' ' + html.escape(classes, quote=True) + '"><div class="elementor-widget-container">' + inner + '</div></div>\n'


# Copy the already-approved static header/footer (including their inline icons).
header_match = re.search(r'<header class="e-con e-con-full ga-header">.*?</header>', ABOUT_HTML, re.S)
footer_match = re.search(r'<footer class="e-con e-con-full ga-footer ga-dark">.*?</footer>', ABOUT_HTML, re.S)
if not header_match or not footer_match:
    raise RuntimeError('Could not locate the existing About header/footer')
static_header = header_match.group().replace(' ga-nav-current', '').replace(' aria-current="page"', '')
static_footer = footer_match.group()
meta_description = 'پاسخ پرسش‌های متداول درباره خرید محصولات دیجیتال، طراحی و توسعه سایت، سئو، پشتیبانی و برنامه‌نویسی اختصاصی گیلاکلیک.'
head = '''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سوالات متداول گیلاکلیک | محصولات، طراحی سایت و سئو</title>
<meta name="description" content="''' + meta_description + '''">
<link rel="canonical" href="https://gilaclick.ir/faq/">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="سوالات متداول گیلاکلیک | محصولات، طراحی سایت و سئو">
<meta property="og:description" content="''' + meta_description + '''">
<meta property="og:url" content="https://gilaclick.ir/faq/">
</head>
<body style="margin:0">
<div class="e-con e-con-full gf-page">
'''
standalone = head + render(style) + render(clone_skip) + static_header + '\n' + render(main) + static_footer + '\n' + render(runtime) + '</div>\n</body>\n</html>\n'
(ROOT / 'gilaclick-faq.html').write_text(standalone, encoding='utf-8')
(ROOT / 'gilaclick-faq-elementor.json').write_text(json.dumps(template, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Built FAQ: 4 categories,', len(questions), 'questions; HTML and Elementor template')
