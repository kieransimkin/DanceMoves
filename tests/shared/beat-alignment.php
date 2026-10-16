<?php
/** Real metadata parser/hash/REST guard; this is separate from live WordPress HTTP QA. */
define('ABSPATH', __DIR__);
define('DANCE_MOVES_META_BPM', '_dance_moves_bpm');
class WP_Error { public $code; public function __construct($code, $message) { $this->code=$code; } public function add_data($data) {} }
function is_wp_error($value) { return $value instanceof WP_Error; }
function add_filter(...$args) {}
function absint($value) { return abs((int)$value); }
function get_attached_file($id) { global $file; return $id===42 ? $file : ''; }
function get_post_mime_type($id) { return $id===42 ? 'audio/wav' : ''; }
function dance_moves_attachment_url($id) { return $id===42 ? 'https://example.test/master.mp3' : ''; }
function wp_json_encode($data) { return json_encode($data); }
function get_post_meta($id,$key,$single=true) { return ''; }
require dirname(__DIR__,2).'/dance-moves-beat-alignment.php';
$file=tempnam(sys_get_temp_dir(),'dm-alignment');file_put_contents($file,'synthetic master identity');
$checks=0;
function check($condition,$label) { global $checks; if (!$condition) {throw new RuntimeException($label);} ++$checks; }
try {
    $reading=array('schema'=>'stemlab.beat-alignment.v1','source_sha256'=>hash_file('sha256',$file),
        'source_audio_verified'=>true,'source_audio'=>array('sample_rate'=>48000,'num_frames'=>480000),
        'bpm'=>120,'exact_bpm'=>'120','bpm_basis'=>'canonical','bpm_status'=>'canonical','phase_status'=>'estimated',
        'analysis_id'=>'consensus','evidence_sha256'=>str_repeat('b',64),'report_sha256'=>str_repeat('c',64),
        'first_beat_seconds'=>0.125,'first_beat_exact_seconds'=>'1/8','offset_pips'=>-16,'exact_offset_pips'=>'-16',
        'pips_per_beat'=>64,'canonical_first_beat_pip'=>0,'private_path'=>'Z:/private/never-public');
    $json=json_encode($reading);
    $valid=dance_moves_resolve_beat_alignment($json,42,120);
    check(!is_wp_error($valid) && $valid['phase_status']==='estimated','valid estimated reading');
    check(!isset($valid['private_path']),'unknown private fields omitted');
    check($valid['exact_offset_pips']==='-16','fractional clock identity retained');
    check(is_wp_error(dance_moves_resolve_beat_alignment($json,41,120)),'wrong attachment refused');
    check(is_wp_error(dance_moves_resolve_beat_alignment($json,42,145)),'BPM conflict refused');
    foreach (array(array('exact_offset_pips'=>'-15'),array('offset_pips'=>0),array('source_audio_verified'=>false),array('first_beat_seconds'=>10),array('pips_per_beat'=>16)) as $change) {
        check(is_wp_error(dance_moves_parse_beat_alignment(json_encode(array_merge($reading,$change)))),'bad reading refused');
    }
    $request=new class($json) {
        public $json; public function __construct($json) {$this->json=$json;}
        public function get_param($key) {return $key==='meta' ? array('_dance_moves_beat_alignment'=>$this->json,'_dance_moves_beat_alignment_audio_id'=>41) : 1;}
    };
    check(is_wp_error(dance_moves_alignment_rest_guard((object)array(),$request)),'REST rejects before content/meta commit');
    file_put_contents($file,'changed master');
    check(is_wp_error(dance_moves_resolve_beat_alignment($json,42,120)),'changed attachment bytes refused');
    check(dance_moves_parse_beat_alignment('')===null,'blank is unavailable, not confirmed zero');
    echo "PASS beat alignment metadata ($checks checks)\n";
} finally {unlink($file);}
