<?php
/* Creates synthetic products, a review, a test-only tab and a product condition
 * in an isolated WordPress Playground. Never execute on a real site. */
if (!defined('HCF_DISPOSABLE_TEST') || !HCF_DISPOSABLE_TEST) { exit('Disposable fixture flag required'); }
require '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_set_current_user(1);
update_option('elementor_css_print_method', 'internal');
update_option('elementor_experiment-container', 'active');
update_option('woocommerce_enable_reviews', 'yes');
update_option('woocommerce_enable_review_rating', 'yes');
update_option('woocommerce_review_rating_required', 'yes');
update_option('woocommerce_enable_guest_checkout', 'yes');
update_option('woocommerce_currency', 'USD');
switch_theme('hello-elementor');
WC_Install::create_pages();
wp_update_post(['ID' => wc_get_page_id('cart'), 'post_content' => '[woocommerce_cart]']);
wp_update_post(['ID' => wc_get_page_id('checkout'), 'post_content' => '[woocommerce_checkout]']);
update_option('woocommerce_cod_settings', ['enabled' => 'yes', 'title' => 'Cash on delivery', 'description' => 'Fixture payment method']);
$category = wp_insert_term('افزونه و ماژول آزمایشی', 'product_cat');
$term = is_wp_error($category) ? 0 : (int) $category['term_id'];
$uploads = wp_upload_dir(); wp_mkdir_p($uploads['path']);
$cover = $uploads['path'] . '/fixture-cover.webp';
copy('/mnt/landgc/assets/img/product-preview-cover.webp', $cover);
$attachment = wp_insert_attachment(['post_mime_type' => 'image/webp', 'post_title' => 'تصویر محصول آزمایشی', 'post_status' => 'inherit'], $cover);
wp_update_attachment_metadata($attachment, wp_generate_attachment_metadata($attachment, $cover));
update_post_meta($attachment, '_wp_attachment_image_alt', 'تصویر محصول آزمایشی حامی');
$shot = $uploads['path'] . '/fixture-settings.webp';
copy('/mnt/landgc/assets/img/product-preview-dashboard.webp', $shot);
$shot_id = wp_insert_attachment(['post_mime_type' => 'image/webp', 'post_title' => 'تنظیمات آزمایشی', 'post_status' => 'inherit'], $shot);
wp_update_attachment_metadata($shot_id, wp_generate_attachment_metadata($shot_id, $shot));
// The second media deliberately has no alt to exercise the link-name fallback.
$p = new WC_Product_Simple();
$p->set_name('پلاگین تماس برای قیمت'); $p->set_status('publish'); $p->set_regular_price('1480000');
$p->set_description('<p>توضیحات اصلی ووکامرس در محصول آزمایشی.</p>');
$p->set_manage_stock(true); $p->set_stock_quantity(5); $p->set_reviews_allowed(true);
$p->set_image_id($attachment); $p->set_gallery_image_ids([$shot_id]); $p->set_category_ids([$term]);
$id = $p->save();
$q = new WC_Product_Simple();
$q->set_name('محصول مرتبط آزمایشی'); $q->set_status('publish'); $q->set_regular_price('1940000');
$q->set_image_id($attachment); $q->set_category_ids([$term]); $related_id = $q->save();
$comment = wp_insert_comment(['comment_post_ID' => $id, 'comment_author' => 'کاربر آزمایشی',
    'comment_author_email' => 'test@example.invalid', 'comment_content' => 'دیدگاه آزمایشی محیط محلی.',
    'comment_type' => 'review', 'comment_approved' => 1]);
add_comment_meta($comment, 'rating', 4);
$source = \Elementor\Plugin::$instance->templates_manager->get_source('local');
$result = $source->import_template('gilaclick-hami-call-for-price-elementor.json', '/mnt/landgc/gilaclick-hami-call-for-price-elementor.json');
if (is_wp_error($result)) { exit('IMPORT ERROR: ' . $result->get_error_message()); }
$template_id = $result[0]['template_id'];
wp_update_post(['ID' => $template_id, 'post_status' => 'publish']);
\ElementorPro\Modules\ThemeBuilder\Module::instance()->get_conditions_manager()->save_conditions($template_id, [
    ['type' => 'include', 'name' => 'singular', 'sub_name' => 'product', 'sub_id' => $id]
]);
update_option('hcf_fixture_ids', ['product' => $id, 'related' => $related_id, 'template' => $template_id, 'shot' => $shot_id]);
// A test-only theme hook imitates an existing third-party Woo tab.
$fixture_hook = "\nadd_filter('woocommerce_product_tabs', function(\$tabs) { \$tabs['fixture_tab'] = ['title'=>'تب آزمایشی افزونه دیگر','priority'=>40,'callback'=>function() { echo '<div id=fixture-third-party>محتوای تب آزمایشی</div>'; }]; return \$tabs; });\n";
file_put_contents(get_stylesheet_directory() . '/functions.php', $fixture_hook, FILE_APPEND);
copy('/mnt/landgc/tests/fixtures/hami-cfp-wordpress-control.php', ABSPATH . 'fixture-control.php');
echo 'SETUP RESULT ' . wp_json_encode(['product' => $id, 'related' => $related_id, 'template' => $template_id, 'link' => get_permalink($id)]);
