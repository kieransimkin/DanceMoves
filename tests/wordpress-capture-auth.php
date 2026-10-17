<?php
/** Real plugin callbacks with WordPress boundary stubs; not an HTTP/core authentication test. */
declare(strict_types=1);
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);
$checks = 0;
$user_id = 0;
$can_manage = false;
$origin = false;
$transients = array();
$registered_types = array();
$registered_routes = array();
$inserted = array();
$saved_meta = array();
class WP_Error {
    public function __construct(public string $code, public string $message, public array $data = array()) {}
}
class WP_REST_Request {
    public function __construct(private array $payload = array(), private array $headers = array()) {}
    public function get_header($name) { return $this->headers[$name] ?? ''; }
    public function get_json_params() { return $this->payload; }
}
class WP_REST_Server { public const CREATABLE = 'POST'; }
function add_action(...$args): void {}
function add_shortcode(...$args): void {}
function add_filter(...$args): void {}
function current_user_can($capability): bool {
    global $can_manage, $user_id;
    return $user_id > 0 && $can_manage && $capability === 'manage_options';
}
function get_current_user_id(): int { global $user_id; return $user_id; }
function rest_authorization_required_code(): int { return get_current_user_id() ? 403 : 401; }
function get_http_origin() { global $origin; return $origin; }
function home_url(): string { return 'https://example.test'; }
function untrailingslashit($value): string { return rtrim($value, '/'); }
function get_transient($key) { global $transients; return $transients[$key]['value'] ?? false; }
function set_transient($key, $value, $ttl): void { global $transients; $transients[$key] = array('value' => $value, 'ttl' => $ttl); }
function register_post_type($name, $args): void { global $registered_types; $registered_types[$name] = $args; }
function register_rest_route($namespace, $path, $args): void { global $registered_routes; $registered_routes[$namespace . $path] = $args; }
function sanitize_text_field($value): string { return strip_tags((string) $value); }
function sanitize_key($value): string { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value)); }
function absint($value): int { return abs((int) $value); }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function current_time($format): string { return '2026-10-15 20:00:00'; }
function wp_insert_post($args, $wp_error) { global $inserted; $inserted[] = $args; return 41; }
function is_wp_error($value): bool { return $value instanceof WP_Error; }
function update_post_meta($id, $key, $value): void { global $saved_meta; $saved_meta[$key] = $value; }
function rest_ensure_response($value) { return $value; }
function check($condition, $label): void {
    global $checks;
    if (!$condition) { fwrite(STDERR, "FAIL: $label\n"); exit(1); }
    ++$checks;
}
require dirname(__DIR__) . '/kieran-epk-device-orientation.php';
ks_epk_motion_register_capture_type();
ks_epk_motion_register_rest_route();
$route = $registered_routes['ks-epk-motion/v1/capture'];
check($route['methods'] === 'POST', 'capture is a write route');
check(is_callable($route['permission_callback']), 'registered authorization callback is callable');
$request = new WP_REST_Request(array(), array('X-KS-Motion-Token' => 'previously-public-token'));
$permission = $route['permission_callback'];
$result = $permission($request);
check($result instanceof WP_Error && $result->code === 'ks_motion_forbidden' && $result->data['status'] === 401, 'anonymous callers cannot use a published token');
check($transients === array() && $inserted === array(), 'denied anonymous requests consume no quota and write no posts');
$user_id = 2;
$result = $permission($request);
check($result instanceof WP_Error && $result->data['status'] === 403, 'authenticated users without manage_options are denied');
check($transients === array(), 'unprivileged requests consume no administrator quota');
$user_id = 7;
$can_manage = true;
$origin = 'https://other.test';
$result = $permission($request);
check($result instanceof WP_Error && $result->code === 'ks_motion_origin', 'wrong supplied origin is rejected after authorization');
check($transients === array(), 'wrong origin consumes no quota');
$origin = 'https://example.test/';
check($permission(new WP_REST_Request()) === true, 'authorized administrator needs no legacy token');
check($transients['ks_motion_user_7']['ttl'] === 600, 'quota lifetime is ten minutes');
for ($attempt = 1; $attempt < 8; ++$attempt) {
    check($permission(new WP_REST_Request()) === true, 'administrator within quota accepted');
}
$result = $permission(new WP_REST_Request());
check($result instanceof WP_Error && $result->code === 'ks_motion_rate', 'ninth administrator attempt is rate-limited');
$user_id = 8;
$origin = false;
check($permission(new WP_REST_Request()) === true, 'separately authenticated administrator has independent quota without Origin');
check($transients['ks_motion_user_8']['value'] === 1, 'quota is keyed to authenticated user, not a shared IP');
$payload = array('schema' => 'ks-epk-motion-recording/v1', 'samples' => array(array('milliseconds' => 0, 'beta' => 0, 'gamma' => 0)));
$response = $route['callback'](new WP_REST_Request($payload));
check($response['captureId'] === 41 && $response['sampleCount'] === 1 && $response['storedPrivately'] === true, 'authorized valid capture is retained');
check($inserted[0]['post_status'] === 'private' && $inserted[0]['post_type'] === 'ks_motion_capture' && $inserted[0]['post_author'] === 8, 'capture is private and attributed to the authenticated operator');
check($saved_meta['_ks_motion_sample_count'] === 1 && strlen($saved_meta['_ks_motion_sha256']) === 64, 'capture evidence metadata retained');
$payload['samples'][0]['beta'] = 181;
$result = $route['callback'](new WP_REST_Request($payload));
check($result instanceof WP_Error && $result->code === 'ks_motion_invalid_samples' && count($inserted) === 1, 'invalid samples still cannot create a post');
$type = $registered_types['ks_motion_capture'];
check($type['public'] === false && $type['show_in_rest'] === false && $type['map_meta_cap'] === false, 'private capture UI cannot acquire generic post capabilities');
foreach (array('read_post', 'edit_post', 'delete_post', 'edit_posts', 'create_posts', 'read_private_posts', 'read') as $capability) {
    check($type['capabilities'][$capability] === 'manage_options', "capture UI $capability requires administrator authorization");
}
echo "PASS WordPress capture authorization, quota and private storage ($checks checks)\n";
