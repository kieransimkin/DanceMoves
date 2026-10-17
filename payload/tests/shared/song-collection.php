<?php
/** Standalone PHP test of WordPress Page metadata boundaries; no live WP installation. */
define('ABSPATH',__DIR__);
class WP_Error {private $msg;public function __construct($key,$text){$this->msg=$text;}public function get_error_message(){return $this->msg;}public function add_data($value){} }
function is_wp_error($x){return $x instanceof WP_Error;}
function add_filter(...$a){}function add_action(...$a){}function add_shortcode(...$a){}
function register_post_meta(...$a){}function add_meta_box(...$a){}function absint($v){return max(0,abs((int)$v));}
function wp_json_encode($v){return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
function sanitize_text_field($v){return strip_tags((string)$v);}
function get_post_type($id){return isset($GLOBALS['files'][(int)$id])?'attachment':'page';}
function get_post_mime_type($id){return ($GLOBALS['files'][(int)$id]['mime']??'');}
function get_attached_file($id){return $GLOBALS['files'][(int)$id]['path']??'';}
function dance_moves_attachment_url($id){return isset($GLOBALS['files'][(int)$id])?'https://example.test/uploads/'.$id:'';}
function dance_moves_validate_timing_attachment($id,$kind){return !$id ? true : (in_array(strtolower(pathinfo(get_attached_file($id),PATHINFO_EXTENSION)),
  $kind==='lyric'?array('lrc'):array('lrc','cue'),true) ? true : new WP_Error('bad','Invalid timing'));}
function dance_moves_resolve_beat_alignment($json,$id,$bpm=''){return $json===''?null:new WP_Error('bad','Unexpected fixed map');}
function dance_moves_resolve_beat_timeline($json,$id){return $json===''?null:new WP_Error('bad','Unexpected variable map');}
function get_post_meta($id,$key,$single=true){return $GLOBALS['meta'][$key]??'';}
function get_the_ID(){return 12;}
function esc_attr($s){return htmlspecialchars((string)$s,ENT_QUOTES);}
function esc_html($s){return htmlspecialchars((string)$s,ENT_QUOTES);}
function esc_url($s){return htmlspecialchars((string)$s,ENT_QUOTES);}
function esc_textarea($s){return htmlspecialchars((string)$s,ENT_QUOTES);}
function checked($a,$b,$echo=true){$s=$a==$b?' checked="checked"':'';if($echo)echo $s;return $s;}
function selected($a,$b,$echo=true){$s=$a==$b?' selected="selected"':'';if($echo)echo $s;return $s;}
function wp_nonce_field(...$a){}function is_admin(){return false;}
function is_singular($p){return true;}function is_main_query(){return true;}function in_the_loop(){return true;}function has_shortcode($s,$tag){return str_contains($s,'['.$tag.']');}
function wp_verify_nonce(...$args){return true;}function wp_unslash($a){return $a;}function current_user_can(...$a){return true;}
function update_post_meta($post,$name,$value){$GLOBALS['meta'][$name]=$value;}
function dance_moves_queue_admin_error($s){throw new RuntimeException($s);}
require dirname(__DIR__,2).'/dance-moves-song-collection.php';
$dir=sys_get_temp_dir().'/dm-song-'.uniqid();mkdir($dir);
$GLOBALS['files']=array();$GLOBALS['meta']=array();
function asset($id,$name,$contents,$mime){global $dir;$path=$dir.'/'.$id.'-'.$name;file_put_contents($path,$contents);$GLOBALS['files'][$id]=array('path'=>$path,'mime'=>$mime);return $id;}
$audio=asset(100,'master.wav',str_repeat("\0",2048),'audio/wav');
$word=asset(101,'words.tsv',"start\tend\tprobability\tword\n0.125\t0.5\t0.9\tHello\n0.55\t0.7\t0.8\tworld",'text/tab-separated-values');
$lrc=asset(102,'lines.lrc',"[00:00.12]Hello world",'text/plain');
$cue=asset(103,'cues.cue',"[00:00.12][CUE: Intro]",'text/plain');
$checks=0;
function check($ok,$label){global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
try {
 check(dance_moves_validate_word_timing_attachment(101)===2,'StemLab TSV validates');
 check(dance_moves_word_timing_contents('{"words":[{"start":0.1,"end":0.3,"word":"Hello"}]}','json')===1,'JSON validates');
 check(dance_moves_word_timing_contents('[00:00.10]<00:00.12>Hi <00:00.36>there','lrc')===2,'enhanced LRC validates');
 check(is_wp_error(dance_moves_word_timing_contents("start\tend\tword\n2\t3\tlater\n1\t1.5\tearlier",'tsv')),'order fails');
 check(is_wp_error(dance_moves_word_timing_contents('{"words":[{"start":0.1,"end":-0.2,"word":"x"}]}','json')),'bad end fails');
 $row=array('id'=>'a_song','title'=>'Album track','audio_id'=>$audio,'bpm'=>120,
   'lyric_id'=>$lrc,'word_id'=>$word,'cue_id'=>$cue,'use_beat_timeline'=>false);
 $r=dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($row)));
 check(!is_wp_error($r)&&$r['songs'][0]['word_id']===$word,'valid song and word reference');
 check(!isset($r['songs'][0]['audioSrc']),'no URLs stored in metadata');
 $GLOBALS['meta'][DANCE_MOVES_META_SONG_PAGE_TYPE]='collection';
 $GLOBALS['meta'][DANCE_MOVES_META_SONG_COLLECTION]=wp_json_encode($r);
 $out=dance_moves_song_collection_config(12);
 check($out['songs'][0]['wordTimingUrl']==='https://example.test/uploads/101','word URL resolved by attachment');
 check($out['songs'][0]['audioSrc']==='https://example.test/uploads/100','master URL resolved');
 $html=dance_moves_render_song_collection();
 check(str_contains($html,'data-dance-moves-song="a_song"')&&str_contains($html,'data-dance-moves-lane="word"'),'song UI and word lane');
 ob_start();dance_moves_song_collection_meta_box((object)array('ID'=>12));$admin=ob_get_clean();
 check(str_contains($admin,'dance-moves-song-template')&&str_contains($admin,'__INDEX__'),'repeatable editor template');
 check(str_contains(dance_moves_song_collection_content('<p>Story</p>'),'dance-moves-song-collection'),'auto appended Page content');
 check(!str_contains(dance_moves_song_collection_content('[dance_moves_song_collection]'),'data-dance-moves-song="a_song"'),'shortcode not duplicated');
 $bad=$row;$bad['bpm']=10;
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($bad)))),'invalid BPM');
 $bad=$row;$bad['audio_id']=999;
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($bad)))),'missing master');
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($row,$row)))),'duplicate ids');
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array()))),'empty song list refused');
 $bad=$row;$bad['use_beat_timeline']=true;
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($bad)))),'missing beat map cannot enable');
 $badword=asset(104,'bad.tsv',"start\tend\tword\n1.5\t2.0\thello\n0.1\t0.2\tbad",'text/plain');
 $bad=$row;$bad['word_id']=$badword;
 check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array($bad)))),'bad word file refused');
 echo "PASS word timing and song collection ($checks checks)\n";
} finally {foreach(glob($dir.'/*')as $p)unlink($p);rmdir($dir);}
