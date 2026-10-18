<?php
/** Exercise the real PHP adapter through isolated WordPress boundaries, using synthetic files. */
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

$dir=sys_get_temp_dir().'/dm-visualiser-'.uniqid();mkdir($dir);
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
function generic_form($id=0,$renderer='waveform',$rudiment='',$axes='') {
    return array('dance_moves_visualiser_nonce'=>'valid','dance_moves_visualiser_recording_id'=>$id,
        'dance_moves_visualiser_renderer'=>$renderer,'dance_moves_visualiser_rudiment'=>$rudiment,'dance_moves_visualiser_axes'=>$axes);
}
try {
    $catalogue=dance_moves_visualiser_catalogue();
    $mirror=json_decode(file_get_contents(dirname(__DIR__,2).'/assets/visualiser-catalogue.json'),true);
    check(array_values($catalogue)===$mirror,'PHP reads the exact shared trusted renderer metadata');
    check(count($catalogue)===164 && isset($catalogue['path'],$catalogue['spatial-torus']) && in_array('spectrogram',array_column($catalogue,'family'),true),'all motion, history, spectrum and 3D choices available');
    $native=json_decode(file_get_contents(dirname(__DIR__,2).'/assets/vendor/dancerudiments/build-manifest.json'),true);
    check(array_keys(dance_moves_visualiser_rudiments())===$native['upstream']['selection'],'native choices match the existing selected package');
    $empty=dance_moves_visualiser_page_config(901);
    check($empty===array('visualiserRecordingUrl'=>'','visualiserRenderer'=>'waveform','visualiserRudiment'=>'','visualiserAxes'=>array()),'old single-song Pages remain inactive by default');
    check(dance_moves_render_visualiser()==='','no generic canvas without a configured source');
    ks_epk_orientation_enqueue_runtime();
    check(!isset($GLOBALS['styles']['dance-moves-visualisers']),'unconfigured page does not enqueue generic styles');
    check($GLOBALS['shortcodes']['dance_moves_visualiser']==='dance_moves_render_visualiser','shortcode registered');
    check($GLOBALS['shortcodes']['dance_moves_spectrum']==='dance_moves_render_spectrum','original shortcode still registered');

    dance_moves_register_visualiser_meta();
    foreach (dance_moves_visualiser_meta_keys() as $key) {
        check($GLOBALS['registered'][$key]['auth_callback']==='dance_moves_meta_auth' && $GLOBALS['registered'][$key]['revisions_enabled']===true,'generic metadata uses existing authorization and revisions');
    }
    check(count($GLOBALS['registered'][DANCE_MOVES_META_VISUALISER_RENDERER]['show_in_rest']['schema']['enum'])===164,'REST renderer enum shares the complete catalogue');
    check($GLOBALS['registered'][DANCE_MOVES_META_VISUALISER_AXES]['type']==='array' && $GLOBALS['registered'][DANCE_MOVES_META_VISUALISER_AXES]['show_in_rest']['schema']['uniqueItems']===true,'REST axes schema is an ordered unique array');
    check(count(dance_moves_visualiser_revision_meta_keys(array(DANCE_MOVES_META_VISUALISER_AXES)))===4,'revision keys remain unique');
    check(dance_moves_validate_visualiser_axes('x, y, band_010')===array('x','y','band_010'),'editor comma list becomes ordered axes');
    check(dance_moves_validate_visualiser_axes('')===array(),'empty axes select all');
    $maximum=array_map(fn($n)=>'axis_'.$n,range(0,63));
    check(dance_moves_validate_visualiser_axes($maximum)===$maximum,'64 axes accepted');
    foreach (array(array_merge($maximum,array('overflow')),array('x','x'),array('X'),array('1x'),array('x-y'),array("x\n"),array(str_repeat('a',129)),array('x',1),array(1=>'x'),'x,,y',true) as $axes)
        check(is_wp_error(dance_moves_validate_visualiser_axes($axes)),'invalid axes are refused');

    $recording=asset(101,'motion.json','application/json','{"format":"dancerudiments.recording","dimensions":["x","y"],"samples":[[0,0],[0.1,0.2]]}');
    $other=asset(102,'other.json','text/plain');
    $bad_type=asset(103,'bad.json','application/x-php');
    $huge=asset(104,'bounded.json','application/json');
    $stream=fopen(get_attached_file($huge),'wb');ftruncate($stream,DANCE_MOVES_SPECTRUM_MAX_BYTES);fclose($stream);
    $before=memory_get_peak_usage(true);
    $bounded=dance_moves_visualiser_config($huge);
    check($bounded['visualiserRecordingUrl']===$GLOBALS['files'][$huge]['url'],'a bounded inert JSON attachment resolves without decoding its payload');
    check(memory_get_peak_usage(true)-$before<=2097152,'attachment resolution never materializes large sample JSON in PHP');
    $stream=fopen(get_attached_file($huge),'ab');fwrite($stream,'x');fclose($stream);clearstatcache();
    foreach (array(-1,1.2,true,array(101),'101junk',999,$bad_type,$huge) as $id)
        check(is_wp_error(dance_moves_validate_visualiser_options($id)),'same strict attachment ID, file, MIME and size bounds apply');
    check(is_wp_error(dance_moves_validate_visualiser_options($recording,'path','circle')),'recording and named source conflict');
    check(is_wp_error(dance_moves_validate_visualiser_options(0,'spectrum','circle')),'named source cannot claim Fourier provenance');
    check(is_wp_error(dance_moves_validate_visualiser_options(0,'unknown-view')),'unknown renderer rejected');
    check(is_wp_error(dance_moves_validate_visualiser_options(0,'path','song_private')),'unbundled named rudiment rejected');

    $GLOBALS['meta'][901][DANCE_MOVES_META_SPECTRUM_RECORDING]=$other;
    $GLOBALS['meta'][901][DANCE_MOVES_META_SPECTRUM_RENDERER]='spectrum-ring';
    $_POST=generic_form((string)$recording,'path','','x, y');dance_moves_save_visualiser_meta(901);
    check($GLOBALS['meta'][901][DANCE_MOVES_META_VISUALISER_RECORDING]===$recording && $GLOBALS['meta'][901][DANCE_MOVES_META_VISUALISER_AXES]===array('x','y'),'admin saves compact attachment ID and ordered axes');
    check($GLOBALS['meta'][901][DANCE_MOVES_META_SPECTRUM_RECORDING]===$other && $GLOBALS['meta'][901][DANCE_MOVES_META_SPECTRUM_RENDERER]==='spectrum-ring','generic save preserves all original spectrum metadata');
    check(!str_contains(wp_json_encode($GLOBALS['meta'][901]),'samples') && !str_contains(wp_json_encode($GLOBALS['meta'][901]),'https://'),'metadata never stores recording data or resolved URLs');
    $saved=$GLOBALS['meta'][901];
    foreach (array(generic_form($recording,'path','circle'),generic_form($recording,'unknown-view'),generic_form($recording,'path','','x,x'),generic_form($bad_type)) as $bad) {
        $_POST=$bad;dance_moves_save_visualiser_meta(901);
        check($GLOBALS['meta'][901]===$saved,'invalid editor inputs preserve the previous complete selection');
    }
    check(count($GLOBALS['transients'])>0,'invalid saves explain the preserved selection');
    $_POST=generic_form(0,'path','helix','z, x');$GLOBALS['nonce']=false;dance_moves_save_visualiser_meta(901);
    check($GLOBALS['meta'][901]===$saved,'nonce guard blocks unauthorized editor save');
    $GLOBALS['nonce']=true;$GLOBALS['allowed']=false;dance_moves_save_visualiser_meta(901);
    check($GLOBALS['meta'][901]===$saved,'edit permission guard blocks unauthorized editor save');
    $GLOBALS['allowed']=true;dance_moves_save_visualiser_meta(901);
    check(!isset($GLOBALS['meta'][901][DANCE_MOVES_META_VISUALISER_RECORDING]) && $GLOBALS['meta'][901][DANCE_MOVES_META_VISUALISER_RUDIMENT]==='helix','explicit source switch clears the prior recording ID');
    check(dance_moves_get_page_config(901)['visualiserAxes']===array('z','x'),'main Page boot config forwards generic axes');

    $prepared=(object)array('ID'=>901);
    $denied=dance_moves_visualiser_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_VISUALISER_RECORDING=>$recording)));
    check(is_wp_error($denied) && $denied->data['status']===400,'partial REST update detects conflict with saved named source');
    $allowed=dance_moves_visualiser_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_VISUALISER_RECORDING=>$recording,DANCE_MOVES_META_VISUALISER_RUDIMENT=>'')));
    check($allowed===$prepared,'REST can switch sources by explicitly clearing the previous source');
    check(is_wp_error(dance_moves_visualiser_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_VISUALISER_RENDERER=>'spectrum')))),'partial renderer update validates the saved source');
    check(is_wp_error(dance_moves_visualiser_rest_guard($prepared,request_meta(array(DANCE_MOVES_META_VISUALISER_AXES=>array('x','x'))))),'REST refuses duplicate axes');
    $prior=new WP_Error('prior','Already invalid');
    check(dance_moves_visualiser_rest_guard($prior,request_meta(array()))===$prior,'REST preserves errors from previous guards');

    $html=dance_moves_render_visualiser(array('renderer'=>'spatial-torus','label'=>'<b>Movement</b> "view"'));
    check(str_contains($html,'data-dance-moves-visualiser-renderer="spatial-torus"') && str_contains($html,'role="img"'),'shortcode supports a generic renderer and accessible canvas');
    check(str_contains($html,'aria-live="polite"') && str_contains($html,'aria-describedby=') && str_contains($html,'Movement &quot;view&quot;'),'status and escaped label are accessible');
    check(!str_contains($html,'<b>') && !str_contains($html,'samples') && !str_contains($html,'.json'),'canvas markup embeds no source URL or recording sample data');
    check($html!==dance_moves_render_visualiser(array('renderer'=>'spatial-torus','label'=>'<b>Movement</b> "view"')),'each shortcode gets its own accessible status ID');
    ob_start();dance_moves_visualiser_meta_box((object)array('ID'=>901));$admin=ob_get_clean();
    check(str_contains($admin,'<optgroup') && str_contains($admin,'value="spatial-torus"') && str_contains($admin,'value="helix"'),'Page controls group all renderer choices and expose existing native patterns');
    check(str_contains($admin,'dance_moves_visualiser_recording_id') && str_contains($admin,'dance_moves_visualiser_axes'),'Page controls use compact recording and axis fields');
    $GLOBALS['styles']=array();ks_epk_orientation_enqueue_runtime();
    check(str_ends_with($GLOBALS['styles']['dance-moves-visualisers']['src'],'lib/styles/visualisers.css'),'named Page view enqueues the shared generic stylesheet');
    check($GLOBALS['localized']['danceMovesConfig']['visualiserRudiment']==='helix' && $GLOBALS['localized']['danceMovesConfig']['visualiserRecordingUrl']==='','localized page config exposes only the selected named source');

    $masters=array(asset(201,'one.wav','audio/wav',str_repeat("\0",128)),asset(202,'two.wav','audio/wav',str_repeat("\0",128)),asset(203,'three.wav','audio/wav',str_repeat("\0",128)));
    $rows=array(
        array('id'=>'one','title'=>'One','audio_id'=>$masters[0],'bpm'=>120,'visualiser_recording_id'=>$recording,'visualiser_renderer'=>'path','visualiser_axes'=>array('x','y'),
            'spectrum_recording_id'=>$recording,'spectrum_renderer'=>'spectrum-line','visualiserRecording'=>array('samples'=>array(array(999)))) ,
        array('id'=>'two','title'=>'Two','audio_id'=>$masters[1],'bpm'=>140,'visualiser_rudiment'=>'circle','visualiser_renderer'=>'path','visualiser_axes'=>'y, x'),
        array('id'=>'three','title'=>'Three','audio_id'=>$masters[2],'bpm'=>100));
    $songs=dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>$rows));
    check(!is_wp_error($songs),'collection accepts independent saved, named and inactive visualiser sources');
    check($songs['songs'][1]['visualiser_axes']===array('y','x') && $songs['songs'][2]['visualiser_recording_id']===0,'collection normalizes axes and preserves inactive defaults');
    check(!isset($songs['songs'][0]['visualiserRecording']) && !str_contains(wp_json_encode($songs),'samples'),'collection whitelist excludes embedded recording samples');
    $GLOBALS['meta'][901][DANCE_MOVES_META_SONG_PAGE_TYPE]='collection';
    $GLOBALS['meta'][901][DANCE_MOVES_META_SONG_COLLECTION]=wp_json_encode($songs);
    $config=dance_moves_song_collection_config(901);
    check($config['songs'][0]['visualiserRecordingUrl']===$GLOBALS['files'][$recording]['url'] && $config['songs'][0]['visualiserRudiment']==='','first song resolves only its saved recording');
    check($config['songs'][1]['visualiserRecordingUrl']==='' && $config['songs'][1]['visualiserRudiment']==='circle','second song receives only its named source');
    check($config['songs'][2]['visualiserRecordingUrl']==='' && $config['songs'][2]['visualiserRudiment']==='','third song inherits no Page or adjacent song source');
    check($config['songs'][0]['spectrumRenderer']==='spectrum-line','original song spectrum configuration remains supported');
    $html=dance_moves_render_song_collection();
    check(substr_count($html,'data-dance-moves-visualiser data-')===2 && substr_count($html,'<audio ')===3,'collection places canvases only in the two configured song roots');
    check(substr_count($html,'data-dance-moves-spectrum data-')===1,'original spectrum markup can coexist on the configured song');
    check(dance_moves_render_visualiser()==='','Page shortcode avoids unscoped duplicate in collection mode');
    ob_start();dance_moves_song_collection_row($songs['songs'][0],0);$admin=ob_get_clean();
    check(str_contains($admin,'dance_moves_songs[0][visualiser_recording_id]') && str_contains($admin,'dance_moves_songs[0][visualiser_rudiment]') && str_contains($admin,'dance_moves_songs[0][visualiser_axes]'),'per-song editor uses independent visualiser fields');
    foreach (array(array('visualiser_rudiment'=>'circle'),array('visualiser_recording_id'=>$bad_type),array('visualiser_renderer'=>'unknown'),array('visualiser_axes'=>'x,x')) as $change) {
        $bad=$rows;$bad[0]=array_merge($bad[0],$change);
        check(is_wp_error(dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>$bad))),'collection import refuses an invalid song visualiser without saving partial rows');
    }
    unset($GLOBALS['meta'][901][DANCE_MOVES_META_VISUALISER_RUDIMENT],$GLOBALS['meta'][901][DANCE_MOVES_META_SPECTRUM_RECORDING]);
    $GLOBALS['styles']=array();ks_epk_orientation_enqueue_runtime();
    check(isset($GLOBALS['styles']['dance-moves-visualisers']),'configured collection songs enqueue the shared style even without a Page source');
    check(!str_contains(wp_json_encode($GLOBALS['localized']['danceMovesConfig']),'samples'),'localized collection config carries references and no recording arrays');
    unlink(get_attached_file($recording));clearstatcache();
    $config=dance_moves_song_collection_config(901);
    check(!is_wp_error($config) && $config['songs'][0]['visualiserRecordingUrl']==='' && $config['songs'][0]['audioSrc']===$GLOBALS['files'][$masters[0]]['url'],'deleted optional recording suppresses its view without disabling the song');
    check(substr_count(dance_moves_render_song_collection(),'data-dance-moves-visualiser data-')===1,'only the still-valid named song keeps its canvas');
    echo "PASS generic visualiser metadata, REST, shortcode and song isolation ($checks checks)\n";
} finally {
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
