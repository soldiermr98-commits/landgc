#!/usr/bin/env python3
"""Embed the standalone header's scoped CSS/JS in its Elementor JSON template.

Existing editable controls, ordering and user-selected links are retained. The
homepage export supplies the icon symbols and header binding metadata. This is
a build-time dependency only. The resulting JSON uses the site's installed
Peyda font and does not embed font data.
"""
from __future__ import annotations

import copy
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HEADER_PATH = ROOT / 'gilaclick header.json'
HOME_PATH = ROOT / 'gilaclick-elementor.json'


def walk(elements):
    for element in elements:
        yield element
        yield from walk(element.get('elements', []))


def titled(elements, title):
    for element in walk(elements):
        if element.get('settings', {}).get('_title') == title:
            return element
    raise RuntimeError('Missing Elementor element: ' + title)


def marker(element, value):
    settings = element['settings']
    classes = settings.get('css_classes', '').split()
    if value not in classes:
        classes.append(value)
    settings['css_classes'] = ' '.join(classes)


def replace_attribute(markup, name, key, attr, value):
    pattern = re.compile(r'(<a\b(?=[^>]*\b' + re.escape(name) + r'="' + re.escape(key) + r'")[^>]*?\b' + attr + r'=")[^"]*(")', re.S)
    result, n = pattern.subn(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), markup, count=1)
    if n != 1:
        raise RuntimeError('Could not update ' + name + '=' + key)
    return result


def main():
    header = json.loads(HEADER_PATH.read_text(encoding='utf-8'))
    homepage = json.loads(HOME_PATH.read_text(encoding='utf-8'))
    if header.get('type') != 'header':
        raise RuntimeError('Expected an Elementor header template')
    roots = header['content']
    style_root = titled(roots, '⚙️ استایل‌ها و تنظیمات — حذف نشود')
    section_root = titled(roots, 'سربرگ قابل ویرایش')
    drawer_root = titled(roots, 'منوی موبایل — کد HTML')
    if style_root not in roots or section_root not in roots or drawer_root not in roots:
        raise RuntimeError('Header roots must remain top-level Elementor containers')
    marker(style_root, 'gch-style-root')
    marker(section_root, 'gch-header-root')
    marker(drawer_root, 'gch-drawer-root')
    stage = titled(section_root['elements'], 'نمای اصلی سربرگ — گرافیک و تعامل')['settings']
    drawer = drawer_root['elements'][0]['settings']
    visual = stage['html']
    mobile = drawer['html']
    # Keep the homepage's semantic/data hooks, but namespace IDs so they do not
    # clash with other themes, pages or their SVG sprites.
    if 'data-gch-header' not in visual:
        visual = visual.replace('<header class="site-header"', '<header data-gch-header="" class="site-header"', 1)
    if 'data-gch-drawer' not in mobile:
        mobile = mobile.replace('<div aria-label="منوی سایت"', '<div data-gch-drawer="" aria-label="منوی سایت"', 1)
    for old, new in [('mobile-nav', 'gch-mobile-nav'), ('nav-shop', 'gch-nav-shop'), ('nav-services', 'gch-nav-services')]:
        visual = re.sub(r'(aria-controls|id)="' + re.escape(old) + r'"', lambda m: m.group(1) + '="' + new + '"', visual)
        mobile = re.sub(r'(aria-controls|id)="' + re.escape(old) + r'"', lambda m: m.group(1) + '="' + new + '"', mobile)
    visual = re.sub(r'href="#i-', 'href="#gch-i-', visual)
    mobile = re.sub(r'href="#i-', 'href="#gch-i-', mobile)
    # The original four service links pointed at sections of the homepage.
    # Keep those exact destinations valid when the header is used elsewhere.
    for key in ('web', 'seo', 'support', 'dev'):
        visual = visual.replace('href="#service-' + key + '"', 'href="https://gilaclick.ir/#service-' + key + '"')
        mobile = mobile.replace('href="#service-' + key + '"', 'href="https://gilaclick.ir/#service-' + key + '"')
    for element in walk(section_root['elements']):
        settings = element.get('settings', {})
        link = settings.get('link')
        if isinstance(link, dict) and re.fullmatch(r'#service-(?:web|seo|support|dev)', link.get('url', '')):
            link['url'] = 'https://gilaclick.ir/' + link['url']

    # The uploaded template already customized control 232. Reflect that saved
    # value in the static markup too, so it is right even before JS executes.
    control = next(e for e in walk(section_root['elements']) if 'gc-bind-232' in e.get('settings', {}).get('_css_classes', '').split())['settings']
    label = html.escape(control.get('text', ''), quote=False)
    link = control.get('link', {}).get('url', '')
    visual = replace_attribute(visual, 'data-gc-bind', '232', 'href', link)
    mobile = replace_attribute(mobile, 'data-gc-mirror', '232', 'href', link)
    def visual_label(match):
        inner = match.group(2)
        inner, n = re.subn(r'(^\s*)[^<]+?(\s*)(?=<svg\b)', lambda m: m.group(1) + label + m.group(2), inner, count=1, flags=re.S)
        if n != 1:
            raise RuntimeError('Could not update the desktop service footer label')
        return match.group(1) + inner + match.group(3)
    visual, n = re.subn(r'(<a\b[^>]*data-gc-bind="232"[^>]*>)(.*?)(</a>)', visual_label, visual, count=1, flags=re.S)
    if n != 1: raise RuntimeError('Missing desktop service footer')
    def mobile_label(match):
        inner = match.group(2)
        inner, n = re.subn(r'(</svg>)\s*[^<]+\s*$', lambda m: m.group(1) + label, inner, count=1, flags=re.S)
        if n != 1:
            raise RuntimeError('Could not update the mobile service footer label')
        return match.group(1) + inner + match.group(3)
    mobile, n = re.subn(r'(<a\b[^>]*data-gc-mirror="232"[^>]*>)(.*?)(</a>)', mobile_label, mobile, count=1, flags=re.S)
    if n != 1: raise RuntimeError('Missing mobile service footer')
    stage['html'] = visual
    drawer['html'] = mobile

    home_style = titled(homepage['content'], '⚙️ استایل‌ها و تنظیمات — حذف نشود')['elements'][0]['settings']['html']
    needed_icons = set(re.findall(r'href="#gch-(i-[\w-]+)"', visual + mobile))
    # regex returns (whole, name); invert it for direct lookup
    all_symbols = {name: whole for whole, name in re.findall(r'(<symbol id="(i-[\w-]+)"[^>]*>.*?</symbol>)', home_style, re.S)}
    if needed_icons - all_symbols.keys():
        raise RuntimeError('Missing icon symbols: ' + ', '.join(sorted(needed_icons - all_symbols.keys())))
    symbols = '\n'.join(all_symbols[k].replace('id="i-', 'id="gch-i-', 1) for k in sorted(needed_icons))
    css = (ROOT / 'assets/css/elementor-header-standalone.css').read_text(encoding='utf-8')
    style_root['elements'][0]['settings']['html'] = ('<style>\n' + css +
        '\n</style><svg aria-hidden="true" focusable="false" height="0" width="0" style="position:absolute;overflow:hidden" xmlns="http://www.w3.org/2000/svg">\n' + symbols + '\n</svg><div data-gch-spacer="" aria-hidden="true"></div>')

    home_runtime = titled(homepage['content'], '⚙️ حرکت‌ها و اتصال — حذف نشود')
    home_script = home_runtime['elements'][0]['settings']['html']
    match = re.search(r'var META = (\{.*?\});\n  var editing', home_script, re.S)
    if not match:
        raise RuntimeError('Homepage binding metadata not found')
    home_meta = json.loads(match.group(1))
    meta = {str(i): home_meta[str(i)] for i in range(201, 241)}
    for info in meta.values():
        for key in ('originalIcon', 'mirrorOriginalIcon'):
            if key in info:
                info[key] = info[key].replace('href="#i-', 'href="#gch-i-')
    source = (ROOT / 'assets/js/elementor-header-standalone.js').read_text(encoding='utf-8')
    placeholder = '/*__HEADER_META__*/{}'
    if source.count(placeholder) != 1:
        raise RuntimeError('Header binding metadata placeholder is missing')
    source = source.replace(placeholder, json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    if '</script' in source.lower():
        raise RuntimeError('A closing script tag cannot appear inside the runtime')
    title = '⚙️ رفتار و اتصال سربرگ — حذف نشود'
    existing = [x for x in roots if x.get('settings', {}).get('_title') == title]
    if len(existing) > 1:
        raise RuntimeError('Duplicate runtime root')
    if existing:
        runtime = existing[0]
    else:
        runtime = copy.deepcopy(home_runtime)
        runtime['id'] = '73a4be1'
        runtime['elements'][0]['id'] = '6110a4c'
        roots.append(runtime)
    marker(runtime, 'gch-runtime-root')
    runtime['settings']['_title'] = title
    runtime['elements'][0]['settings']['_title'] = title
    runtime['elements'][0]['settings']['html'] = '<script>\n' + source + '\n</script>'
    ids = [e.get('id') for e in walk(roots)]
    if len(ids) != len(set(ids)):
        raise RuntimeError('Duplicate Elementor element IDs')
    HEADER_PATH.write_text(json.dumps(header, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Built {HEADER_PATH.name}: {len(roots)} roots, {len(ids)} elements, {len(needed_icons)} symbols')


if __name__ == '__main__':
    main()
