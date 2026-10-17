<?php
/** Optional StemLab variable-tempo map. The old fixed-BPM alignment stays intact. */
if (!defined('ABSPATH')) { exit; }
define('DANCE_MOVES_META_BEAT_TIMELINE', '_dance_moves_beat_timeline');
define('DANCE_MOVES_META_USE_BEAT_TIMELINE', '_dance_moves_use_beat_timeline');

/** Parse an exported StemLab JSON (or a previously compacted WordPress value).
 * Never trust derived tempo/phase fields over the exact integer source frames.
 */
function dance_moves_parse_beat_timeline($value) {
    if (!is_string($value) || strlen($value) > 16 * 1024 * 1024) {
        return new WP_Error('dance_moves_tempo_size', 'Beat timeline JSON must be smaller than 16 MiB.');
    }
    if (trim($value) === '') { return null; }
    $data = json_decode($value, true, 16);
    if (!is_array($data) || ($data['schema'] ?? '') !== 'stemlab.beat-timeline.v1'
        || ($data['pips_per_beat'] ?? null) !== 64 || !is_array($data['source_audio'] ?? null)
        || !is_string($data['source_audio']['sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $data['source_audio']['sha256'])
        || !is_string($data['consensus_sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $data['consensus_sha256'])) {
        return new WP_Error('dance_moves_tempo_schema', 'Select a source-bound StemLab beat-timeline.v1 JSON with 64 pips per beat.');
    }
    $audio = $data['source_audio'];
    $sr = $audio['sample_rate'] ?? null;
    $frames = $audio['num_frames'] ?? null;
    $channels = $audio['num_channels'] ?? null;
    if (!is_int($sr) || $sr < 1 || $sr > 768000 || !is_int($frames) || $frames < 2 || $frames > 10000000000000
        || !is_int($channels) || $channels < 1 || $channels > 512) {
        return new WP_Error('dance_moves_tempo_audio', 'Invalid master source frame bounds, sample rate or channel count.');
    }
    $rows = $data['beats'] ?? null;
    $origin = $data['origin_beat'] ?? null;
    if (!is_array($rows) || count($rows) < 2 || count($rows) > 25000 || !is_int($origin) || $origin < 0 || $origin > 2147483647
        || !in_array($data['review_status'] ?? null, array('estimated','artist_confirmed'), true)) {
        return new WP_Error('dance_moves_tempo_beats', 'Need 2..25000 strictly ordered beat anchors and explicit approval status.');
    }
    $previous_beat = -1; $previous_frame = -1; $clean = array(); $seen = array(); $origin_frame = null;
    foreach ($rows as $row) {
        if (!is_array($row)) { return new WP_Error('dance_moves_tempo_anchor', 'Invalid beat anchor.'); }
        $beat = $row['beat'] ?? null; $frame = $row['frame'] ?? null;
        $kind = $row['source'] ?? null; $ref = $row['reference_frame'] ?? null;
        if (!is_int($beat) || $beat <= $previous_beat || $beat > 2147483647 || !is_int($frame) || $frame <= $previous_frame || $frame >= $frames
            || !in_array($kind, array('consensus','corrected','manual'), true)
            || ($ref !== null && (!is_int($ref) || $ref < 0 || $ref >= $frames))
            || ($kind === 'consensus' && $ref !== $frame) || ($kind === 'manual' && $ref !== null)
            || ($kind === 'corrected' && $ref === null) || ($ref !== null && isset($seen[$ref]))) {
            return new WP_Error('dance_moves_tempo_anchor', 'Beat indices, frames, or immutable consensus references are invalid.');
        }
        if ($ref !== null) { $seen[$ref] = true; }
        if ($origin === $beat) { $origin_frame = $frame; }
        $clean[] = array('beat'=>$beat,'frame'=>$frame,'source'=>$kind,'reference_frame'=>$ref);
        $previous_beat=$beat; $previous_frame=$frame;
    }
    if ($origin_frame === null) { return new WP_Error('dance_moves_tempo_origin', 'Beat 1 must identify one real anchor.'); }
    $a=$clean[0];$b=$clean[1];
    $offset = 64.0 * ($a['beat'] - $origin - ($a['frame'] / ($b['frame']-$a['frame']))*($b['beat']-$a['beat']));
    $sync = $data['sync'] ?? null;
    if ($sync !== null) {
        if (!is_array($sync) || ($sync['beat_1_index'] ?? null) !== $origin || ($sync['beat_1_source_frame'] ?? null) !== $origin_frame
            || ($sync['pips_per_beat'] ?? null) !== 64 || ($sync['canonical_first_beat_pip'] ?? null) !== 0
            || !is_numeric($sync['beat_1_start_seconds'] ?? null)
            || abs((float)$sync['beat_1_start_seconds'] - $origin_frame/$sr) > 0.0000001
            || !is_numeric($sync['sync_phase_offset_pips'] ?? null)
            || abs((float)$sync['sync_phase_offset_pips'] - $offset) > 0.0000001
            || !is_numeric($sync['beat_1_start_pips'] ?? null)
            || abs((float)$sync['beat_1_start_pips'] + $offset) > 0.0000001) {
            return new WP_Error('dance_moves_tempo_phase', 'Exported Beat 1 / phase offset contradicts beat frames.');
        }
        $exact = $sync['exact_phase_offset_pips'] ?? null;
        if (!is_string($exact) || !preg_match('/^-?\d{1,80}(?:\/[1-9]\d{0,79})?$/D', $exact)) {
            return new WP_Error('dance_moves_tempo_phase', 'Invalid exact phase offset.');
        }
        $parts = explode('/', $exact);
        $calculated=(float)$parts[0] / (float)($parts[1] ?? 1);
        if (!is_finite($calculated) || abs($calculated - $offset)>0.0000001) {
            return new WP_Error('dance_moves_tempo_phase', 'Exact phase offset contradicts source frames.');
        }
    }
    if (isset($data['beat_timeline'])) {
        if (!is_array($data['beat_timeline']) || count($data['beat_timeline']) !== count($clean)) {
            return new WP_Error('dance_moves_tempo_derived', 'Derived beat timeline has incorrect length.');
        }
        foreach ($data['beat_timeline'] as $i => $item) {
            if (!is_array($item) || ($item['beat'] ?? null) !== $clean[$i]['beat']
                || ($item['source_frame'] ?? null) !== $clean[$i]['frame']
                || ($item['pip'] ?? null) !== 64 * ($clean[$i]['beat']-$origin)
                || !is_numeric($item['time_seconds'] ?? null)
                || abs((float)$item['time_seconds'] - $clean[$i]['frame']/$sr) > 0.0000001) {
                return new WP_Error('dance_moves_tempo_derived', 'Derived beat timeline contradicts the exact source frames.');
            }
        }
    }
    if (isset($data['tempo_segments'])) {
        if (!is_array($data['tempo_segments']) || count($data['tempo_segments']) !== count($clean)-1) {
            return new WP_Error('dance_moves_tempo_derived', 'Tempo segments have incorrect length.');
        }
        foreach ($data['tempo_segments'] as $i => $item) {
            $a = $clean[$i];$b=$clean[$i+1];$expected = 60*$sr*($b['beat']-$a['beat'])/($b['frame']-$a['frame']);
            if (!is_array($item) || ($item['start_frame'] ?? null) !== $a['frame']
                || ($item['end_frame'] ?? null) !== $b['frame'] || !is_numeric($item['bpm'] ?? null)
                || abs((float)$item['bpm'] - $expected) > 0.0000001) {
                return new WP_Error('dance_moves_tempo_derived', 'Exported BPM contradicts beat frames.');
            }
        }
    }
    // Keep only the authoritative data needed to reproduce every source-frame beat.
    // Never localize arbitrary fields, machine paths, textual annotations or supplied URLs.
    return array('schema'=>'stemlab.beat-timeline.v1','pips_per_beat'=>64,
        'source_audio'=>array('sha256'=>$audio['sha256'],'sample_rate'=>$sr,'num_frames'=>$frames,'num_channels'=>$channels),
        'consensus_sha256'=>$data['consensus_sha256'],'origin_beat'=>$origin,
        'review_status'=>$data['review_status'],'beats'=>$clean);
}

function dance_moves_resolve_beat_timeline($json, $attachment_id) {
    $reading = dance_moves_parse_beat_timeline($json);
    if (!$reading || is_wp_error($reading)) { return $reading; }
    $id=absint($attachment_id);
    $file=get_attached_file($id);$url=dance_moves_attachment_url($id);
    if (!$file || !is_readable($file) || !$url || !str_starts_with((string)get_post_mime_type($id),'audio/')
        || filesize($file)>536870912 || hash_file('sha256',$file)!==$reading['source_audio']['sha256']) {
        return new WP_Error('dance_moves_tempo_master', 'Select the exact public master analysed by StemLab; source SHA-256 must match.');
    }
    $reading['source_url']=$url;
    return $reading;
}
function dance_moves_sanitize_beat_timeline($value) {
    $result=dance_moves_parse_beat_timeline($value);
    return !$result || is_wp_error($result) ? '' : wp_json_encode($result);
}
function dance_moves_timeline_rest_guard($prepared, $request) {
    $meta=$request->get_param('meta');
    if (!is_array($meta) || !array_intersect(array_keys($meta),array(
        DANCE_MOVES_META_BEAT_TIMELINE,DANCE_MOVES_META_USE_BEAT_TIMELINE,DANCE_MOVES_META_ALIGNMENT_AUDIO))) return $prepared;
    $id=$request->get_param('id') ?: 0;
    $get=static function($key)use($meta,$id){return array_key_exists($key,$meta)?$meta[$key]:get_post_meta($id,$key,true);};
    $enabled=in_array($get(DANCE_MOVES_META_USE_BEAT_TIMELINE),array(true,1,'1'),true);
    $reading=dance_moves_resolve_beat_timeline((string)$get(DANCE_MOVES_META_BEAT_TIMELINE),$get(DANCE_MOVES_META_ALIGNMENT_AUDIO));
    if (!$enabled && is_wp_error($reading)) { return $prepared; } // Unused invalid map cannot block fixed-BPM edits.
    if ($enabled && !$reading) { $reading=new WP_Error('dance_moves_tempo_missing','Enable variable tempo only with a valid map and verified master.'); }
    if (is_wp_error($reading)) { $reading->add_data(array('status'=>400));return $reading; }
    return $prepared;
}
add_filter('rest_pre_insert_page','dance_moves_timeline_rest_guard',10,2);
