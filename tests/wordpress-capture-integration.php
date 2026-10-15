<?php
/** Run with wp eval-file on a disposable real WordPress installation. No production site. */
if (!defined('WP_CLI') || !WP_CLI) { exit(1); }
$checks = 0;
function dancem_capture_check($condition, $message) {
    global $checks;
    if (!$condition) { WP_CLI::error($message); }
    ++$checks;
}
function dancem_capture_request($legacy_header = false) {
    $request = new WP_REST_Request('POST', '/ks-epk-motion/v1/capture');
    $request->set_header('Content-Type', 'application/json');
    if ($legacy_header) { $request->set_header('X-KS-Motion-Token', 'published-token-fixture'); }
    $request->set_body(wp_json_encode(array('schema' => 'ks-epk-motion-recording/v1',
        'samples' => array(array('milliseconds' => 0, 'beta' => 0, 'gamma' => 0)))));
    return rest_do_request($request);
}
$admin = get_user_by('login', 'capture_admin')->ID;
$editor = wp_insert_user(array('user_login' => 'capture_editor', 'role' => 'editor', 'user_pass' => wp_generate_password()));
$second = wp_insert_user(array('user_login' => 'capture_second_admin', 'role' => 'administrator', 'user_pass' => wp_generate_password()));
dancem_capture_check(!is_wp_error($editor) && !is_wp_error($second), 'disposable role fixtures created');
rest_get_server();
wp_set_current_user(0);
dancem_capture_check(dancem_capture_request(true)->get_status() === 401, 'anonymous published-token request rejected by real REST dispatch');
wp_set_current_user($editor);
dancem_capture_check(dancem_capture_request(true)->get_status() === 403, 'real editor role lacks capture write permission');

// Exercise WordPress core cookie nonce verification, then actual plugin dispatch.
// These are core integration tests, not claims about a physical browser session.
$GLOBALS['wp_rest_auth_cookie'] = true;
wp_set_current_user($admin);
unset($_REQUEST['_wpnonce'], $_SERVER['HTTP_X_WP_NONCE']);
rest_cookie_check_errors(null);
dancem_capture_check(get_current_user_id() === 0, 'core removes cookie authentication without a REST nonce');
dancem_capture_check(dancem_capture_request()->get_status() === 401, 'missing nonce cannot create a capture');
wp_set_current_user($admin);
$_SERVER['HTTP_X_WP_NONCE'] = 'invalid-nonce-fixture';
$nonce_error = rest_cookie_check_errors(null);
dancem_capture_check(is_wp_error($nonce_error) && $nonce_error->get_error_code() === 'rest_cookie_invalid_nonce', 'core rejects an invalid nonce');
$_SERVER['HTTP_X_WP_NONCE'] = wp_create_nonce('wp_rest');
dancem_capture_check(rest_cookie_check_errors(null) === true, 'core validates the current administrator nonce');
$response = dancem_capture_request();
dancem_capture_check($response->get_status() === 200, 'authorized real WordPress REST capture succeeds');
$capture = get_post($response->get_data()['captureId']);
dancem_capture_check($capture->post_status === 'private' && (int) $capture->post_author === (int) $admin, 'database record is private and correctly attributed');
dancem_capture_check(current_user_can('read_post', $capture->ID) && current_user_can('edit_post', $capture->ID), 'administrator can manage capture through real core capabilities');
wp_set_current_user($editor);
foreach (array('read_post', 'edit_post', 'delete_post') as $capability) {
    dancem_capture_check(!current_user_can($capability, $capture->ID), "real editor cannot $capability private capture");
}
wp_set_current_user($admin);
for ($attempt = 1; $attempt < 8; ++$attempt) {
    dancem_capture_check(dancem_capture_request()->get_status() === 200, 'administrator remains within real transient quota');
}
dancem_capture_check(dancem_capture_request()->get_status() === 429, 'real transient rejects ninth request');
wp_set_current_user($second);
dancem_capture_check(dancem_capture_request()->get_status() === 200, 'second administrator has independent quota');
wp_set_current_user(0);
dancem_capture_check(dancem_capture_request(true)->get_status() === 401, 'authorization still precedes quota after valid captures');
WP_CLI::success("WordPress capture core nonce, role, REST, database and quota integration ($checks checks)");
