<?php
/** DanceMoves integration module: DanceRudiments animation API v1.1. */
if (!defined('ABSPATH')) {
    exit;
}

define('DANCE_MOVES_RUDIMENTS_API_VERSION', '1.1.0');

/** Compatibility handles only: frontend implementations are in lib/wordpress.js. */
function dance_moves_enqueue_rudiments() {
    $page_id = get_queried_object_id();
    if (!$page_id || !is_page($page_id)) {
        return;
    }
    // Cache identity includes both the candidate plugin version and the API contract version.
    $version = DANCE_MOVES_VERSION . '-rudiments-' . DANCE_MOVES_RUDIMENTS_API_VERSION;
    wp_enqueue_script('dance-moves-rudiments-native', false, array('dance-moves-core'), $version, true);
    wp_enqueue_script('dance-moves-rudiments', false, array('dance-moves-core', 'dance-moves-rudiments-native'), $version, true);
}
add_action('wp_enqueue_scripts', 'dance_moves_enqueue_rudiments', 25);
