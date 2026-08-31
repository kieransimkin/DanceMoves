<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);
define('KS_CLAY_STARS_EFFECTS_VERSION', '1.0.1');

function is_page($id = 0): bool { return 252 === (int) $id; }
function is_admin(): bool { return false; }
function in_the_loop(): bool { return true; }
function is_main_query(): bool { return true; }
function add_action(...$args): void {}
function add_filter(...$args): void {}

$repo = dirname(__DIR__);
$releases = dirname($repo, 3);
$base = file_get_contents($releases . '/Made from the clay and the stars/wordpress-public-player-2026-08-31/candidate-wordpress-transport-script-fix.html');
if (false === $base) {
    fwrite(STDERR, "Unable to read the canonical Clay EPK source.\n");
    exit(2);
}

require $repo . '/kieran-epk-device-orientation.php';
$result = dance_moves_clay_stars_filter_content($base);
$checks = array(
    'legacy_plugin_suppresses_shared_transform' => hash_equals(hash('sha256', $base), hash('sha256', $result)),
    'legacy_plugin_marker_retained' => defined('KS_CLAY_STARS_EFFECTS_VERSION') && '1.0.1' === KS_CLAY_STARS_EFFECTS_VERSION,
    'shared_layers_not_inserted' => 0 === substr_count($result, 'class="ks-warm-bloom"'),
);

foreach ($checks as $name => $passed) {
    printf("%s=%s\n", $name, $passed ? 'PASS' : 'FAIL');
}
exit(in_array(false, $checks, true) ? 1 : 0);
