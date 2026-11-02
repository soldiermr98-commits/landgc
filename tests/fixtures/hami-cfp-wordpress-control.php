<?php
/* Test-only endpoint. Never install this file on a production WordPress site.
 * The disposable Playground server must define HCF_DISPOSABLE_TEST=true. */
if (!defined('HCF_DISPOSABLE_TEST') || !HCF_DISPOSABLE_TEST) { http_response_code(403); exit; }
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
$ids = get_option('hcf_fixture_ids');
if (!$ids || !function_exists('wc_get_product')) { http_response_code(404); exit; }
$product = wc_get_product($ids['product']);
$action = $_GET['action'] ?? 'info';
if ($action === 'sale') {
    $product->set_sale_price('990000'); $product->set_manage_stock(true);
    $product->set_stock_quantity(5); $product->set_stock_status('instock'); $product->save();
}
if ($action === 'out') {
    $product->set_manage_stock(true); $product->set_stock_quantity(0);
    $product->set_stock_status('outofstock'); $product->save();
}
if ($action === 'virtual') {
    // SQLite in Playground does not support Woo's stock reservation SQL.
    $product->set_manage_stock(false); $product->set_stock_status('instock');
    $product->set_virtual(true); $product->save();
}
if ($action === 'reset') {
    $product->set_manage_stock(true); $product->set_virtual(false); $product->set_sale_price('');
    $product->set_stock_quantity(5); $product->set_stock_status('instock'); $product->save();
}
if ($action === 'approve') {
    foreach (get_comments(['post_id' => $ids['product'], 'status' => 'hold', 'type' => 'review']) as $comment) {
        wp_set_comment_status($comment->comment_ID, 'approve');
    }
}
$product = wc_get_product($ids['product']);
$orders = wc_get_orders(['limit' => -1]);
echo wp_json_encode([
    'fixture' => 'disposable-hami-test', 'ids' => $ids,
    'versions' => ['wordpress' => get_bloginfo('version'), 'php' => PHP_VERSION,
                   'elementor' => ELEMENTOR_VERSION, 'proElements' => ELEMENTOR_PRO_VERSION,
                   'woocommerce' => WC_VERSION],
    'stock' => $product->get_stock_status(), 'qty' => $product->get_stock_quantity(),
    'sale' => $product->get_sale_price(), 'price' => $product->get_price(),
    'cart' => wc_get_page_permalink('cart'), 'checkout' => wc_get_page_permalink('checkout'),
    'reviews' => get_comments_number($ids['product']),
    'allReviews' => count(get_comments(['post_id' => $ids['product'], 'type' => 'review', 'status' => 'all'])),
    'orders' => count($orders),
    'orderStates' => array_map(function ($order) {
        return ['id' => $order->get_id(), 'status' => $order->get_status(),
                'total' => $order->get_total(), 'items' => count($order->get_items())];
    }, $orders),
]);
