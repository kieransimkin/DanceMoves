<?php
/**
 * Reviewed WP-CLI example, not an automatically executed plugin.
 * wp eval-file examples/wordpress/wordpress/configure-page.php page-settings.json --user=YOUR_ADMIN
 * Validates the entire request before writing any metadata. Use on a draft/staging page.
 */
if (!defined('WP_CLI') || !WP_CLI) { throw new RuntimeException('Run through WP-CLI.'); }
if (count($args ?? array()) !== 1) { WP_CLI::error('Supply one JSON settings filename.'); }
if (!function_exists('dance_moves_validate_timing_attachment')) { WP_CLI::error('Activate DanceMoves first.'); }
$file = realpath($args[0]);
if (!$file || !is_readable($file) || filesize($file) > 16384) { WP_CLI::error('Settings must be a readable JSON file no larger than 16 KiB.'); }
try { $input = json_decode(file_get_contents($file), true, 16, JSON_THROW_ON_ERROR); }
catch (Throwable $error) { WP_CLI::error($error->getMessage()); }
if (!is_array($input) || !is_int($input['pageId'] ?? null)) { WP_CLI::error('pageId must be a JSON integer.'); }
$id = $input['pageId'];
if ($id < 1 || get_post_type($id) !== 'page' || !current_user_can('edit_post', $id)) { WP_CLI::error('An editable WordPress Page is required; supply --user explicitly.'); }
$meta = $input['meta'] ?? null;
$keys = array(DANCE_MOVES_META_BPM, DANCE_MOVES_META_LYRIC_TIMING, DANCE_MOVES_META_CUE_TIMING, DANCE_MOVES_META_LYRIC_POPUPS, DANCE_MOVES_META_MASTER_DURATION, DANCE_MOVES_META_EFFECT);
if (!is_array($meta) || array_diff(array_keys($meta), $keys)) { WP_CLI::error('Unknown or missing metadata object.'); }
$clean = array();
foreach ($meta as $key => $value) {
    if ($key === DANCE_MOVES_META_BPM) {
        $clean[$key] = dance_moves_sanitize_bpm($value);
        if ($clean[$key] === '' && $value !== '' && $value !== null) { WP_CLI::error('BPM must be in [20,400], or blank.'); }
    } elseif ($key === DANCE_MOVES_META_LYRIC_TIMING || $key === DANCE_MOVES_META_CUE_TIMING) {
        if (!is_int($value) || $value < 0) { WP_CLI::error('Attachment IDs must be non-negative JSON integers.'); }
        $result = dance_moves_validate_timing_attachment($value, $key === DANCE_MOVES_META_LYRIC_TIMING ? 'lyric' : 'cue');
        if (is_wp_error($result)) { WP_CLI::error($result->get_error_message()); }
        $clean[$key] = $value;
    } elseif ($key === DANCE_MOVES_META_LYRIC_POPUPS) {
        if (!is_bool($value)) { WP_CLI::error('Lyric opt-in must be a JSON boolean.'); }
        $clean[$key] = $value ? '1' : '';
    } elseif ($key === DANCE_MOVES_META_MASTER_DURATION) {
        $number = dance_moves_sanitize_duration($value);
        if (!is_int($value) && !is_float($value)) { WP_CLI::error('Master duration must be numeric milliseconds.'); }
        if ((float) $value !== 0.0 && $number === 0) { WP_CLI::error('Master duration must be >0 and <=86400000 ms, or 0 to use discovery.'); }
        $clean[$key] = $number;
    } else {
        if (!is_string($value) || !in_array($value, array('', 'paper-planes'), true)) { WP_CLI::error('Effect must be empty or paper-planes.'); }
        $clean[$key] = $value;
    }
}
// Only supplied keys are changed. Unspecified keys are preserved.
// This is not a database transaction: read back and report every write failure.
foreach ($clean as $key => $value) {
    if ($value === '' || (($key === DANCE_MOVES_META_LYRIC_TIMING || $key === DANCE_MOVES_META_CUE_TIMING) && $value === 0)) {
        delete_post_meta($id, $key);
    } else { update_post_meta($id, $key, $value); }
}
foreach ($clean as $key => $value) {
    $deleting = $value === '' || (($key === DANCE_MOVES_META_LYRIC_TIMING || $key === DANCE_MOVES_META_CUE_TIMING) && $value === 0);
    if (($deleting && metadata_exists('post', $id, $key)) || (!$deleting && (string) get_post_meta($id, $key, true) !== (string) $value)) {
        WP_CLI::error('Read-back mismatch for ' . $key . '; earlier writes may have succeeded. Inspect this Page before retrying.');
    }
}
$config = dance_moves_get_page_config($id);
WP_CLI::log(wp_json_encode(array('pageId' => $id, 'stored' => array_intersect_key(get_post_meta($id), array_flip($keys)), 'config' => $config), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
WP_CLI::success('Requested metadata written. Inspect the read-back; save a Page revision through the editor when needed. No page content or publish status was changed.');
