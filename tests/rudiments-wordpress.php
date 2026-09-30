<?php
// Executable page-agnostic enqueue test without booting WordPress.
define('ABSPATH', __DIR__);
define('DANCE_MOVES_VERSION', '2.9.0');
$page_id = 0;
$is_page = false;
$scripts = array();
$styles = array();
$hooks = array();
function get_queried_object_id() { global $page_id; return $page_id; }
function is_page($id) { global $is_page; return $is_page; }
function plugin_dir_url($file) { return 'https://example.test/wp-content/plugins/kieran-epk-device-orientation/'; }
function wp_enqueue_script($id, $src, $deps, $version, $footer) { global $scripts; $scripts[$id] = compact('src','deps','version','footer'); }
function wp_enqueue_style($id, $src, $deps, $version) { global $styles; $styles[$id] = compact('src','deps','version'); }
function add_action($hook, $callback, $priority = 10) { global $hooks; $hooks[] = array($hook, $callback, $priority); }
function require_check($condition, $message) { if (!$condition) { fwrite(STDERR, $message . "\n"); exit(1); } }
require __DIR__ . '/../dance-moves-rudiments.php';
require_check($hooks === array(array('wp_enqueue_scripts','dance_moves_enqueue_rudiments',25)), 'enqueue hook/priority');
dance_moves_enqueue_rudiments(); require_check(!$scripts && !$styles, 'not loaded on non-pages');
$page_id = 100; $is_page = true;
dance_moves_enqueue_rudiments();
require_check(count($scripts) === 2 && !$styles, 'ordinary pages get public API only');
require_check($scripts['dance-moves-rudiments']['deps'] === array('dance-moves-core','dance-moves-rudiments-native'), 'core and native load before API');
$scripts = $styles = array(); $page_id = 252;
dance_moves_enqueue_rudiments();
require_check(count($scripts) === 2 && !$styles, 'every Page receives the same reusable API');
foreach ($scripts as $script) {
    require_check($script['footer'] && $script['version'] === '2.9.0-rudiments-1.1.0', 'candidate cache key/footer');
    require_check(false === $script['src'], 'compatibility handle must not enqueue a duplicate frontend');
}
require_check(!isset($scripts['dance-moves-clay-rudiments']), 'no EPK-specific rudiment handle');
echo "PASS WordPress page-agnostic enqueue, cache-key and single-library contracts\n";
