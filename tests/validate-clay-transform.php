<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);

function is_page($id = 0): bool { return 252 === $id; }
function is_admin(): bool { return false; }
function in_the_loop(): bool { return true; }
function is_main_query(): bool { return true; }
function add_action(...$args): void {}
function add_filter(...$args): void {}

$repo = dirname(__DIR__);
$releases = dirname($repo, 3);
$release = $releases . '/Made from the clay and the stars';
$effects = $release . '/wordpress-warm-light-effects-2026-08-31';
$base = file_get_contents($release . '/wordpress-public-player-2026-08-31/candidate-wordpress-transport-script-fix.html');
$candidate = file_get_contents($effects . '/candidate-wordpress-transport.html');

if (false === $base || false === $candidate) {
    fwrite(STDERR, "Unable to read local EPK sources.\n");
    exit(2);
}

require $repo . '/kieran-epk-device-orientation.php';
$transformed = dance_moves_clay_stars_filter_content($base);
$candidate_without_assets = preg_replace(
    array(
        '#<style id="ks-clay-stars-warm-light-style">.*?</style>\n#s',
        '#<script id="ks-clay-stars-v2-script">.*?</script>#s',
    ),
    '',
    $candidate
);

$checks = array(
    'transform_matches_approved_candidate_dom' => is_string($candidate_without_assets) && hash_equals(hash('sha256', $candidate_without_assets), hash('sha256', $transformed)),
    'warm_bloom_count' => 1 === substr_count($transformed, 'class="ks-warm-bloom"'),
    'lens_flare_count' => 1 === substr_count($transformed, 'class="ks-lens-flare"'),
    'specular_sweep_count' => 1 === substr_count($transformed, 'class="ks-specular-sweep"'),
    'cloud_field_count' => 1 === substr_count($transformed, 'class="ks-cloud-field"'),
    'superseded_inline_motion_removed' => 0 === substr_count($transformed, 'id="ks-clay-stars-v2-script"'),
    'href_count_preserved' => substr_count($base, 'href=') === substr_count($transformed, 'href='),
    'audio_count_preserved' => substr_count($base, '<audio') === substr_count($transformed, '<audio'),
    'chapter_count_preserved' => substr_count($base, 'data-ks-clay-stars-chapter') === substr_count($transformed, 'data-ks-clay-stars-chapter'),
);

foreach ($checks as $name => $passed) {
    printf("%s=%s\n", $name, $passed ? 'PASS' : 'FAIL');
}
printf("transformed_sha256=%s\n", hash('sha256', $transformed));
exit(in_array(false, $checks, true) ? 1 : 0);
