#!/usr/bin/env python3
"""Build a product-specific Elementor template and a dated standalone preview.

The export is a Single Product document, not a generic store template. It must
be assigned only to product 5289 in Elementor's display conditions. The live
commerce widgets use WooCommerce's current product, form, tabs and related data.
"""
from __future__ import annotations

import base64
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'assets/data/hami-cfp-fa.json').read_text(encoding='utf-8'))
SAMPLE = json.loads((ROOT / 'assets/data/product-preview-fa.json').read_text(encoding='utf-8'))
CSS = (ROOT / 'assets/css/hami-cfp.css').read_text(encoding='utf-8')
JS = (ROOT / 'assets/js/hami-cfp.js').read_text(encoding='utf-8')
EDITOR_JS = (ROOT / 'assets/js/product-editor-compat.js').read_text(encoding='utf-8')
ABOUT = (ROOT / 'gilaclick-about.html').read_text(encoding='utf-8')
HEADER_CSS = (ROOT / 'assets/css/product-header-preview.css').read_text(encoding='utf-8').replace('.gpd-page', '.hcf-preview-frame').replace('.gpd-js', '.hcf-preview-js')

if '</script' in (JS + EDITOR_JS).lower() or '</style' in (CSS + HEADER_CSS).lower():
    raise ValueError('Unexpected closing tag in embedded assets')


def esc(text):
    return html.escape(str(text), quote=True)


def data_image(name):
    return 'data:image/webp;base64,' + base64.b64encode((ROOT / 'assets/img' / name).read_bytes()).decode('ascii')


COVER = data_image('product-preview-cover.webp')
SHOT = data_image('product-preview-dashboard.webp')
PLACEHOLDER = 'data:image/svg+xml;base64,' + base64.b64encode('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500"><rect width="750" height="500" fill="#1c2825"/><circle cx="375" cy="215" r="70" fill="none" stroke="#3c7560" stroke-width="2"/><path d="M345 215h60M375 185v60" stroke="#75bd94" stroke-width="2"/><text x="375" y="330" text-anchor="middle" font-family="Tahoma,sans-serif" font-size="22" fill="#b4c9bd">تصویر محصول در فروشگاه</text></svg>'''.encode()).decode('ascii')

counter = 1


def next_id():
    global counter
    result = f'c{counter:06x}'
    counter += 1
    return result


def container(title, classes, elements, tag='div', element_id=None):
    settings = {'content_width': 'full', 'css_classes': classes, '_title': title, 'html_tag': tag}
    if element_id:
        settings['_element_id'] = element_id
    return {'id': next_id(), 'elType': 'container', 'isInner': True, 'isLocked': False, 'settings': settings, 'elements': elements}


def widget(kind, editor_title, classes='', **settings):
    values = {'_css_classes': classes, '_title': editor_title}
    values.update(settings)
    return {'id': next_id(), 'elType': 'widget', 'widgetType': kind, 'isInner': True, 'isLocked': False, 'settings': values, 'elements': []}


def heading(title, text, classes='', tag='p', font=False):
    params = {'title': text, 'header_size': tag}
    if font:
        params.update(typography_typography='custom', typography_font_family='peyda')
    return widget('heading', title, classes, **params)


def rich(title, markup, classes=''):
    return widget('text-editor', title, classes, editor=markup)


def button(title, label, url, classes):
    return widget('button', title, classes, text=label,
                  link={'url': url, 'is_external': False, 'nofollow': False, 'custom_attributes': ''},
                  selected_icon={'value': '', 'library': ''})


def raw(title, markup, classes=''):
    return widget('html', title, classes, html=markup)


ICONS = {
    'chat': '<path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 12.5h5"/>',
    'grid': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9M14 13h3M14 16h3"/>',
    'adjust': '<path d="M5 7h14M5 17h14M9 4v6M15 14v6"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    'route': '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a4 4 0 0 1 0 8H9a3 3 0 0 0-3 3v1h11"/>',
    'shield': '<path d="m12 3 7 3v5c0 4.8-2.9 7.9-7 10-4.1-2.1-7-5.2-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
}


def icon(key):
    return '<span class="hcf-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[key] + '</svg></span>'


def feature(item, i):
    children = [raw('نشان قابلیت', icon(item['icon'])),
                heading('عنوان قابلیت', esc(item['title']), 'hcf-feature-title', 'h3'),
                rich('توضیح قابلیت', '<p>' + esc(item['text']) + '</p>', 'hcf-feature-text')]
    if item.get('note'):
        children.append(heading('مسیرهای ارتباطی', esc(item['note']), 'hcf-feature-note'))
    return container(item['title'], 'hcf-feature hcf-feature-' + str(i) + ' hcf-reveal', children, tag='article')


def step(item, i):
    num = str(i).translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))
    return container('مرحله ' + num, 'hcf-step hcf-reveal', [
        heading('شماره مرحله', '۰' + num, 'hcf-step-number'),
        container('محتوای مرحله', 'hcf-step-copy', [
            heading('عنوان مرحله', esc(item['title']), 'hcf-step-title', 'h3'),
            rich('توضیح مرحله', '<p>' + esc(item['text']) + '</p>', 'hcf-step-text'),
        ]),
    ], tag='article')


def faq(item, i):
    return container('پرسش ' + str(i), 'hcf-faq-item', [
        heading('پرسش', esc(item['question']), 'hcf-faq-question', 'h3'),
        rich('پاسخ', '<p>' + esc(item['answer']) + '</p>', 'hcf-faq-answer'),
    ], tag='article')


def quick(label, text):
    return container(label, 'hcf-quick-item', [heading('عنوان', label, 'hcf-quick-label'), heading('مقدار', text, 'hcf-quick-value')])


def spec(label, text):
    return container(label, 'hcf-spec-row', [heading('عنوان مشخصات', label, 'hcf-spec-label'), heading('مقدار مشخصات', text, 'hcf-spec-value')])


style = raw('⚙️ استایل و سازگاری ویرایشگر — حذف نشود', '<style>\n' + CSS + '\n</style><script>\n' + EDITOR_JS + '\n</script>', 'hcf-system')

hero = container('معرفی افزونه حامی', 'hcf-hero', [
    container('چیدمان معرفی', 'hcf-wrap hcf-hero-layout', [
        container('معرفی و مسیر خرید', 'hcf-hero-copy', [
            heading('برچسب معرفی', 'راهکار فروشگاهی حامی <span> / </span> افزونه ووکامرس', 'hcf-eyebrow'),
            widget('woocommerce-product-meta', 'دسته و شناسه محصول ووکامرس', 'hcf-hero-meta', category_caption_single='دسته:', category_caption_plural='دسته‌ها:'),
            heading('عنوان اصلی', 'افزونه تماس برای قیمت <em>حامی</em>', 'hcf-hero-title', 'h1', font=True),
            heading('زیرعنوان', esc(DATA['hero_subtitle']), 'hcf-hero-subtitle'),
            rich('توضیح معرفی', '<p>' + esc(DATA['hero_description']) + '</p>', 'hcf-hero-description'),
            container('مزیت‌های کوتاه', 'hcf-hero-benefits', [
                heading('مزیت اول', 'استعلام در مسیر دلخواه', 'hcf-benefit'),
                heading('مزیت دوم', 'مدیریت گروهی قیمت', 'hcf-benefit'),
                heading('مزیت سوم', 'پیش‌نمایش و بازگردانی', 'hcf-benefit'),
            ]),
            container('دکمه‌های معرفی', 'hcf-actions', [
                button('رفتن به خرید', 'خرید افزونه', '#hcf-buy', 'hcf-button hcf-primary'),
                button('رفتن به امکانات', 'آشنایی با امکانات', '#hcf-features', 'hcf-button hcf-secondary'),
            ]),
            heading('توضیح خرید', 'قیمت و خرید افزونه از فروشگاه ووکامرس گیلاکلیک', 'hcf-hero-caption'),
        ]),
        container('تصاویر واقعی محصول', 'hcf-hero-visual', [
            raw('مدار تزئینی', '<div class="hcf-orbit hcf-orbit-a" aria-hidden="true"><i></i></div><div class="hcf-orbit hcf-orbit-b" aria-hidden="true"><i></i></div>'),
            container('قاب تصویر محصول', 'hcf-stage', [
                raw('سربرگ قاب تصویر', '<div class="hcf-stage-top"><span>تصویر محصول</span><span dir="ltr">HAMI / CALL FOR PRICE</span><i aria-hidden="true"></i></div>'),
                container('گالری ووکامرس', 'hcf-woo-gallery', [
                    widget('woocommerce-product-images', 'تصاویر واقعی محصول ووکامرس', 'hcf-images'),
                    raw('بزرگ‌نمایی تصویر', '<button class="hcf-zoom" type="button" hidden><span aria-hidden="true">＋</span> بزرگ‌نمایی</button>'),
                ]),
                raw('توضیح تصویر', '<div class="hcf-stage-bottom"><span>حامی، برای فروشگاه‌های ووکامرسی</span><span>تصاویر محصول</span></div>'),
            ]),
        ]),
    ]),
], tag='section')

quickbar = container('اطلاعات سریع محصول', 'hcf-wrap hcf-quick', [
    quick('نوع محصول', 'افزونه وردپرس'), quick('وردپرس', '۵.۸ و بالاتر'),
    quick('PHP', '۷.۴ و بالاتر'), quick('ووکامرس', '۵.۰ و بالاتر'),
    rich('منبع مشخصات فنی', '<p>حداقل نسخه‌ها طبق <a href="' + esc(DATA['source_technical']) + '">معرفی فنی حامی</a>؛ سازگاری نسخه فعلی را پیش از نصب بررسی کنید.</p>', 'hcf-quick-source'),
])

features = container('معرفی و امکانات', 'hcf-section hcf-features', [
    heading('برچسب بخش امکانات', 'برای قیمت‌هایی که ثابت نمی‌مانند', 'hcf-kicker'),
    heading('عنوان معرفی', esc(DATA['intro_title']), 'hcf-section-title', 'h2'),
    rich('متن معرفی', '<p>' + esc(DATA['intro_text']) + '</p>', 'hcf-section-lead'),
    container('قابلیت‌های افزونه', 'hcf-feature-grid', [feature(item, i) for i, item in enumerate(DATA['features'], 1)]),
], tag='section', element_id='hcf-features')

process = container('نحوه عملکرد', 'hcf-section hcf-process', [
    heading('برچسب نحوه عملکرد', 'مسیر استعلام', 'hcf-kicker'),
    heading('عنوان نحوه عملکرد', 'از انتخاب محصول تا گفت‌وگو با مشتری', 'hcf-section-title', 'h2'),
    rich('توضیح نحوه عملکرد', '<p>مسیر ارتباط را مشخص کنید تا مشتری بداند برای دریافت قیمت از کجا شروع کند.</p>', 'hcf-section-lead'),
    container('مراحل عملکرد', 'hcf-steps', [step(item, i) for i, item in enumerate(DATA['steps'], 1)]),
], tag='section', element_id='hcf-how')

# A Text Editor widget keeps the real media editable while retaining explicit lazy
# loading and a descriptive link even when the source media has an empty alt field.
shot_medium = SAMPLE['screenshot'].replace('.webp', '-768x514.webp')
shot_markup = ('<a href="' + esc(SAMPLE['screenshot']) + '" aria-label="بزرگ‌نمایی تصویر تنظیمات حامی" data-elementor-open-lightbox="no">'
               '<img src="' + esc(SAMPLE['screenshot']) + '" srcset="' + esc(shot_medium) + ' 768w, ' + esc(SAMPLE['screenshot']) + ' 1000w" '
               'sizes="(max-width: 760px) 90vw, 800px" alt="' + esc(SAMPLE['screenshot_alt']) + '" width="1000" height="669" loading="lazy" decoding="async"></a>')
capture = container('پیش‌نمایش محیط افزونه', 'hcf-section hcf-capture', [
    heading('برچسب گالری', 'نگاهی نزدیک‌تر', 'hcf-kicker'),
    heading('عنوان گالری', 'تنظیمات حامی، در یک نگاه', 'hcf-section-title', 'h2'),
    rich('توضیح گالری', '<p>نمای واقعی بخش تنظیم روش استعلام در پیشخوان افزونه. برای مشاهده جزئیات، تصویر را بزرگ کنید.</p>', 'hcf-section-lead'),
    container('تصویر تنظیمات واقعی افزونه', 'hcf-screen hcf-reveal', [
        raw('نوار قاب تصویر', '<div class="hcf-screen-top"><span>پیش‌نمایش تنظیمات</span><span dir="ltr">HAMI / SETTINGS</span><i aria-hidden="true"></i></div>'),
        rich('تصویر واقعی تنظیمات؛ قابل ویرایش در المنتور', shot_markup, 'hcf-capture-image'),
        heading('راهنمای تصویر', 'تنظیم مسیر استعلام و پیش‌نمایش دکمه', 'hcf-screen-caption'),
    ]),
], tag='section', element_id='hcf-gallery')

comparison_html = '''<table><thead><tr><th scope="col">کار</th><th scope="col">روش معمول فروشگاه</th><th scope="col">با افزونه حامی</th></tr></thead><tbody>
<tr><td data-label="کار">مسیر استعلام</td><td data-label="روش معمول">وابسته به ابزار و روش ارتباطی تعریف‌شده</td><td data-label="با حامی">انتخاب تماس یا پیام‌رسان برای دکمه استعلام</td></tr>
<tr><td data-label="کار">ویرایش قیمت</td><td data-label="روش معمول">ویرایش در بخش محصولات ووکامرس</td><td data-label="با حامی">جدول یکپارچه قیمت‌ها در پیشخوان</td></tr>
<tr><td data-label="کار">تغییر گروهی</td><td data-label="روش معمول">وابسته به ابزارهای در دسترس فروشگاه</td><td data-label="با حامی">تغییر درصدی دسته با پیش‌نمایش و بازگردانی</td></tr>
<tr><td data-label="کار">خرید محصولات استعلامی</td><td data-label="روش معمول">وابسته به تنظیمات محصول و فروشگاه</td><td data-label="با حامی">بستن خرید معمول برای محصولات انتخاب‌شده</td></tr>
</tbody></table>'''
comparison = container('مقایسه روش‌ها', 'hcf-section hcf-comparison', [
    heading('برچسب مقایسه', 'یک تصویر روشن', 'hcf-kicker'),
    heading('عنوان مقایسه', 'چه چیزی ساده‌تر می‌شود؟', 'hcf-section-title', 'h2'),
    rich('توضیح مقایسه', '<p>روش معمول هر فروشگاه به تنظیمات و ابزارهای آن بستگی دارد؛ این جدول مسیرهایی را که حامی برای این کارها فراهم می‌کند نشان می‌دهد.</p>', 'hcf-section-lead'),
    rich('جدول مقایسه قابل ویرایش', comparison_html, 'hcf-table'),
], tag='section', element_id='hcf-compare')

specs = container('مشخصات فنی', 'hcf-section hcf-specs', [
    heading('برچسب مشخصات', 'پیش از نصب', 'hcf-kicker'),
    heading('عنوان مشخصات', 'مشخصات فنی محصول', 'hcf-section-title', 'h2'),
    container('مشخصات تأییدشده', 'hcf-spec-list', [
        spec('نام محصول', 'افزونه تماس برای قیمت حامی'), spec('نوع محصول', 'افزونه وردپرس و ووکامرس'),
        spec('حداقل وردپرس', '۵.۸'), spec('حداقل PHP', '۷.۴'), spec('ووکامرس', '۵.۰ و بالاتر'),
    ]),
    widget('woocommerce-product-additional-information', 'ویژگی‌های واقعی ووکامرس، در صورت وجود', 'hcf-additional'),
    rich('منبع و شرایط فنی', '<p>حداقل نسخه‌ها بر اساس <a href="' + esc(DATA['source_technical']) + '">صفحه معرفی فنی حامی</a> هستند. نسخه فعلی افزونه و شرایط لایسنس در داده عمومی محصول ثبت نشده‌اند؛ پیش از خرید یا نصب با <a href="https://gilaclick.ir/contact-us/">گیلاکلیک</a> بررسی کنید.</p>', 'hcf-spec-note'),
], tag='section', element_id='hcf-specs')

faq_section = container('سوالات متداول محصول', 'hcf-section hcf-faq', [
    heading('برچسب پرسش‌ها', 'پیش از خرید', 'hcf-kicker'),
    heading('عنوان پرسش‌ها', 'پرسش‌هایی که ممکن است داشته باشید', 'hcf-section-title', 'h2'),
    container('فهرست پرسش‌ها', 'hcf-faq-list', [faq(item, i) for i, item in enumerate(DATA['faq'], 1)]),
], tag='section', element_id='hcf-faq')

reviews = container('دیدگاه‌ها و اطلاعات اصلی ووکامرس', 'hcf-wrap hcf-section hcf-reviews', [
    heading('برچسب دیدگاه‌ها', 'تجربه و جزئیات', 'hcf-kicker'),
    heading('عنوان دیدگاه‌ها', 'دیدگاه‌ها و اطلاعات محصول', 'hcf-section-title', 'h2'),
    rich('راهنمای دیدگاه‌ها', '<p>دیدگاه‌ها، امتیازها و فرم ثبت نظر بر اساس تنظیمات واقعی فروشگاه نمایش داده می‌شوند.</p>', 'hcf-section-lead'),
    widget('woocommerce-product-data-tabs', 'تب‌ها، توضیحات کامل و دیدگاه‌های واقعی ووکامرس', 'hcf-tabs'),
], tag='section', element_id='hcf-reviews')

purchase = container('باکس خرید واقعی ووکامرس', 'hcf-aside', [
    container('قیمت و فرم خرید', 'hcf-buy', [
        raw('عنوان خرید', '<div class="hcf-buy-top"><span class="hcf-buy-icon" aria-hidden="true">↗</span><span>تهیه افزونه</span><i></i></div>'),
        heading('نام افزونه در باکس خرید', 'افزونه تماس برای قیمت حامی', 'hcf-buy-title', 'h2'),
        heading('برچسب قیمت', 'قیمت محصول', 'hcf-price-label'),
        widget('woocommerce-product-price', 'قیمت واقعی و تخفیف ووکامرس', 'hcf-price'),
        widget('woocommerce-product-stock', 'موجودی واقعی ووکامرس', 'hcf-stock'),
        widget('woocommerce-notices', 'پیام‌های واقعی ووکامرس', 'hcf-notices'),
        # Elementor's native Custom Add To Cart widget uses the real Woo form
        # with show_quantity=yes; scoped CSS hides only the quantity control.
        # Its editable text is rendered server-side, including without JS.
        # Inactive element cache keeps stock and purchase eligibility live.
        widget('wc-add-to-cart', 'فرم خرید واقعی ووکامرس', 'hcf-add',
               text='خرید افزونه', show_quantity='yes', quantity=1, layout='',
               selected_icon={'value': '', 'library': ''}, _element_cache='yes'),
        rich('راهنمای دریافت و پشتیبانی', '<p>برای جزئیات دریافت، پشتیبانی و به‌روزرسانی <a href="https://gilaclick.ir/contact-us/">با گیلاکلیک در تماس باشید</a>.</p>', 'hcf-buy-help'),
    ], element_id='hcf-buy'),
], tag='aside')
purchase['settings']['_attributes'] = 'aria-label|تهیه افزونه'

layout = container('محتوا و خرید', 'hcf-wrap hcf-layout', [
    container('محتوای اختصاصی محصول', 'hcf-content', [features, process, capture, comparison, specs, faq_section]),
    purchase,
])

related = container('محصولات مرتبط ووکامرس', 'hcf-wrap hcf-related hcf-section', [
    heading('برچسب محصولات مرتبط', 'بیشتر در فروشگاه', 'hcf-kicker'),
    heading('عنوان محصولات مرتبط', 'محصولات مرتبط', 'hcf-section-title', 'h2'),
    widget('woocommerce-product-related', 'محصولات مرتبط واقعی ووکامرس', 'hcf-related-products', posts_per_page=4, columns=4),
], tag='section', element_id='hcf-related')

final = container('دعوت پایانی به خرید', 'hcf-final', [
    container('چیدمان دعوت پایانی', 'hcf-wrap hcf-final-inner', [
        container('متن دعوت پایانی', 'hcf-final-copy hcf-reveal', [
            heading('برچسب دعوت', 'یک مسیر روشن برای استعلام', 'hcf-eyebrow'),
            heading('عنوان دعوت', esc(DATA['final_title']), 'hcf-final-title', 'h2'),
            rich('متن دعوت', '<p>' + esc(DATA['final_text']) + '</p>', 'hcf-final-text'),
            button('خرید افزونه', 'خرید افزونه', '#hcf-buy', 'hcf-button hcf-primary'),
        ]),
        raw('مدار پایانی تزئینی', '<div class="hcf-final-orbit" aria-hidden="true"><i></i><b></b><span></span></div>'),
    ]),
], tag='section')

lightbox = raw('بزرگ‌نمایی تصاویر', '<dialog class="hcf-lightbox" aria-label="بزرگ‌نمایی تصاویر محصول"><div class="hcf-lightbox-bar"><span>تصاویر محصول</span><button type="button" data-hcf-close aria-label="بستن بزرگ‌نمایی">بستن ×</button></div><img alt=""><div class="hcf-lightbox-controls"><button type="button" data-hcf-prev>تصویر قبلی</button><button type="button" data-hcf-next>تصویر بعدی</button></div></dialog>')
main = container('محتوای لندینگ اختصاصی', 'hcf-main', [hero, quickbar, layout, related, reviews, final, lightbox], element_id='hcf-main')
runtime = raw('⚙️ تعامل، گالری و حرکت — حذف نشود', '<script>\n' + JS + '\n</script>', 'hcf-system')
root = container('لندینگ اختصاصی حامی — فقط محصول تماس برای قیمت', 'hcf-page', [style, main, runtime])
template = {'version': '0.4', 'title': 'لندینگ اختصاصی افزونه تماس برای قیمت حامی', 'type': 'product', 'page_settings': {}, 'content': [root]}


def render(el):
    settings = el['settings']
    classes = settings.get('css_classes', '') or settings.get('_css_classes', '')
    if el['elType'] == 'container':
        tag = 'main' if 'hcf-main' in classes.split() else settings.get('html_tag', 'div')
        ident = ' id="' + esc(settings['_element_id']) + '"' if settings.get('_element_id') else ''
        extra = ' aria-label="تهیه افزونه"' if 'hcf-aside' in classes.split() else ''
        return '<' + tag + ' class="e-con e-con-full ' + esc(classes) + '"' + ident + extra + '>' + ''.join(render(child) for child in el.get('elements', [])) + '</' + tag + '>\n'
    kind = el['widgetType']
    if kind == 'html':
        inner = settings['html']
    elif kind == 'heading':
        tag = settings.get('header_size', 'h2')
        inner = '<' + tag + ' class="elementor-heading-title">' + settings.get('title', '') + '</' + tag + '>'
    elif kind == 'text-editor':
        inner = settings.get('editor', '')
        if 'hcf-capture-image' in classes.split():
            inner = '<a href="' + esc(SAMPLE['screenshot']) + '" aria-label="بزرگ‌نمایی تصویر تنظیمات حامی" data-elementor-open-lightbox="no"><img src="' + SHOT + '" data-hcf-original="' + esc(SAMPLE['screenshot']) + '" alt="' + esc(SAMPLE['screenshot_alt']) + '" width="1000" height="669" loading="lazy" decoding="async"></a>'
    elif kind == 'button':
        inner = '<a class="elementor-button elementor-button-link" href="' + esc(settings['link']['url']) + '"><span class="elementor-button-content-wrapper"><span class="elementor-button-text">' + esc(settings['text']) + '</span></span></a>'
    elif kind == 'woocommerce-product-images':
        inner = '<div class="woocommerce-product-gallery"><div class="woocommerce-product-gallery__wrapper"><div class="woocommerce-product-gallery__image"><a href="' + esc(SAMPLE['cover']) + '"><img src="' + COVER + '" data-hcf-original="' + esc(SAMPLE['cover']) + '" alt="' + esc(SAMPLE['cover_alt']) + '" width="750" height="500" fetchpriority="high"></a></div></div></div>'
    elif kind == 'woocommerce-product-meta':
        inner = '<div class="product_meta"><span class="posted_in">دسته: <a href="' + esc(SAMPLE['category_url']) + '">' + esc(SAMPLE['category']) + '</a></span></div>'
    elif kind == 'woocommerce-product-price':
        inner = '<p class="price"><span class="woocommerce-Price-amount amount"><bdi>' + esc(SAMPLE['price']) + ' <span class="woocommerce-Price-currencySymbol">' + esc(SAMPLE['currency']) + '</span></bdi></span></p><p class="hcf-snapshot">پیش‌نمایش بر پایه اطلاعات فروشگاه در ' + esc(DATA['observed_on_fa']) + '؛ قیمت نهایی در فروشگاه بررسی می‌شود.</p>'
    elif kind == 'woocommerce-product-stock':
        inner = '<p class="stock in-stock">موجود</p>'
    elif kind == 'woocommerce-notices':
        inner = ''
    elif kind == 'wc-add-to-cart':
        inner = ('<form class="cart" action="' + esc(SAMPLE['source']) + '" method="post">'
                 '<div class="quantity"><label class="hcf-sr-only" for="hcf-sample-qty">تعداد محصول</label><input id="hcf-sample-qty" class="input-text qty text" type="number" name="quantity" value="1" min="1" step="1" inputmode="numeric"></div>'
                 '<button class="single_add_to_cart_button elementor-button button alt" type="submit" name="add-to-cart" value="' + str(SAMPLE['id']) + '"><span class="elementor-button-content-wrapper"><span class="elementor-button-text">' + esc(settings['text']) + '</span></span></button></form>')
    elif kind == 'woocommerce-product-additional-information':
        inner = ''
    elif kind == 'woocommerce-product-data-tabs':
        inner = ('<div class="woocommerce-tabs wc-tabs-wrapper"><ul class="tabs wc-tabs"><li class="reviews_tab"><a href="#tab-reviews">دیدگاه‌ها</a></li><li class="description_tab"><a href="#tab-description">توضیحات اصلی محصول</a></li></ul>'
                 '<div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--reviews" id="tab-reviews"><p>در زمان ثبت پیش‌نمایش، دیدگاهی برای این محصول ثبت نشده بود. دیدگاه‌ها و فرم ثبت نظر در صفحه واقعی محصول از ووکامرس خوانده می‌شوند.</p><p><a href="' + esc(SAMPLE['source']) + '#reviews">مشاهده و ثبت دیدگاه در فروشگاه</a></p></div>'
                 '<div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--description" id="tab-description"><p>متن کامل محصول در ووکامرس حفظ می‌شود.</p><p><a href="' + esc(SAMPLE['source']) + '">مشاهده توضیحات در فروشگاه</a></p></div></div>')
    elif kind == 'woocommerce-product-related':
        product = SAMPLE['related']
        inner = ('<section class="related products"><h2>محصولات مرتبط</h2><ul class="products"><li class="product"><a href="' + esc(product['url']) + '" class="woocommerce-LoopProduct-link"><img src="' + PLACEHOLDER + '" data-hcf-original="' + esc(product['image']) + '" alt="' + esc(product['name']) + '" loading="lazy" width="750" height="500"><h3 class="woocommerce-loop-product__title">' + esc(product['name']) + '</h3><span class="price">' + esc(product['price']) + ' ' + esc(product['currency']) + '</span></a><a class="button" href="' + esc(product['url']) + '">مشاهده محصول</a></li></ul></section>')
    else:
        raise ValueError('Unsupported preview widget: ' + kind)
    return '<div class="elementor-widget elementor-widget-' + kind + ' ' + esc(classes) + '"><div class="elementor-widget-container">' + inner + '</div></div>\n'


header_match = re.search(r'<header class="e-con e-con-full ga-header">.*?</header>', ABOUT, re.S)
footer_match = re.search(r'<footer class="e-con e-con-full ga-footer ga-dark">.*?</footer>', ABOUT, re.S)
if not header_match or not footer_match:
    raise RuntimeError('Could not locate the existing preview header/footer')
header = header_match.group().replace(' ga-nav-current', '').replace(' aria-current="page"', '')
footer = footer_match.group()
# Peyda is supplied by the site; the standalone file intentionally embeds no font.
preview_css = '''body{margin:0;background:#101318} .hcf-preview-frame{font:400 15px/1.9 peyda,Tahoma,sans-serif;direction:rtl;--gpd-admin-offset:0px}
.hcf-preview-frame .hcf-page,.hcf-preview-frame :is(h1,h2,h3,h4,h5,h6,p,a,button,input,select,textarea,label,table,.elementor-heading-title,.elementor-button){font-family:peyda,Tahoma,sans-serif!important}
.hcf-preview-frame,.hcf-preview-frame *{box-sizing:border-box}.hcf-preview-frame .ga-wrap{width:min(1240px,calc(100% - 40px));margin-inline:auto}
.hcf-preview-frame .ga-header a,.hcf-preview-frame .ga-footer a{text-decoration:none}.hcf-preview-frame .ga-footer p{margin:0}
.hcf-preview-frame .ga-primary-nav[hidden]{display:none!important}
''' + HEADER_CSS
preview_menu = '''<script>(function(){var frame=document.querySelector('.hcf-preview-frame'),nav=frame.querySelector('.ga-primary-nav'),button=frame.querySelector('.ga-menu-toggle .elementor-button'),small=matchMedia('(max-width:900px)');if(!nav||!button)return;frame.classList.add('hcf-preview-js');button.setAttribute('role','button');button.setAttribute('aria-controls',nav.id);function close(focus){if(small.matches)nav.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus()}function resize(){nav.hidden=small.matches;button.setAttribute('aria-expanded','false')}resize();button.addEventListener('click',function(e){e.preventDefault();if(!small.matches)return;nav.hidden=!nav.hidden;button.setAttribute('aria-expanded',String(!nav.hidden))});button.addEventListener('keydown',function(e){if(e.key===' '){e.preventDefault();button.click()}});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&small.matches&&!nav.hidden)close(true)});nav.addEventListener('click',function(e){if(e.target.closest('a'))close(false)});if(small.addEventListener)small.addEventListener('change',resize);else small.addListener(resize)}());</script>'''
preview = ('<!doctype html>\n<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           '<title>پیش‌نمایش افزونه تماس برای قیمت حامی | گیلاکلیک</title><meta name="robots" content="noindex,nofollow">'
           '<style>\n' + CSS + '\n' + preview_css + '\n</style></head><body><div class="hcf-preview-frame">\n' + header +
           '\n<div class="e-con e-con-full hcf-page">' + render(main) + '\n<script>\n' + JS + '\n</script></div>\n' + footer + preview_menu + '</div></body></html>\n')

(ROOT / 'gilaclick-hami-call-for-price.html').write_text(preview, encoding='utf-8')
(ROOT / 'gilaclick-hami-call-for-price-elementor.json').write_text(json.dumps(template, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Built the dedicated Hami Elementor product template and dated preview.')
