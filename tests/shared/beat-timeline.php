<?php
/** Standalone PHP regression: no WordPress installation needed. */
define('ABSPATH',__DIR__);
define('DANCE_MOVES_META_ALIGNMENT_AUDIO', '_dance_moves_beat_alignment_audio_id');
class WP_Error {
    public $code; public $message;
    public function __construct($code,$message){$this->code=$code;$this->message=$message;}
    public function add_data($value){}
    public function get_error_message(){return $this->message;}
}
function is_wp_error($x){return $x instanceof WP_Error;}
function add_filter(...$args){}
function absint($x){return abs((int)$x);}
function wp_json_encode($x){return json_encode($x);}
function get_attached_file($id){global $file;return $id===42?$file:'';}
function get_post_mime_type($id){return $id===42?'audio/wav':'';}
function dance_moves_attachment_url($id){return $id===42?'https://example.test/master.wav':'';}
function get_post_meta($id,$key,$single=true){return '';}
require dirname(__DIR__,2).'/dance-moves-beat-timeline.php';
$checks=0;function ok($value,$label){global $checks;if(!$value)throw new RuntimeException($label);$checks++;}
$file=tempnam(sys_get_temp_dir(),'dmtempo');file_put_contents($file,'A master audio byte identity');
try {
    $frames=array(1000,5000,9000,14160,18080);
    $rows=array();$derived=array();$segments=array();
    foreach($frames as $i=>$f){$rows[]=array('beat'=>$i,'frame'=>$f,'source'=>'consensus','reference_frame'=>$f);
        $derived[]=array('beat'=>$i,'source_frame'=>$f,'pip'=>$i*64,'time_seconds'=>$f/8000);}
    for($i=0;$i<count($frames)-1;$i++)$segments[]=array('start_frame'=>$frames[$i],'end_frame'=>$frames[$i+1],
        'bpm'=>60*8000/($frames[$i+1]-$frames[$i]));
    $map=array('schema'=>'stemlab.beat-timeline.v1','pips_per_beat'=>64,
        'source_audio'=>array('sha256'=>hash_file('sha256',$file),'sample_rate'=>8000,'num_frames'=>24000,'num_channels'=>1),
        'consensus_sha256'=>str_repeat('b',64),'origin_beat'=>0,'review_status'=>'estimated','beats'=>$rows,
        'beat_timeline'=>$derived,'tempo_segments'=>$segments,
        'sync'=>array('beat_1_index'=>0,'beat_1_source_frame'=>1000,'beat_1_start_seconds'=>.125,
            'beat_1_start_pips'=>16,'sync_phase_offset_pips'=>-16,'exact_phase_offset_pips'=>'-16',
            'canonical_first_beat_pip'=>0,'pips_per_beat'=>64),
        'private_path'=>'C:/Users/private/none');
    $value=json_encode($map,JSON_THROW_ON_ERROR);$parsed=dance_moves_parse_beat_timeline($value);
    ok(!is_wp_error($parsed) && count($parsed['beats'])===5,'whole irregular map parsed');
    ok(!isset($parsed['private_path'])&&!isset($parsed['tempo_segments']),'derived/private inputs removed');
    ok(!is_wp_error(dance_moves_resolve_beat_timeline($value,42)),'matching master accepted');
    ok(is_wp_error(dance_moves_resolve_beat_timeline($value,41)),'wrong master refused');
    ok(dance_moves_parse_beat_timeline('')===null,'optional missing map null');
    foreach (array(
      static function(&$d){$d['sync']['sync_phase_offset_pips']=-15;},
      static function(&$d){$d['beat_timeline'][2]['pip']=129;},
      static function(&$d){$d['tempo_segments'][1]['bpm']=100;},
      static function(&$d){$d['beats'][1]['frame']=9000;},
      static function(&$d){$d['origin_beat']=20;},
      static function(&$d){$d['source_audio']['sha256']=str_repeat('z',64);},
      static function(&$d){$d['beats'][1]['source']='manual';},
      static function(&$d){$d['pips_per_beat']=16;}
    ) as $fault){$d=$map;$fault($d);ok(is_wp_error(dance_moves_parse_beat_timeline(json_encode($d))), 'reject forged identity/derived clocks');}
    $request=new class($value){public $json;public function __construct($j){$this->json=$j;}
      public function get_param($name){if($name==='id')return 1; if($name==='meta')return array(
        '_dance_moves_beat_timeline'=>$this->json,'_dance_moves_use_beat_timeline'=>true,
        '_dance_moves_beat_alignment_audio_id'=>41); return null;}};
    ok(is_wp_error(dance_moves_timeline_rest_guard((object)array(),$request)),'REST rejects before committing');
    file_put_contents($file,'corrupted audio');
    ok(is_wp_error(dance_moves_resolve_beat_timeline($value,42)),'master changed on disk refused');
    echo "PASS optional variable-tempo WordPress metadata ($checks checks)\n";
} finally {unlink($file);}
