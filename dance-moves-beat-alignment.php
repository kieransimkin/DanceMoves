<?php
/** Source-bound beat-phase metadata. Lyric/cue timestamps remain in source time. */
if (!defined('ABSPATH')) { exit; }
define('DANCE_MOVES_META_BEAT_ALIGNMENT', '_dance_moves_beat_alignment');
define('DANCE_MOVES_META_ALIGNMENT_AUDIO', '_dance_moves_beat_alignment_audio_id');

function dance_moves_parse_beat_alignment($value) {
    if (!is_string($value) || strlen($value) > 16384) {
        return new WP_Error('dance_moves_alignment', 'Beat alignment must be a StemLab JSON reading below 16 KiB.');
    }
    if (trim($value) === '') { return null; }
    $data = json_decode($value, true, 16);
    if (!is_array($data) || ($data['schema'] ?? '') !== 'stemlab.beat-alignment.v1'
        || ($data['pips_per_beat'] ?? null) !== 64 || ($data['canonical_first_beat_pip'] ?? null) !== 0) {
        return new WP_Error('dance_moves_alignment', 'Choose a source-bound StemLab 64-pip beat-alignment.v1 reading.');
    }
    foreach (array('source_sha256', 'evidence_sha256', 'report_sha256') as $key) {
        if (!is_string($data[$key] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $data[$key])) {
            return new WP_Error('dance_moves_alignment_hash', 'The reading needs valid master, detector and report SHA-256 identities.');
        }
    }
    $numbers = array();
    foreach (array('bpm' => array(20, 400), 'first_beat_seconds' => array(0, 86400), 'offset_pips' => array(-36864000, 0)) as $key => $bounds) {
        $number = $data[$key] ?? null;
        if ((!is_int($number) && !is_float($number)) || !is_finite((float) $number) || $number < $bounds[0] || $number > $bounds[1]) {
            return new WP_Error('dance_moves_alignment_number', 'The reading contains an invalid BPM, first beat or signed pip offset.');
        }
        $numbers[$key] = (float) $number;
    }
    foreach (array('exact_bpm' => 'bpm', 'first_beat_exact_seconds' => 'first_beat_seconds', 'exact_offset_pips' => 'offset_pips') as $key => $numeric) {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !preg_match('/^-?\d{1,80}(?:\/[1-9]\d{0,79})?$/D', $value)) {
            return new WP_Error('dance_moves_alignment_exact', 'Exact clock values must be bounded rational strings from StemLab.');
        }
        $parts = explode('/', $value);
        $number = (float) $parts[0] / (float) ($parts[1] ?? 1);
        if (!is_finite($number) || abs($number - $numbers[$numeric]) > 0.0000001) {
            return new WP_Error('dance_moves_alignment_exact', 'Exact and numeric clock values disagree.');
        }
    }
    if (abs($numbers['first_beat_seconds'] * $numbers['bpm'] * 64 / 60 + $numbers['offset_pips']) > 0.0000001
        || !in_array($data['bpm_status'] ?? '', array('canonical', 'estimated'), true)
        || !in_array($data['phase_status'] ?? '', array('estimated', 'confirmed', 'synthetic'), true)) {
        return new WP_Error('dance_moves_alignment_phase', 'The offset must map the selected first beat to pip zero and retain its authority status.');
    }
    foreach (array('analysis_id', 'bpm_basis') as $key) {
        if (!is_string($data[$key] ?? null) || !preg_match('/^[a-zA-Z0-9_.-]{1,128}$/D', $data[$key])) {
            return new WP_Error('dance_moves_alignment_detector', 'The reading needs an explicit detector and BPM basis.');
        }
    }
    $audio = $data['source_audio'] ?? null;
    if (($data['source_audio_verified'] ?? false) !== true || !is_array($audio)
        || !is_int($audio['num_frames'] ?? null) || $audio['num_frames'] < 1
        || !is_int($audio['sample_rate'] ?? null) || $audio['sample_rate'] < 1
        || $numbers['first_beat_seconds'] >= $audio['num_frames'] / $audio['sample_rate']) {
        return new WP_Error('dance_moves_alignment_audio', 'Export the reading with --audio so the exact master and frame bounds are verified.');
    }
    // Unknown fields and private paths are never localized into public configuration.
    $allowed = array('schema', 'source_sha256', 'source_audio_verified', 'bpm', 'exact_bpm', 'bpm_basis', 'bpm_status',
        'phase_status', 'analysis_id', 'evidence_sha256', 'first_beat_seconds', 'first_beat_exact_seconds', 'offset_pips',
        'exact_offset_pips', 'pips_per_beat', 'canonical_first_beat_pip', 'report_sha256');
    $clean = array_intersect_key($data, array_flip($allowed));
    $clean['source_audio'] = array_intersect_key($audio, array_flip(array('sample_rate', 'num_frames', 'num_channels', 'duration_seconds')));
    return $clean;
}

function dance_moves_resolve_beat_alignment($json, $attachment_id, $bpm = '') {
    $reading = dance_moves_parse_beat_alignment($json);
    if (!$reading || is_wp_error($reading)) { return $reading; }
    $file = get_attached_file(absint($attachment_id));
    $url = dance_moves_attachment_url($attachment_id);
    if (!$file || !is_readable($file) || !$url || !str_starts_with((string) get_post_mime_type(absint($attachment_id)), 'audio/') || filesize($file) > 536870912
        || hash_file('sha256', $file) !== $reading['source_sha256']) {
        return new WP_Error('dance_moves_alignment_master', 'Select the exact public master attachment analysed by StemLab; its SHA-256 must match.');
    }
    if (is_numeric($bpm) && (float) $bpm >= 20 && (float) $bpm <= 400 && abs((float) $bpm - $reading['bpm']) > 0.000500001) {
        return new WP_Error('dance_moves_alignment_bpm', 'Stored BPM and reading differ. Export an alignment using the matching BPM basis.');
    }
    $reading['source_url'] = $url;
    return $reading;
}

function dance_moves_sanitize_beat_alignment($value) {
    $reading = dance_moves_parse_beat_alignment($value);
    return !$reading || is_wp_error($reading) ? '' : wp_json_encode($reading);
}

function dance_moves_alignment_rest_guard($prepared, $request) {
    $meta = $request->get_param('meta');
    if (!is_array($meta) || !array_intersect(array_keys($meta), array(DANCE_MOVES_META_BEAT_ALIGNMENT, DANCE_MOVES_META_ALIGNMENT_AUDIO, DANCE_MOVES_META_BPM))) { return $prepared; }
    $id = $request->get_param('id') ?: 0;
    $get = static function ($key) use ($meta, $id) { return array_key_exists($key, $meta) ? $meta[$key] : get_post_meta($id, $key, true); };
    $result = dance_moves_resolve_beat_alignment($get(DANCE_MOVES_META_BEAT_ALIGNMENT), $get(DANCE_MOVES_META_ALIGNMENT_AUDIO), $get(DANCE_MOVES_META_BPM));
    if (is_wp_error($result)) { $result->add_data(array('status' => 400)); return $result; }
    return $prepared;
}
add_filter('rest_pre_insert_page', 'dance_moves_alignment_rest_guard', 10, 2);
