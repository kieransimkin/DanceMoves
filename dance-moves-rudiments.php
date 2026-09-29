<?php
/** DanceMoves integration module: DanceRudiments animation API v1. */
if (!defined('ABSPATH')) {
    exit;
}

define('DANCE_MOVES_RUDIMENTS_API_VERSION', '1.0.0');

/** Load the page-agnostic API; only mount Clay styling on the owned Clay page. */
function dance_moves_enqueue_rudiments() {
    $page_id = get_queried_object_id();
    if (!$page_id || !is_page($page_id)) {
        return;
    }
    $base_url = plugin_dir_url(__FILE__) . 'assets/';
    // Cache identity includes both the candidate plugin version and the API contract version.
    $version = DANCE_MOVES_VERSION . '-rudiments-' . DANCE_MOVES_RUDIMENTS_API_VERSION;
    wp_enqueue_script('dance-moves-rudiments-native', $base_url . 'vendor/dancerudiments/dancerudiments-native.js', array(), $version, true);
    wp_enqueue_script('dance-moves-rudiments', $base_url . 'dance-moves-rudiments.js', array('dance-moves-core', 'dance-moves-rudiments-native'), $version, true);
    if ((int) $page_id !== DANCE_MOVES_CLAY_STARS_PAGE_ID || defined('KS_CLAY_STARS_EFFECTS_VERSION')) {
        return;
    }
    wp_enqueue_style('dance-moves-clay-rudiments', $base_url . 'clay-stars-rudiments.css', array('dance-moves-clay-stars'), $version);
    wp_enqueue_script('dance-moves-clay-rudiments', $base_url . 'clay-stars-rudiments.js', array('dance-moves-rudiments', 'dance-moves-clay-stars'), $version, true);
}
add_action('wp_enqueue_scripts', 'dance_moves_enqueue_rudiments', 25);
