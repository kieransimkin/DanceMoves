<?php
/** Stubbed WP-CLI boundary tests for the example helper; not live WordPress tests. */
define('WP_CLI',true);
foreach (array('BPM'=>'bpm','LYRIC_TIMING'=>'lyric_timing_id','CUE_TIMING'=>'cue_timing_id','LYRIC_POPUPS'=>'lyric_popups_enabled','MASTER_DURATION'=>'master_duration_ms','EFFECT'=>'effect') as $name=>$suffix) {
    define('DANCE_MOVES_META_'.$name,'_dance_moves_'.$suffix);
}
class WP_CLI { public static function error($text){throw new RuntimeException($text);} public static function log($text){} public static function success($text){} }
class WP_Error { public function __construct(public string $message){} public function get_error_message(){return $this->message;} }
$stored=array();$writes=0;$allowed=true;$fail_write=false;$validation_calls=array();
function get_post_type($id){return $id===1234?'page':'post';}
function current_user_can($cap,$id){global $allowed;return $allowed;}
function is_wp_error($value){return $value instanceof WP_Error;}
function dance_moves_sanitize_bpm($value){return is_numeric($value)&&is_finite((float)$value)&&$value>=20&&$value<=400?round((float)$value,3):'';}
function dance_moves_sanitize_duration($value){return is_numeric($value)&&is_finite((float)$value)&&$value>0&&$value<=86400000?round((float)$value,3):0;}
function dance_moves_validate_timing_attachment($id,$kind){global $validation_calls;$validation_calls[]=array($id,$kind);return $id===0||$id===($kind==='lyric'?9001:9002)?true:new WP_Error('Invalid fixture attachment');}
function delete_post_meta($id,$key){global $stored,$writes,$fail_write;$writes++;if(!$fail_write)unset($stored[$key]);}
function update_post_meta($id,$key,$value){global $stored,$writes,$fail_write;$writes++;if(!$fail_write)$stored[$key]=$value;}
function get_post_meta($id,$key=null,$single=false){global $stored;return $key===null?$stored:($stored[$key]??'');}
function metadata_exists($type,$id,$key){global $stored;return array_key_exists($key,$stored);}
function dance_moves_get_page_config($id){return array('pageId'=>$id);}
function wp_json_encode($value,$flags=0){return json_encode($value,$flags);}
$checks=0;
function check($condition,$message){global $checks;$checks++;if(!$condition)throw new LogicException($message);}
function run_helper($input){
    $file=tempnam(sys_get_temp_dir(),'dm-meta-');file_put_contents($file,json_encode($input));$args=array($file);
    try { require __DIR__.'/../examples/wordpress/wordpress/configure-page.php';return null; }
    catch(RuntimeException $error){return $error->getMessage();}
    finally{unlink($file);}
}
$initial=array('_dance_moves_bpm'=>145,'_dance_moves_effect'=>'','unrelated'=>'keep');
foreach (array(
    array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>155,'_dance_moves_lyric_timing_id'=>123)),
    array('pageId'=>1234,'meta'=>array('_dance_moves_lyric_popups_enabled'=>'1')),
    array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>401)),
    array('pageId'=>1234,'meta'=>array('_dance_moves_effect'=>'none')),
    array('pageId'=>1234,'meta'=>array('_dance_moves_master_duration_ms'=>-1)),
    array('pageId'=>1234,'meta'=>array('_invented'=>true)),
    array('pageId'=>999,'meta'=>array('_dance_moves_bpm'=>145)),
    array('pageId'=>'1234','meta'=>array('_dance_moves_bpm'=>145))
) as $input){$stored=$initial;$writes=0;check(run_helper($input)!==null,'Invalid input accepted');check($writes===0&&$stored===$initial,'Invalid request wrote metadata');}
$stored=$initial;$writes=0;$validation_calls=array();
check(run_helper(array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>145,'_dance_moves_lyric_timing_id'=>9001,'_dance_moves_cue_timing_id'=>9002,'_dance_moves_master_duration_ms'=>273604.558,'_dance_moves_lyric_popups_enabled'=>true,'_dance_moves_effect'=>'paper-planes')))===null,'Valid config rejected');
check($writes===6,'Six writes expected');check($stored['unrelated']==='keep','Unrelated metadata altered');
check($validation_calls===array(array(9001,'lyric'),array(9002,'cue')),'Full timing validation not called');
check($stored['_dance_moves_lyric_popups_enabled']==='1','Boolean storage mismatch');
check(run_helper(array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>'','_dance_moves_lyric_timing_id'=>0,'_dance_moves_cue_timing_id'=>0,'_dance_moves_lyric_popups_enabled'=>false,'_dance_moves_effect'=>'')))===null,'Clear rejected');
foreach(array('bpm','lyric_timing_id','cue_timing_id','lyric_popups_enabled','effect') as $suffix)check(!isset($stored['_dance_moves_'.$suffix]),'Clear failed');
check($stored['_dance_moves_master_duration_ms']===273604.558,'Unspecified key changed');
$stored=$initial;$writes=0;$allowed=false;check(run_helper(array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>150)))!==null&&$writes===0,'Permission failure wrote metadata');$allowed=true;
$fail_write=true;check(str_contains(run_helper(array('pageId'=>1234,'meta'=>array('_dance_moves_bpm'=>150)))??'','Read-back mismatch'),'Write failure not surfaced');$fail_write=false;
echo json_encode(array('status'=>'PASS','scope'=>'Stubbed WP-CLI helper boundaries, not live WordPress','checks'=>$checks),JSON_PRETTY_PRINT).PHP_EOL;
