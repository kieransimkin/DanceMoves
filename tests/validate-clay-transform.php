<?php
declare(strict_types=1);

require __DIR__ . '/helpers/clay-transform-fixture.php';

// The default Unit gate has no dependency on external release folders. The old
// approved-payload comparison remains available as an explicit additional check.
$options = array();
for ($i = 1; $i < $argc; $i += 2) {
    $key = $argv[$i];
    if (!in_array($key, array('--base', '--candidate'), true) || !isset($argv[$i + 1]) || isset($options[$key])) {
        throw new InvalidArgumentException('Usage: php tests/validate-clay-transform.php [--base INPUT.html --candidate APPROVED.html]');
    }
    $options[$key] = $argv[$i + 1];
}
if (count($options) !== 0 && count($options) !== 2) {
    throw new InvalidArgumentException('Both --base and --candidate are required for the approved-payload comparison.');
}

$base = dm_clay_fixture('base.html');
$expected = dm_clay_fixture('expected.html');
require dirname(__DIR__) . '/kieran-epk-device-orientation.php';

$transformed = dance_moves_clay_stars_filter_content($base);
dm_clay_check('transform_matches_independent_expected_fixture', $transformed === $expected);
dm_clay_check('transform_is_idempotent', dance_moves_clay_stars_filter_content($transformed) === $transformed);
dm_clay_check('existing_complete_layers_are_unchanged', dance_moves_clay_stars_filter_content($expected) === $expected);
dm_clay_check('content_filter_registered_at_priority_20', in_array(
    array('the_content', 'dance_moves_clay_stars_filter_content', 20), $dm_clay_filters, true
));

foreach (array('ks-warm-bloom', 'ks-lens-flare', 'ks-specular-sweep', 'ks-cloud-field') as $class) {
    dm_clay_check($class . '_inserted_once', substr_count($transformed, 'class="' . $class . '"') === 1);
    dm_clay_check($class . '_is_decorative', substr_count($transformed, 'class="' . $class . '" aria-hidden="true"') === 1);
}
dm_clay_check('superseded_inline_motion_removed', strpos($transformed, 'id="ks-clay-stars-v2-script"') === false);
dm_clay_check('unrelated_inline_script_preserved', strpos($transformed, '<script id="unrelated-page-script">/* An unrelated script must be preserved. */</script>') !== false);
dm_clay_check('href_count_preserved', substr_count($base, 'href=') === substr_count($transformed, 'href='));
dm_clay_check('audio_count_preserved', substr_count($base, '<audio') === 1 && substr_count($transformed, '<audio') === 1);
dm_clay_check('chapter_count_preserved', substr_count($base, 'data-ks-clay-stars-chapter') === 5 && substr_count($transformed, 'data-ks-clay-stars-chapter') === 5);
foreach (array(
    'player_markup_preserved' => '#<audio\b.*?</audio>#s',
    'chapter_markup_preserved' => '#<button\b[^>]*data-ks-clay-stars-chapter[^>]*>.*?</button>#s',
    'links_preserved' => '#<a\b.*?</a>#s',
    'readable_lyrics_preserved' => '#<details\b.*?</details>#s',
    'unicode_copy_preserved' => '#<p>𒀭.*?</p>#s',
) as $name => $pattern) {
    preg_match_all($pattern, $base, $before);
    preg_match_all($pattern, $transformed, $after);
    dm_clay_check($name, count($before[0]) > 0 && $before[0] === $after[0]);
}

foreach (array(
    'unknown_page_is_untouched' => array('page_id' => 999),
    'admin_content_is_untouched' => array('admin' => true),
    'outside_loop_is_untouched' => array('in_loop' => false),
    'secondary_query_is_untouched' => array('main_query' => false),
) as $name => $context) {
    dm_clay_context($context);
    dm_clay_check($name, dance_moves_clay_stars_filter_content($base) === $base);
}
dm_clay_context();
$unrelated = str_replace('ks-clay-stars-v2', 'other-release', $base);
dm_clay_check('unrelated_markup_is_untouched', dance_moves_clay_stars_filter_content($unrelated) === $unrelated);
dm_clay_check('empty_content_is_untouched', dance_moves_clay_stars_filter_content('') === '');

// Each group can already exist independently of the other. Both paths must
// converge on the independently authored expected HTML without duplicates.
$cover_layers = '<span class="ks-warm-bloom" aria-hidden="true"></span><span class="ks-lens-flare" aria-hidden="true"></span><span class="ks-specular-sweep" aria-hidden="true"></span>';
$cloud_layer = '<span class="ks-cloud-field" aria-hidden="true"></span>';
$cover_only = str_replace('<div class="epk-cover-wrap">', '<div class="epk-cover-wrap">' . $cover_layers, $base);
$cloud_only = str_replace('<div class="epk-atmosphere" aria-hidden="true"></div>', '<div class="epk-atmosphere" aria-hidden="true"></div>' . "\n  " . $cloud_layer, $base);
dm_clay_check('existing_cover_layers_not_duplicated', dance_moves_clay_stars_filter_content($cover_only) === $expected);
dm_clay_check('existing_cloud_layer_not_duplicated', dance_moves_clay_stars_filter_content($cloud_only) === $expected);
$second_cover = $base . "\n<div class=\"epk-cover-wrap\">second cover</div>\n";
dm_clay_check('only_first_cover_is_transformed', dance_moves_clay_stars_filter_content($second_cover) === $expected . "\n<div class=\"epk-cover-wrap\">second cover</div>\n");
$second_atmosphere = $base . "\n<div class=\"epk-atmosphere\" aria-hidden=\"true\"></div>\n";
dm_clay_check('only_first_atmosphere_is_transformed', dance_moves_clay_stars_filter_content($second_atmosphere) === $expected . "\n<div class=\"epk-atmosphere\" aria-hidden=\"true\"></div>\n");

if ($options) {
    // Caller supplies the approved inputs; never discover private paths, fetch a
    // live page, generate the expected side, or report this as live verification.
    $release_base = dm_clay_read_text($options['--base']);
    $candidate = dm_clay_read_text($options['--candidate']);
    $has_root = strpos($release_base, 'ks-clay-stars-v2') !== false && strpos($candidate, 'ks-clay-stars-v2') !== false;
    if (!$has_root || strpos($release_base . $candidate, 'Synthetic DanceMoves unit fixture') !== false) {
        throw new InvalidArgumentException('Approved-payload inputs must identify Clay/Stars and must not be the synthetic unit fixtures.');
    }
    $candidate_without_assets = preg_replace(array(
        '#<style id="ks-clay-stars-warm-light-style">.*?</style>\r?\n#s',
        '#<script id="ks-clay-stars-v2-script">.*?</script>#s',
    ), '', $candidate);
    $release_result = dance_moves_clay_stars_filter_content($release_base);
    dm_clay_check('transform_matches_supplied_approved_candidate_dom', is_string($candidate_without_assets) && $release_result === $candidate_without_assets);
    dm_clay_check('supplied_release_transform_is_idempotent', dance_moves_clay_stars_filter_content($release_result) === $release_result);
    printf("supplied_release_transformed_sha256=%s\n", hash('sha256', $release_result));
}

printf("fixture_transformed_sha256=%s\n", hash('sha256', $transformed));
dm_clay_finish('Clay/Stars content-transform unit validation');
