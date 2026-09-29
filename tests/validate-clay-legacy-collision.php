<?php
declare(strict_types=1);

require __DIR__ . '/helpers/clay-transform-fixture.php';
define('KS_CLAY_STARS_EFFECTS_VERSION', '1.0.1');

$base = dm_clay_fixture('base.html');
$expected = dm_clay_fixture('expected.html');
require dirname(__DIR__) . '/kieran-epk-device-orientation.php';
$result = dance_moves_clay_stars_filter_content($base);

dm_clay_check('legacy_plugin_suppresses_shared_transform', $result === $base);
dm_clay_check('legacy_plugin_marker_retained', defined('KS_CLAY_STARS_EFFECTS_VERSION') && KS_CLAY_STARS_EFFECTS_VERSION === '1.0.1');
foreach (array('ks-warm-bloom', 'ks-lens-flare', 'ks-specular-sweep', 'ks-cloud-field') as $class) {
    dm_clay_check($class . '_not_inserted', strpos($result, 'class="' . $class . '"') === false);
}
dm_clay_check('legacy_inline_motion_is_retained', strpos($result, 'id="ks-clay-stars-v2-script"') !== false);
dm_clay_check('legacy_guard_also_preserves_existing_layers', dance_moves_clay_stars_filter_content($expected) === $expected);
dm_clay_check('legacy_guard_is_idempotent', dance_moves_clay_stars_filter_content($result) === $result);
dm_clay_finish('Clay/Stars legacy-plugin collision unit validation');
