<?php
/** Run only in the disposable CI WordPress site through wp eval-file. */
if (!defined('ABSPATH') || !function_exists('rest_do_request')) { throw new RuntimeException('Real WordPress is required.'); }
$checks=0;$created=array();
$check=static function ($value,$label) use (&$checks) {if (!$value) {throw new RuntimeException($label);} ++$checks;};
$admin=get_user_by('login','capture_admin');
if (!$admin) {throw new RuntimeException('Disposable CI admin is missing.');}
wp_set_current_user($admin->ID);
try {
    $id=wp_insert_post(array('post_type'=>'page','post_status'=>'publish','post_title'=>'Synthetic beat-alignment contract','post_content'=>'Preserve original content'),true);
    $check(!is_wp_error($id),'fixture page created');$created[]=array('post',$id);
    $samples=str_repeat(pack('v',0),48000*2);
    $wav='RIFF'.pack('V',36+strlen($samples)).'WAVEfmt '.pack('VvvVVvv',16,1,1,48000,96000,2,16).'data'.pack('V',strlen($samples)).$samples;
    $upload=wp_upload_bits('synthetic-beat-master.wav',null,$wav);
    $check(!$upload['error'],'synthetic WAV uploaded');
    $audio=wp_insert_attachment(array('post_title'=>'Synthetic beat master','post_mime_type'=>'audio/wav','post_status'=>'inherit'),$upload['file'],$id,true);
    $check(!is_wp_error($audio),'audio attachment created');$created[]=array('attachment',$audio);
    $reading=array('schema'=>'stemlab.beat-alignment.v1','source_sha256'=>hash_file('sha256',$upload['file']),
        'source_audio_verified'=>true,'source_audio'=>array('sample_rate'=>48000,'num_frames'=>96000),
        'bpm'=>120,'exact_bpm'=>'120','bpm_basis'=>'combined_fit','bpm_status'=>'estimated','phase_status'=>'estimated',
        'analysis_id'=>'consensus','evidence_sha256'=>str_repeat('b',64),'report_sha256'=>str_repeat('c',64),
        'first_beat_seconds'=>0.125,'first_beat_exact_seconds'=>'1/8','offset_pips'=>-16,'exact_offset_pips'=>'-16',
        'pips_per_beat'=>64,'canonical_first_beat_pip'=>0);
    $request=new WP_REST_Request('POST','/wp/v2/pages/'.$id);
    $request->set_param('meta',array(DANCE_MOVES_META_BEAT_ALIGNMENT=>wp_json_encode($reading),DANCE_MOVES_META_ALIGNMENT_AUDIO=>$audio));
    $response=rest_do_request($request);
    $check($response->get_status()===200,'real REST persists valid alignment');
    $config=dance_moves_get_page_config($id);
    $check($config['bpmSource']==='analysis','fit is analysis-derived, not canonical');
    $check($config['beatAlignment']['phase_status']==='estimated','phase remains estimated');
    $check($config['beatAlignment']['source_url']===wp_get_attachment_url($audio),'selected master supplies runtime URL');
    $check($config['beatAlignment']['exact_offset_pips']==='-16','exact signed offset persisted');
    $previous=get_post_meta($id,DANCE_MOVES_META_BEAT_ALIGNMENT,true);
    $bad=$reading;$bad['offset_pips']=0;
    $request->set_param('content','Must not replace original');
    $request->set_param('meta',array(DANCE_MOVES_META_BEAT_ALIGNMENT=>wp_json_encode($bad)));
    $response=rest_do_request($request);
    $check($response->get_status()===400,'invalid REST input rejected');
    $check(get_post_field('post_content',$id)==='Preserve original content','rejection precedes content update');
    $check(get_post_meta($id,DANCE_MOVES_META_BEAT_ALIGNMENT,true)===$previous,'rejection preserves prior metadata');
    $keys=wp_post_revision_meta_keys('page');
    $check(in_array(DANCE_MOVES_META_BEAT_ALIGNMENT,$keys,true) && in_array(DANCE_MOVES_META_ALIGNMENT_AUDIO,$keys,true),'both fields revision-enabled');
    $properties=get_registered_meta_keys('post','page');
    $check($properties[DANCE_MOVES_META_BEAT_ALIGNMENT]['show_in_rest']===true,'alignment REST schema registered');
    ob_start();dance_moves_render_meta_box(get_post($id));$html=ob_get_clean();
    $check(str_contains($html,'Beat alignment reading (StemLab JSON)') && str_contains($html,'Analysed Master Audio'),'real metabox renders both fields');
    $check(str_contains($html,'phase estimated'),'real metabox exposes authority');
    $check(str_contains($html,'source-bound analysis estimate 120.0000000 BPM') && !str_contains($html,'currently uses the 120 BPM fallback'),'metabox describes the active analysis BPM accurately');
    $evidence=getenv('DANCEMOVES_ALIGNMENT_EVIDENCE');
    if ($evidence) {
        wp_mkdir_p($evidence);
        file_put_contents($evidence.'/wordpress-beat-fields.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>DanceMoves '.DANCE_MOVES_VERSION.' WordPress EPK Timing — disposable CI</title><style>body{font:16px system-ui;max-width:650px;margin:2rem auto;padding:1rem;background:#f0f0f1;color:#1d2327}.widefat{box-sizing:border-box;width:100%;font:inherit;padding:.5rem}textarea{font:12px monospace}.description{display:block;color:#50575e;font-size:14px}button{padding:.5rem}</style><body><h1>EPK Timing</h1><p>Actual DanceMoves '.DANCE_MOVES_VERSION.' metabox rendered in disposable WordPress. Synthetic 120 BPM, first beat 0.125 s; no production deployment is shown.</p>'.$html.'</body></html>');
        file_put_contents($evidence.'/wordpress-beat-config.json',wp_json_encode(array('version'=>DANCE_MOVES_VERSION,'checks'=>$checks,'config'=>$config)));
    }
    echo "PASS WordPress beat alignment core ($checks checks)\n";
} finally {
    foreach (array_reverse($created) as $item) {if ($item[0]==='attachment') {wp_delete_attachment($item[1],true);} else {wp_delete_post($item[1],true);}}
}
