#!/usr/bin/env python3
"""Build an Elementor Single Product template and a dated standalone preview.

The template has no site header/footer and uses only WooCommerce/Elementor Pro
product widgets for product data and the actual cart form. The sample HTML is
an explicitly dated snapshot of one real product; it is not a live storefront.
"""
from __future__ import annotations

import base64
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'assets/data/product-preview-fa.json').read_text(encoding='utf-8'))
PRODUCT_CONTENT = (ROOT / 'assets/data/product-preview-content.html').read_text(encoding='utf-8')
CSS = (ROOT / 'assets/css/product.css').read_text(encoding='utf-8')
PREVIEW_HEADER_CSS = (ROOT / 'assets/css/product-header-preview.css').read_text(encoding='utf-8')
JS = (ROOT / 'assets/js/product.js').read_text(encoding='utf-8')
EDITOR_COMPAT = (ROOT / 'assets/js/product-editor-compat.js').read_text(encoding='utf-8')
ABOUT_HTML = (ROOT / 'gilaclick-about.html').read_text(encoding='utf-8')

if '</script' in (JS + EDITOR_COMPAT).lower() or '</style' in (CSS + PREVIEW_HEADER_CSS).lower():
    raise ValueError('Raw style or script contains a closing tag')


def data_image(name: str) -> str:
    raw = (ROOT / 'assets/img' / name).read_bytes()
    return 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')


def attr(value: str) -> str:
    return html.escape(value, quote=True)


def value(value: str) -> str:
    return html.escape(value, quote=False)


cover_fallback = data_image('product-preview-cover.webp')
screenshot_fallback = data_image('product-preview-dashboard.webp')
related_placeholder = 'data:image/svg+xml;base64,' + base64.b64encode('''<svg xmlns="http://www.w3.org/2000/svg" width="750" height="500" viewBox="0 0 750 500"><rect width="750" height="500" fill="#edf8f1"/><circle cx="375" cy="205" r="83" fill="none" stroke="#c3e4ce" stroke-width="2"/><circle cx="375" cy="205" r="54" fill="none" stroke="#90c9a4" stroke-width="2"/><circle cx="375" cy="151" r="7" fill="#19c58b"/><text x="375" y="340" text-anchor="middle" font-family="Tahoma,sans-serif" font-size="25" fill="#3f7658">تصویر در فروشگاه</text></svg>'''.encode('utf-8')).decode('ascii')
PRODUCT_CONTENT = (PRODUCT_CONTENT
                   .replace('__SCREENSHOT_SRC__', attr(DATA['screenshot']))
                   .replace('__SCREENSHOT_FALLBACK__', screenshot_fallback))

counter = 1


def next_id() -> str:
    global counter
    result = f'd{counter:06x}'
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


def html_widget(title, classes, markup):
    return widget('html', title, classes, html=markup)


ICON_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>'
ICON_HELP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.7 2c-.8.5-1.4 1-1.4 2.1M12 16.8h.01"/></svg>'
ICON_ZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5M10.5 7.5v6m-3-3h6"/></svg>'

style = html_widget('⚙️ استایل و سازگاری ویرایشگر محصول — حذف نشود', 'gpd-system', '<style>\n' + CSS + '\n</style><script>\n' + EDITOR_COMPAT + '\n</script>')
hero = container('معرفی و تصاویر محصول', 'gpd-hero', [
    container('دسته محصول', 'gpd-kicker', [
        html_widget('فروشگاه', '', '<span>فروشگاه گیلاکلیک</span>'),
        widget('woocommerce-product-meta', 'دسته محصول ووکامرس', 'gpd-meta', category_caption_single='دسته:', category_caption_plural='دسته‌ها:'),
    ]),
    widget('woocommerce-product-title', 'عنوان محصول ووکامرس', 'gpd-title gpd-reveal', header_size='h1', title='',
           __dynamic__={'title': '[elementor-tag id="gpdtitle" name="woocommerce-product-title-tag" settings="%7B%7D"]'}),
    container('توضیح کوتاه محصول', 'gpd-short gpd-reveal', [
        widget('woocommerce-product-short-description', 'توضیح کوتاه محصول ووکامرس', ''),
    ]),
    html_widget('ویژگی‌های برجسته از توضیحات محصول', '', '<div class="gpd-hero-chips" aria-label="امکانات محصول"></div>'),
    container('گالری محصول', 'gpd-visual gpd-reveal', [
        html_widget('عنوان تصویر', '', '<div class="gpd-visual-top"><span>تصاویر محصول</span><span class="gpd-signal" aria-hidden="true"><i></i><i></i><i></i></span></div>'),
        container('تصاویر ووکامرس', 'gpd-gallery gpd-anchor', [
            widget('woocommerce-product-images', 'تصاویر واقعی محصول', 'gpd-images'),
            html_widget('بزرگ‌نمایی تصویر', '', '<button class="gpd-zoom" type="button" hidden>' + ICON_ZOOM + '<span>بزرگ‌نمایی</span></button>'),
        ], element_id='gpd-gallery'),
    ]),
    html_widget('اطلاعات سریع از ویژگی‌های محصول', '', '<div class="gpd-quick" aria-label="اطلاعات محصول"></div>'),
], tag='section')

purchase = container('کارت خرید', 'gpd-aside', [
    container('قیمت و خرید ووکامرس', 'gpd-purchase', [
        html_widget('عنوان کارت خرید', '', '<div class="gpd-purchase-top"><strong>تهیه محصول</strong><span class="gpd-purchase-mark">' + ICON_BAG + '</span></div>'),
        html_widget('برچسب قیمت', '', '<div class="gpd-price-label">قیمت محصول</div>'),
        widget('woocommerce-product-price', 'قیمت واقعی محصول ووکامرس', 'gpd-price'),
        widget('woocommerce-product-stock', 'موجودی واقعی محصول ووکامرس', 'gpd-stock'),
        widget('woocommerce-notices', 'پیام‌های ووکامرس', 'gpd-notices'),
        widget('woocommerce-product-add-to-cart', 'فرم اصلی افزودن به سبد خرید', 'gpd-add'),
        html_widget('راهنمای خرید', '', '<div class="gpd-purchase-help">' + ICON_HELP + '<span>برای راهنمایی درباره این محصول <a href="https://gilaclick.ir/contact-us/">با ما در تماس باشید</a>.</span></div>'),
    ], element_id='gpd-purchase'),
], tag='aside')
purchase['settings']['_attributes'] = 'aria-label|تهیه محصول'

body = container('جزئیات محصول', 'gpd-body', [
    html_widget('ناوبری بخش‌های موجود', 'gpd-section-nav', '<nav aria-label="بخش‌های محصول"></nav>'),
    container('توضیحات کامل محصول', 'gpd-description gpd-anchor', [
        html_widget('معرفی محصول', '', '<div class="gpd-section-head"><span>جزئیات محصول</span></div><h2 class="gpd-description-title">درباره این محصول</h2>'),
        widget('woocommerce-product-content', 'توضیحات کامل واقعی ووکامرس', 'gpd-content'),
    ], tag='section', element_id='gpd-description'),
    container('مشخصات واقعی محصول', 'gpd-specs gpd-anchor', [
        widget('woocommerce-product-additional-information', 'مشخصات ووکامرس', ''),
    ], tag='section', element_id='gpd-specs'),
    container('دیدگاه‌ها و تب‌های افزونه‌ها', 'gpd-extras gpd-anchor', [
        html_widget('عنوان اطلاعات بیشتر', '', '<div class="gpd-section-head"><span>اطلاعات بیشتر</span></div>'),
        widget('woocommerce-product-data-tabs', 'تب‌ها و فرم نقد اصلی ووکامرس', ''),
    ], tag='section', element_id='gpd-extras'),
])

related = container('محصولات مرتبط واقعی', 'gpd-related gpd-reveal', [
    html_widget('عنوان محصولات مرتبط', '', '<div class="gpd-section-head"><span>بیشتر در فروشگاه</span></div>'),
    widget('woocommerce-product-related', 'محصولات مرتبط ووکامرس', '', posts_per_page=4, columns=4),
], tag='section')

mobile_cta = html_widget('میانبر موبایل به فرم خرید', '', '<div class="gpd-mobile-cta"><span>انتخاب و تهیه محصول</span><a href="#gpd-purchase">مشاهده گزینه‌های خرید</a></div>')
lightbox = html_widget('بزرگ‌نمایی گالری', '', '<dialog class="gpd-lightbox" aria-label="بزرگ‌نمایی تصاویر محصول"><div class="gpd-lightbox-bar"><span>تصاویر محصول</span><button type="button" data-gpd-close aria-label="بستن بزرگ‌نمایی">بستن ×</button></div><img alt=""><div class="gpd-lightbox-controls"><button type="button" data-gpd-prev>تصویر قبلی</button><button type="button" data-gpd-next>تصویر بعدی</button></div></dialog>')
main = container('محتوای محصول', 'gpd-main', [
    container('صفحه محصول', 'gpd-wrap gpd-shell', [
        widget('woocommerce-breadcrumb', 'مسیر راهنمای فروشگاه', 'gpd-breadcrumb'),
        container('معرفی، خرید و محتوا', 'gpd-layout', [hero, purchase, body]),
        related,
    ]),
    mobile_cta,
    lightbox,
], tag='div', element_id='gpd-main')
runtime = html_widget('⚙️ تعامل، گالری و حرکت — حذف نشود', 'gpd-system', '<script>\n' + JS + '\n</script>')
root = container('صفحه محصول گیلاکلیک', 'gpd-page', [style, main, runtime])
template = {'version': '0.4', 'title': 'صفحه جزئیات محصول گیلاکلیک', 'type': 'product', 'page_settings': {}, 'content': [root]}


def render(el):
    settings = el['settings']
    classes = settings.get('css_classes', '') or settings.get('_css_classes', '')
    if el['elType'] == 'container':
        tag = 'main' if 'gpd-main' in classes.split() else settings.get('html_tag', 'div')
        ident = ' id="' + attr(settings['_element_id']) + '"' if settings.get('_element_id') else ''
        extra = ' aria-label="تهیه محصول"' if 'gpd-aside' in classes.split() else ''
        return '<' + tag + ' class="e-con e-con-full ' + attr(classes) + '"' + ident + extra + '>' + ''.join(render(e) for e in el.get('elements', [])) + '</' + tag + '>\n'
    kind = el['widgetType']
    if kind == 'html':
        inner = settings['html']
    elif kind == 'woocommerce-breadcrumb':
        inner = '<nav class="woocommerce-breadcrumb" aria-label="مسیر صفحه"><a href="https://gilaclick.ir/">خانه</a> / <a href="https://gilaclick.ir/shop/">فروشگاه</a> / <span>' + value(DATA['name']) + '</span></nav><p class="gpd-snapshot">پیش‌نمایش بر پایه اطلاعات فروشگاه در ' + value(DATA['observed_on_fa']) + '؛ قیمت نهایی در فروشگاه بررسی می‌شود.</p>'
    elif kind == 'woocommerce-product-meta':
        inner = '<div class="product_meta"><span class="posted_in detail-container"><span class="detail-label">دسته:</span> <span class="detail-content"><a href="' + attr(DATA['category_url']) + '">' + value(DATA['category']) + '</a></span></span></div>'
    elif kind == 'woocommerce-product-title':
        inner = '<h1 class="elementor-heading-title product_title entry-title">' + value(DATA['name']) + '</h1>'
    elif kind == 'woocommerce-product-short-description':
        inner = ''  # The actual product has no short description; JS can use the existing long description.
    elif kind == 'woocommerce-product-images':
        inner = '<div class="woocommerce-product-gallery"><div class="woocommerce-product-gallery__wrapper"><div class="woocommerce-product-gallery__image"><a href="' + attr(DATA['cover']) + '"><img src="' + cover_fallback + '" data-gpd-original="' + attr(DATA['cover']) + '" alt="' + attr(DATA['cover_alt']) + '" width="750" height="500"></a></div></div></div>'
    elif kind == 'woocommerce-product-price':
        inner = '<p class="price"><span class="woocommerce-Price-amount amount"><bdi>' + value(DATA['price']) + '<span class="woocommerce-Price-currencySymbol">' + value(DATA['currency']) + '</span></bdi></span></p>'
    elif kind == 'woocommerce-product-stock':
        inner = '<p class="stock in-stock">موجود</p>'
    elif kind == 'woocommerce-notices':
        inner = ''
    elif kind == 'woocommerce-product-add-to-cart':
        inner = ('<div class="elementor-add-to-cart elementor-product-simple"><form class="cart" action="' + attr(DATA['source']) + '" method="post">'
                 '<div class="quantity"><label class="gpd-sr-only" for="gpd-sample-qty">تعداد محصول</label><input id="gpd-sample-qty" class="input-text qty text" type="number" name="quantity" value="1" min="1" step="1" inputmode="numeric"></div>'
                 '<button class="single_add_to_cart_button button alt" type="submit" name="add-to-cart" value="' + str(DATA['id']) + '">افزودن به سبد خرید</button></form></div>')
    elif kind == 'woocommerce-product-content':
        inner = PRODUCT_CONTENT
    elif kind in ('woocommerce-product-additional-information', 'woocommerce-product-data-tabs'):
        inner = ''  # This product exposes no attributes or reviews in the observed Store API.
    elif kind == 'woocommerce-product-related':
        product = DATA['related']
        inner = ('<section class="related products"><h2>محصولات مرتبط</h2><ul class="products"><li class="product"><a href="' + attr(product['url']) + '" class="woocommerce-LoopProduct-link"><img src="' + related_placeholder + '" data-gpd-original="' + attr(product['image']) + '" alt="' + attr(product['name']) + '" loading="lazy" width="750" height="500"><h3 class="woocommerce-loop-product__title">' + value(product['name']) + '</h3><span class="price">' + value(product['price']) + ' ' + value(product['currency']) + '</span></a><a class="button" href="' + attr(product['url']) + '">مشاهده محصول</a></li></ul></section>')
    else:
        raise ValueError('Unsupported preview widget: ' + kind)
    return '<div class="elementor-widget elementor-widget-' + kind + ' ' + attr(classes) + '"><div class="elementor-widget-container">' + inner + '</div></div>\n'


header_match = re.search(r'<header class="e-con e-con-full ga-header">.*?</header>', ABOUT_HTML, re.S)
footer_match = re.search(r'<footer class="e-con e-con-full ga-footer ga-dark">.*?</footer>', ABOUT_HTML, re.S)
if not header_match or not footer_match:
    raise RuntimeError('Could not locate the existing static header/footer')
header = header_match.group().replace(' ga-nav-current', '').replace(' aria-current="page"', '')
footer = footer_match.group()
preview_css = PREVIEW_HEADER_CSS + '\n' + '''
.gpd-page .gpd-snapshot { margin: 8px 0 0; color: #536d5f; font-size: 11px; }
.gpd-page .gpd-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.gpd-page.gpd-page .gpd-kicker { display: flex; flex-direction: row; align-items: center; }
'''
# Shared product CSS also needs the flex direction when Elementor's container reset is present.
preview = '''<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>پیش‌نمایش صفحه محصول | گیلاکلیک</title><meta name="robots" content="noindex,nofollow">
</head><body style="margin:0"><div class="e-con e-con-full gpd-page">
''' + '<style>\n' + CSS + '\n' + preview_css + '\n</style><a href="#gpd-main" class="gpd-skip">پرش به محتوای اصلی</a>\n' + header + '\n' + render(main) + footer + '\n<script>\n' + JS + '\n</script></div></body></html>\n'

(ROOT / 'gilaclick-product.html').write_text(preview, encoding='utf-8')
(ROOT / 'gilaclick-product-elementor.json').write_text(json.dumps(template, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Built the dated product preview and dynamic Elementor Single Product template.')
