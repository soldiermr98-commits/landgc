# محیط آزمون یک‌بارمصرف حامی

**هشدار:** این فایل‌ها صرفاً برای یک WordPress Playground کاملاً مجزا هستند. `hami-cfp-wordpress-setup.php` محصول، نظر، قالب و شرط نمایش می‌سازد و پوسته آزمایشی را تغییر می‌دهد؛ `fixture-control.php` تنظیمات محصول را تغییر می‌دهد و endpoint مدیریتیِ بدون احراز هویت است. اسکریپت مرورگر نظر و سفارش آزمایشی هم ثبت می‌کند. هیچ‌کدام را روی سایت واقعی، سرور عمومی، یا محیطی که به مشتریان/درگاه/سرویس‌های واقعی متصل است کپی یا اجرا نکنید. کنترل فقط با ثابت `HCF_DISPOSABLE_TEST` فعال می‌شود و تست مرورگر فقط مبدأ HTTP روی loopback و نشان `disposable-hami-test` را می‌پذیرد؛ این حفاظت جایگزین ایزوله‌سازی محیط نیست.

## آماده‌سازی نمونه

1. خارج از مخزن، توزیع آماده و دارای assetهای WordPress 6.8.3، WooCommerce، Elementor، PRO Elements و پوسته Hello Elementor را از منابع معتبر در مسیرهای مجزا قرار دهید. PRO Elements در اینجا صرفاً جایگزین آزمایشی است؛ دستور نصب آن برای سایت اصلی نیست. نسخه تجاری Elementor Pro سایت به‌طور جداگانه نیاز به آزمون دارد.
2. برای مثال، وردپرس را در `/tmp/hcf-wp/wordpress`، سه افزونه را در `/tmp/hcf-wp/plugins/{woocommerce,elementor,pro-elements}` و Hello Elementor را در `/tmp/hcf-wp/wordpress/wp-content/themes/hello-elementor` باز کنید. مسیرهای mount افزونه‌ها را بسازید:

   ```sh
   mkdir -p /tmp/hcf-wp/wordpress/wp-content/plugins/{woocommerce,elementor,pro-elements}
   npm install --prefix /tmp/hcf-wp/tools @wp-playground/cli puppeteer-core axe-core
   ```

   در صورت نداشتن Chromium سیستم می‌توان `@sparticuz/chromium` را نیز در همان مسیر موقت نصب کرد؛ این بسته ممکن است به کتابخانه‌های سیستم نیاز داشته باشد. هیچ dependency یا داده آزمایشی را در مخزن نصب نکنید.
3. از ریشه همین مخزن سرور موقت را اجرا کنید. دقت کنید آدرس loopback فقط برای آزمون محلی است و نباید به مرورگر کاربران سایت یا پیش‌نمایش عمومی ارائه شود:

   ```sh
   /tmp/hcf-wp/tools/node_modules/.bin/wp-playground server \
     --wordpress-install-mode=install-from-existing-files --port=9405 --workers=1 \
     --site-url=http://127.0.0.1:9405 --define-bool HCF_DISPOSABLE_TEST true \
     --mount-before-install=/tmp/hcf-wp/wordpress:/wordpress \
     --mount=/tmp/hcf-wp/plugins/woocommerce:/wordpress/wp-content/plugins/woocommerce \
     --mount=/tmp/hcf-wp/plugins/elementor:/wordpress/wp-content/plugins/elementor \
     --mount=/tmp/hcf-wp/plugins/pro-elements:/wordpress/wp-content/plugins/pro-elements \
     --mount="$PWD":/mnt/landgc --blueprint="$PWD"/tests/fixtures/hami-cfp-blueprint.json
   ```

4. پس از آماده‌شدن محیط، در ترمینال دیگر آزمون را اجرا کنید:

   ```sh
   HCF_WP_ORIGIN=http://127.0.0.1:9405 \
   NODE_PATH=/tmp/hcf-wp/tools/node_modules CHROME_BIN=/مسیر/chromium \
     node tests/test_hami_cfp_wordpress.cjs
   ```

   اگر به‌جای Chromium سیستم `@sparticuz/chromium` نصب شده، `CHROME_BIN` را حذف کنید. بسته به نسخه Node/Playground و کتابخانه‌های سیستم، تنظیمات دیگری ممکن است لازم باشد. بعد از تست، سرور را متوقف و کل محیط موقت را دور بریزید.

تست تصاویر خارجی محصول را در مرورگر با تصویر محلی جایگزین می‌کند، بنابراین اتصال شبکه‌ای به کتابخانه رسانه واقعی را ثابت نمی‌کند. checkout آزمایشی برای دورزدن محدودیت SQL رزرو موجودی SQLite، محصول را موقتاً مجازی و بدون مدیریت موجودی می‌کند؛ پرداخت واقعی یا checkout با موجودی کنترل‌شده را اثبات نمی‌کند. محیط نمونه از درگاه «پرداخت در محل» آزمایشی استفاده می‌کند و به هیچ خدمات فروش واقعی متصل نیست.
