<?php
/** Actual PHP adapter with isolated WordPress boundaries; no live-site deployment. */
define('ABSPATH',__DIR__);
class WP_Error {
    public $code; public $message; public $data;
    public function __construct($code,$message,$data=null) {$this->code=$code;$this->message=$message;$this->data=$data;}
    public function get_error_message() {return $this->message;}
    public function add_data($data) {$this->data=$data;}
}
function is_wp_error($value) {return $value instanceof WP_Error;}
function add_action(...$args) {$GLOBALS['actions'][]=$args;}
function add_filter(...$args) {$GLOBALS['filters'][]=$args;}
function add_shortcode($tag,$callback) {$GLOBALS['shortcodes'][$tag]=$callback;}
function register_post_meta($type,$name,$args) {$GLOBALS['registered'][$name]=$args;}
function add_meta_box(...$args) {$GLOBALS['boxes'][]=$args;}
function absint($value) {return abs((int)$value);}
function wp_json_encode($value) {return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
function sanitize_text_field($value) {return is_scalar($value) ? strip_tags((string)$value) : '';}
function sanitize_key($value) {return preg_replace('/[^a-z0-9_\-]/','',strtolower((string)$value));}
function esc_attr($value) {return htmlspecialchars((string)$value,ENT_QUOTES);}
function esc_html($value) {return htmlspecialchars((string)$value,ENT_QUOTES);}
function esc_textarea($value) {return htmlspecialchars((string)$value,ENT_QUOTES);}
function esc_url($value) {return htmlspecialchars((string)$value,ENT_QUOTES);}
function esc_url_raw($value) {return (string)$value;}
function selected($a,$b,$echo=true) {$value=$a===$b?' selected="selected"':'';if($echo)echo $value;return $value;}
function checked($a,$b=true,$echo=true) {$value=$a===$b?' checked="checked"':'';if($echo)echo $value;return $value;}
function get_post_meta($id,$key,$single=true) {return $GLOBALS['meta'][$id][$key] ?? '';}
function update_post_meta($id,$key,$value) {$GLOBALS['meta'][$id][$key]=$value;}
function delete_post_meta($id,$key) {unset($GLOBALS['meta'][$id][$key]);}
function get_the_ID() {return $GLOBALS['page'];}
function get_post_type($id) {return isset($GLOBALS['files'][$id])?'attachment':'page';}
function get_post_mime_type($id) {return $GLOBALS['files'][$id]['mime'] ?? '';}
function get_attached_file($id) {return $GLOBALS['files'][$id]['path'] ?? '';}
function wp_get_attachment_url($id) {return $GLOBALS['files'][$id]['url'] ?? '';}
function get_allowed_mime_types() {return $GLOBALS['allowed_mimes'] ?? array('json'=>'application/json');}
function wp_check_filetype($filename,$mimes=null) {
    $mimes=$mimes ?? get_allowed_mime_types();$ext=strtolower(pathinfo($filename,PATHINFO_EXTENSION));
    return array('ext'=>isset($mimes[$ext])?$ext:false,'type'=>$mimes[$ext] ?? false);
}
function wp_nonce_field(...$args) {}
function wp_unslash($value) {return $value;}
function wp_verify_nonce(...$args) {return $GLOBALS['nonce'];}
function current_user_can(...$args) {return $GLOBALS['allowed'];}
function get_current_user_id() {return 7;}
function set_transient($name,$value,$seconds) {$GLOBALS['transients'][$name]=$value;}
function is_admin() {return false;}
function is_singular($type) {return $type==='page';}
function is_main_query() {return true;}
function in_the_loop() {return true;}
function has_shortcode($content,$tag) {return str_contains($content,'['.$tag);}
function plugin_dir_url($file) {return 'https://example.test/plugins/dancemoves/';}
function get_queried_object_id() {return $GLOBALS['page'];}
function is_page($id=0) {return true;}
function wp_enqueue_style($name,$src,$deps=array(),$version=false) {$GLOBALS['styles'][$name]=array('src'=>$src,'deps'=>$deps);}
function wp_enqueue_script($name,$src=false,$deps=array(),$version=false,$footer=false) {$GLOBALS['scripts'][$name]=array('src'=>$src,'deps'=>$deps);}
function wp_localize_script($handle,$name,$data) {$GLOBALS['localized'][$name]=$data;}
require dirname(__DIR__,2).'/kieran-epk-device-orientation.php';

$dir=sys_get_temp_dir().'/dm-spectrum-'.uniqid();mkdir($dir);
$GLOBALS['files']=array();$GLOBALS['meta']=array();$GLOBALS['page']=901;
$GLOBALS['nonce']=true;$GLOBALS['allowed']=true;$GLOBALS['transients']=array();
$checks=0;
function check($condition,$label) {global $checks;if(!$condition)throw new RuntimeException($label);$checks++;}
function asset($id,$name,$mime,$contents='{}') {
    global $dir;$path=$dir.'/'.$id.'-'.$name;file_put_contents($path,$contents);
    $GLOBALS['files'][$id]=array('path'=>$path,'mime'=>$mime,'url'=>'https://example.test/uploads/'.$id.'-'.$name);
    return $id;
}
function request_meta($meta) {
    return new class($meta) {
        private $meta;
        public function __construct($meta) {$this->meta=$meta;}
        public function get_param($name) {return $name==='meta'?$this->meta:901;}
    };
}
try {
    $first=asset(101,'first.json','application/json','{"format":"dancerudiments.recording","samples":[[0.5]]}');
    $second=asset(102,'second.json','text/plain');
    $master=asset(103,'master.wav','audio/wav',str_repeat("\0",128));
    $wrong_ext=asset(104,'bad.php','application/json');
    $wrong_mime=asset(105,'bad.json','application/x-php');
    $empty=asset(106,'empty.json','application/json','');
    $oversized=asset(107,'big.json','application/json');
    $stream=fopen(get_attached_file($oversized),'wb');ftruncate($stream,DANCE_MOVES_SPECTRUM_MAX_BYTES+1);fclose($stream);

    check(dance_moves_validate_spectrum_attachment($first)===true,'JSON attachment accepted');
    check(dance_moves_validate_spectrum_attachment((string)$second)===true,'WordPress numeric string and text MIME accepted');
    check(dance_moves_validate_spectrum_attachment(0)===true,'unconfigured attachment is optional');
    foreach (array(-1,1.5,true,array(101),'101junk',999,$wrong_ext,$wrong_mime,$empty,$oversized) as $bad) {
        check(is_wp_error(dance_moves_validate_spectrum_attachment($bad)),'invalid attachment ID, type, missing or oversized file rejected');
    }
    check(dance_moves_sanitize_spectrum_attachment_id($wrong_mime)===0,'invalid programmatic attachment sanitized away');
    check(dance_moves_sanitize_spectrum_attachment_id((string)$first)===$first,'valid programmatic ID retained');
    $original_url=$GLOBALS['files'][$first]['url'];
    foreach (array('javascript:alert(1)','https://person:secret@example.test/file.json',"/a\nb.json") as $url) {
        $GLOBALS['files'][$first]['url']=$url;
        check(is_wp_error(dance_moves_validate_spectrum_attachment($first)),'unsafe attachment URL rejected');
    }
    $GLOBALS['files'][$first]['url']=$original_url;

    // Match the official exporter's sorted keys: clock/dimensions precede format;
    // schema_version follows the large samples array. No real song data is used.
    $large=asset(108,'large-native.json','application/json');
    $native_header='{"clock":{"beat_zero_seconds":0,"bpm":120,"bpm_source":"synthetic test","bpm_status":"confirmed","phase_status":"supplied","start_pip":0},"dimensions":["band_000"],"format":"dancerudiments.recording","name":"synthetic","pips_per_beat":64,"provenance":{},"sample_decimals":12,"sample_dtype":"float64","samples":[';
    $stream=fopen(get_attached_file($large),'wb');fwrite($stream,$native_header);
    for ($chunk=0;$chunk<1024;$chunk++) fwrite($stream,str_repeat('[0.125],',1024));
    fwrite($stream,'[0.125]],"schema_version":1}');fclose($stream);
    $denied=array('ext'=>false,'type'=>false,'proper_filename'=>false);
    $accepted=array('ext'=>'json','type'=>'application/json','proper_filename'=>false);
    $peak_before=memory_get_peak_usage(true);
    $fixed=dance_moves_spectrum_filetype($denied,get_attached_file($large),'large-native.json',null,'text/plain');
    check($fixed===$accepted,'large native JSON misidentified as plain text gets the allowed JSON MIME');
    check(memory_get_peak_usage(true)-$peak_before<=2097152,'MIME recognition reads bounded header rather than large samples');
    check(filesize(get_attached_file($large))>8388608,'upload regression covers a real file larger than 8 MiB');
    if (class_exists('finfo')) {
        $detected=(new finfo(FILEINFO_MIME_TYPE))->file(get_attached_file($large));
        check(in_array($detected,array('text/plain','application/json','application/octet-stream'),true),'native recording actual MIME is an expected JSON/text classification');
        $core_check=$detected==='text/plain'?$denied:$accepted;
        check(dance_moves_spectrum_filetype($core_check,get_attached_file($large),'large-native.json',null,$detected)===$accepted,'actual libmagic classification remains uploadable');
    }
    foreach (array('text/html','application/x-php','application/octet-stream',false) as $mime) {
        check(dance_moves_spectrum_filetype($denied,get_attached_file($large),'large-native.json',null,$mime)===$denied,'MIME fallback never overrides non-plain-text decisions');
    }
    check(dance_moves_spectrum_filetype($denied,get_attached_file($large),'large-native.php',null,'text/plain')===$denied,'MIME fallback cannot authorize executable extensions');
    check(dance_moves_spectrum_filetype($denied,get_attached_file($large),'large-native.json',array(),'text/plain')===$denied,'explicit MIME restrictions remain authoritative');
    $GLOBALS['allowed_mimes']=array();
    check(dance_moves_spectrum_filetype($denied,get_attached_file($large),'large-native.json',array('json'=>'application/json'),'text/plain')===$denied,'global MIME restrictions remain authoritative');
    unset($GLOBALS['allowed_mimes']);
    check(dance_moves_spectrum_filetype($denied,get_attached_file($oversized),'big.json',null,'text/plain')===$denied,'oversized uploads remain refused');
    $lookalike=asset(109,'lookalike.json','text/plain','{"nested":{"format":"dancerudiments.recording"}}');
    check(dance_moves_spectrum_filetype($denied,get_attached_file($lookalike),'lookalike.json',null,'text/plain')===$denied,'nested native-format lookalike is not a recording header');
    $unrelated=asset(110,'other.json','text/plain','{"words":[{"word":"Hello","start":0,"end":1}]}');
    check(dance_moves_spectrum_filetype($denied,get_attached_file($unrelated),'other.json',null,'text/plain')===$denied,'unrelated JSON retains existing MIME decision');
    $late=asset(111,'late.json','text/plain','{"samples":['.str_repeat('[0.125],',1024).'[0.125]],"format":"dancerudiments.recording"}');
    check(dance_moves_spectrum_filetype($denied,get_attached_file($late),'late.json',null,'text/plain')===$denied,'noncanonical late format beyond the sniff bound is not guessed');
    check(dance_moves_spectrum_filetype($accepted,get_attached_file($late),'late.json',null,'text/plain')===$accepted,'already accepted JSON keeps its original core MIME decision');

    $plain=dance_moves_get_page_config(901);
    check($plain['spectrumRecordingUrl']==='' && $plain['spectrumRenderer']==='spectrum','single-song metadata defaults preserved');
    check(dance_moves_render_spectrum()==='','no shortcode canvas without a configured attachment');
    $GLOBALS['styles']=array();ks_epk_orientation_enqueue_runtime();
    check(!isset($GLOBALS['styles']['dance-moves-spectrum']),'unconfigured Page does not enqueue spectrum styles');
    $GLOBALS['meta'][901]=array(DANCE_MOVES_META_SPECTRUM_RECORDING=>$first,DANCE_MOVES_META_SPECTRUM_RENDERER=>'spectrum-ring');
    $GLOBALS['meta'][902]=array(DANCE_MOVES_META_SPECTRUM_RECORDING=>$second,DANCE_MOVES_META_SPECTRUM_RENDERER=>'spectrum-line');
    $page_a=dance_moves_get_page_config(901);$page_b=dance_moves_get_page_config(902);
    check($page_a['spectrumRecordingUrl']===$original_url && $page_a['spectrumRenderer']==='spectrum-ring','Page resolves its own recording and renderer');
    check($page_b['spectrumRecordingUrl']===$GLOBALS['files'][$second]['url'],'another Page resolves its own recording');
    check(!str_contains(wp_json_encode($page_a),'second.json') && !str_contains(wp_json_encode($page_a),'samples'),'no other song or samples localized on the Page');
    ks_epk_orientation_enqueue_runtime();
    check(str_ends_with($GLOBALS['styles']['dance-moves-spectrum']['src'],'/lib/styles/spectrum.css'),'configured Page loads the shared spectrum stylesheet');
    check(!str_contains(wp_json_encode($GLOBALS['localized']['danceMovesConfig']),'samples'),'WordPress boot localization contains no spectrum sample data');
    check($GLOBALS['shortcodes']['dance_moves_spectrum']==='dance_moves_render_spectrum','shortcode registered');
    $html=dance_moves_render_spectrum();
    check(str_contains($html,'<canvas') && str_contains($html,'data-dance-moves-spectrum-renderer="spectrum-ring"'),'shortcode renders page-selected shared-runtime canvas');
    check(str_contains($html,'role="img"') && str_contains($html,'role="status"') && str_contains($html,'audio controls remain available'),'accessible image label, status and fallback');
    check(!str_contains($html,'.json') && !str_contains($html,'samples') && !str_contains($html,'<script'),'shortcode contains no data payload, fetch or engine');
    $override=dance_moves_render_spectrum(array('renderer'=>'spectrum-spiral','label'=>'<script>bad</script>" onerror="bad'));
    check(str_contains($override,'data-dance-moves-spectrum-renderer="spectrum-spiral"') && !str_contains($override,'<script>') && !str_contains($override,'" onerror="'),'shortcode override allowlist and escaped label');
    check(str_contains(dance_moves_render_spectrum(array('label'=>'<b></b>')),'aria-label="Dance-rudiment spectrum"'),'empty sanitized shortcode label keeps an accessible default');
    preg_match('/aria-describedby="([^"]+)"/',$html,$one);preg_match('/aria-describedby="([^"]+)"/',$override,$two);
    check($one[1]!==$two[1],'multiple canvases have distinct associated status IDs');

    dance_moves_register_spectrum_meta();
    foreach (array(DANCE_MOVES_META_SPECTRUM_RECORDING,DANCE_MOVES_META_SPECTRUM_RENDERER) as $key) {
        check($GLOBALS['registered'][$key]['revisions_enabled']===true && $GLOBALS['registered'][$key]['auth_callback']==='dance_moves_meta_auth','metadata requires editor permissions and participates in revisions');
        check(in_array($key,dance_moves_spectrum_revision_meta_keys(array()),true),'explicit revision keys include spectrum');
    }
    check(count($GLOBALS['registered'][DANCE_MOVES_META_SPECTRUM_RENDERER]['show_in_rest']['schema']['enum'])===10,'all ten renderer styles exposed by REST schema');
    $prepared=(object)array('ID'=>901);
    check(dance_moves_spectrum_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_SPECTRUM_RECORDING=>$first)))===$prepared,'REST accepts valid attachment');
    check(is_wp_error(dance_moves_spectrum_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_SPECTRUM_RECORDING=>$wrong_mime)))),'REST rejects invalid attachment before save');
    check(is_wp_error(dance_moves_spectrum_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_SPECTRUM_RENDERER=>'bogus')))),'REST rejects unknown renderer before save');
    $earlier_error=new WP_Error('earlier','Already invalid');
    check(dance_moves_spectrum_rest_guard($earlier_error,request_meta(array()))===$earlier_error,'REST preserves an earlier validation error');
    $_POST=array('dance_moves_spectrum_nonce'=>'valid','dance_moves_spectrum_recording_id'=>$second,'dance_moves_spectrum_renderer'=>'spectrum-area');
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)===$second && get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RENDERER,true)==='spectrum-area','admin saves attachment ID and renderer only');
    $_POST['dance_moves_spectrum_recording_id']=$wrong_mime;
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)===$second && !empty($GLOBALS['transients']),'admin preserves previous selection on invalid file');
    $_POST['dance_moves_spectrum_recording_id']=$first;$_POST['dance_moves_spectrum_renderer']='invalid';
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)===$second,'invalid renderer cannot partially replace file');
    $_POST['dance_moves_spectrum_renderer']='spectrum';$GLOBALS['allowed']=false;
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)===$second,'permission gate protects spectrum updates');
    $GLOBALS['allowed']=true;$GLOBALS['nonce']=false;
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)===$second,'nonce gate protects spectrum updates');
    $GLOBALS['nonce']=true;
    ob_start();dance_moves_spectrum_meta_box((object)array('ID'=>901));$admin=ob_get_clean();
    check(str_contains($admin,'dance_moves_spectrum_recording_id') && str_contains($admin,'data-allowed-extensions="json"') && str_contains($admin,'dance_moves_spectrum_renderer'),'Page editor uses existing Media Library selector and style field');

    $song=array('id'=>'first','title'=>'First song','audio_id'=>$master,'bpm'=>120,
        'spectrum_recording_id'=>$first,'spectrum_renderer'=>'spectrum-dots','samples'=>array(array(0.1)),
        'spectrumRecordingUrl'=>'https://untrusted.example.test/ignored.json');
    $other=array('id'=>'second','title'=>'Second song','audio_id'=>$master,'bpm'=>120);
    $collection=array('schema'=>'dancemoves.song-collection.v1','songs'=>array($song,$other));
    $clean=dance_moves_validate_song_collection($collection);
    check(!is_wp_error($clean) && $clean['songs'][0]['spectrum_recording_id']===$first,'song collection validates each recording attachment');
    check(!str_contains(wp_json_encode($clean),'samples') && !str_contains(wp_json_encode($clean),'untrusted.example'),'sample arrays and arbitrary URLs never enter saved collection metadata');
    check($clean['songs'][1]['spectrum_recording_id']===0 && $clean['songs'][1]['spectrum_renderer']==='spectrum','old collection rows retain optional defaults');
    $GLOBALS['meta'][901][DANCE_MOVES_META_SONG_PAGE_TYPE]='collection';
    $GLOBALS['meta'][901][DANCE_MOVES_META_SONG_COLLECTION]=wp_json_encode($clean);
    $resolved=dance_moves_song_collection_config(901);
    check($resolved['songs'][0]['spectrumRecordingUrl']===$original_url && $resolved['songs'][1]['spectrumRecordingUrl']==='','recording references are resolved independently per song');
    $markup=dance_moves_render_song_collection();
    check(substr_count($markup,'<canvas')===1 && str_contains($markup,'spectrum-dots'),'only configured song gets a canvas next to its player');
    check(!str_contains($markup,'samples') && !str_contains($markup,'.json'),'collection markup contains no embedded song data');
    check(dance_moves_render_spectrum()==='','single-song shortcode does not make a second collection owner');
    delete_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING);
    $GLOBALS['styles']=array();ks_epk_orientation_enqueue_runtime();
    check(isset($GLOBALS['styles']['dance-moves-spectrum']),'collection spectrum enables styles without single-song metadata');
    $bad=$collection;$bad['songs'][0]['spectrum_recording_id']=$wrong_mime;
    check(is_wp_error(dance_moves_validate_song_collection($bad)),'collection save rejects invalid spectrum attachment');
    $bad=$collection;$bad['songs'][0]['spectrum_renderer']='bogus';
    check(is_wp_error(dance_moves_validate_song_collection($bad)),'collection save rejects invalid renderer');
    ob_start();dance_moves_song_collection_row($song,0);$row_markup=ob_get_clean();
    check(str_contains($row_markup,'dance_moves_songs[0][spectrum_recording_id]') && str_contains($row_markup,'dance_moves_songs[0][spectrum_renderer]'),'each collection editor row owns its recording and renderer');
    unlink(get_attached_file($first));clearstatcache();
    $missing=dance_moves_song_collection_config(901);
    check(is_array($missing) && $missing['songs'][0]['spectrumRecordingUrl']==='' && $missing['songs'][0]['audioSrc']!=='','deleted optional recording leaves song audio available');
    $_POST=array('dance_moves_spectrum_nonce'=>'valid','dance_moves_spectrum_recording_id'=>'','dance_moves_spectrum_renderer'=>'spectrum');
    dance_moves_save_spectrum_meta(901);
    check(get_post_meta(901,DANCE_MOVES_META_SPECTRUM_RECORDING,true)==='','clearing spectrum leaves original single-song metadata intact');
    echo "PASS page-owned spectrum metadata, shortcode and song isolation ($checks checks)\n";
} finally {
    foreach (glob($dir.'/*') as $path) unlink($path);
    rmdir($dir);
}
