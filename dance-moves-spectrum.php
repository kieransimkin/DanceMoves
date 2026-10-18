<?php
/** Page-owned spectrum recording references. Rendering belongs to the shared JavaScript runtime. */
if (!defined('ABSPATH')) { exit; }

define('DANCE_MOVES_META_SPECTRUM_RECORDING', '_dance_moves_spectrum_recording_id');
define('DANCE_MOVES_META_SPECTRUM_RENDERER', '_dance_moves_spectrum_renderer');
define('DANCE_MOVES_SPECTRUM_MAX_BYTES', 67108864);

function dance_moves_spectrum_renderers() {
    return array(
        'spectrum'=>'Bars', 'spectrum-line'=>'Line', 'spectrum-area'=>'Area',
        'spectrum-dots'=>'Dots', 'spectrum-stems'=>'Stems', 'spectrum-steps'=>'Steps',
        'spectrum-mirror'=>'Mirror', 'spectrum-radial'=>'Radial',
        'spectrum-ring'=>'Ring', 'spectrum-spiral'=>'Spiral',
    );
}
function dance_moves_sanitize_spectrum_renderer($value) {
    return is_string($value) && array_key_exists($value,dance_moves_spectrum_renderers()) ? $value : 'spectrum';
}
function dance_moves_spectrum_valid_id($value) {
    return $value===null || $value==='' || (is_int($value) && $value>=0) ||
        (is_string($value) && preg_match('/^[0-9]{1,18}$/D',$value));
}
/** libmagic can report large native JSON as text/plain, which WordPress rejects
 * for application/json. Classify only an already permitted, inert JSON upload.
 * The official authoring exporter sorts keys: schema_version follows samples,
 * so this bounded MIME sniff recognizes format, not a complete recording schema.
 */
function dance_moves_spectrum_filetype($check,$file,$filename,$mimes,$real_mime=false) {
    if ($real_mime!=='text/plain' || !empty($check['type']) ||
        strtolower(pathinfo($filename,PATHINFO_EXTENSION))!=='json' || !is_file($file) || !is_readable($file)) return $check;
    $size=filesize($file);
    if ($size===false || $size<1 || $size>DANCE_MOVES_SPECTRUM_MAX_BYTES) return $check;
    $permitted=wp_check_filetype($filename,$mimes);
    if (($permitted['ext'] ?? false)!=='json' || ($permitted['type'] ?? false)!=='application/json' ||
        !in_array('application/json',get_allowed_mime_types(),true)) return $check;
    $prefix=file_get_contents($file,false,null,0,8192);
    if (!is_string($prefix) || !preg_match_all('/"format"[ \t\r\n]*:[ \t\r\n]*"dancerudiments\.recording"/',$prefix,$matches,PREG_OFFSET_CAPTURE)) return $check;
    foreach ($matches[0] as $match) {
        // Closing the object after this complete member validates its top-level
        // position and any preceding clock/dimensions without reading samples.
        $header=json_decode(substr($prefix,0,$match[1]+strlen($match[0])).'}',true,16);
        if (is_array($header) && ($header['format'] ?? '')==='dancerudiments.recording') {
            return array('ext'=>'json','type'=>'application/json','proper_filename'=>false);
        }
    }
    return $check;
}
add_filter('wp_check_filetype_and_ext','dance_moves_spectrum_filetype',30,5);
/** Check the attachment without reading or copying its potentially large sample array.
 * The shared browser loader validates UTF-8, schema, samples and Fourier provenance
 * when this Page's canvas actually mounts. Unselected songs never fetch the file.
 */
function dance_moves_validate_spectrum_attachment($value) {
    if (!dance_moves_spectrum_valid_id($value))
        return new WP_Error('dance_moves_spectrum_id','Choose a Media Library spectrum recording attachment.');
    $id=absint($value);
    if (!$id) return true;
    if (get_post_type($id)!=='attachment')
        return new WP_Error('dance_moves_spectrum_media','Choose a Media Library spectrum recording attachment.');
    $path=get_attached_file($id);
    if (!$path || !is_file($path) || !is_readable($path))
        return new WP_Error('dance_moves_spectrum_file','The spectrum recording file is missing or unreadable.');
    $bytes=filesize($path);
    if ($bytes===false || $bytes<1 || $bytes>DANCE_MOVES_SPECTRUM_MAX_BYTES)
        return new WP_Error('dance_moves_spectrum_size','Spectrum recordings must contain JSON and be no larger than 64 MiB.');
    if (strtolower(pathinfo($path,PATHINFO_EXTENSION))!=='json' ||
        !in_array(strtolower((string)get_post_mime_type($id)),array('application/json','text/json','text/plain'),true))
        return new WP_Error('dance_moves_spectrum_type','Spectrum recordings must be JSON Media Library attachments.');
    $url=dance_moves_attachment_url($id);
    $parts=is_string($url) ? wp_parse_url($url) : false;
    if (!$url || strlen($url)>4096 || preg_match('/[\x00-\x1f]/',$url) || $parts===false ||
        (isset($parts['scheme']) && !in_array(strtolower($parts['scheme']),array('http','https'),true)) ||
        isset($parts['user']) || isset($parts['pass']))
        return new WP_Error('dance_moves_spectrum_url','The spectrum attachment needs an HTTP(S) or relative public URL.');
    return true;
}
function dance_moves_sanitize_spectrum_attachment_id($value) {
    return is_wp_error(dance_moves_validate_spectrum_attachment($value)) ? 0 : absint($value);
}
function dance_moves_spectrum_config($recording_id,$renderer='spectrum') {
    $valid=dance_moves_validate_spectrum_attachment($recording_id);
    return array(
        'spectrumRecordingUrl'=>is_wp_error($valid) ? '' : dance_moves_attachment_url(absint($recording_id)),
        'spectrumRenderer'=>dance_moves_sanitize_spectrum_renderer($renderer),
    );
}
function dance_moves_spectrum_page_config($page_id) {
    return dance_moves_spectrum_config(get_post_meta($page_id,DANCE_MOVES_META_SPECTRUM_RECORDING,true),
        get_post_meta($page_id,DANCE_MOVES_META_SPECTRUM_RENDERER,true));
}

function dance_moves_register_spectrum_meta() {
    register_post_meta('page',DANCE_MOVES_META_SPECTRUM_RECORDING,array(
        'type'=>'integer','single'=>true,'default'=>0,
        'sanitize_callback'=>'dance_moves_sanitize_spectrum_attachment_id','auth_callback'=>'dance_moves_meta_auth',
        'show_in_rest'=>true,'revisions_enabled'=>true,
    ));
    register_post_meta('page',DANCE_MOVES_META_SPECTRUM_RENDERER,array(
        'type'=>'string','single'=>true,'default'=>'spectrum',
        'sanitize_callback'=>'dance_moves_sanitize_spectrum_renderer','auth_callback'=>'dance_moves_meta_auth',
        'show_in_rest'=>array('schema'=>array('type'=>'string','enum'=>array_keys(dance_moves_spectrum_renderers()))),
        'revisions_enabled'=>true,
    ));
}
add_action('init','dance_moves_register_spectrum_meta');
function dance_moves_spectrum_revision_meta_keys($keys) {
    return array_values(array_unique(array_merge($keys,array(DANCE_MOVES_META_SPECTRUM_RECORDING,DANCE_MOVES_META_SPECTRUM_RENDERER))));
}
add_filter('wp_post_revision_meta_keys','dance_moves_spectrum_revision_meta_keys');

function dance_moves_spectrum_rest_guard($prepared,$request) {
    if (is_wp_error($prepared)) return $prepared;
    $meta=$request->get_param('meta');
    if (!is_array($meta)) return $prepared;
    if (array_key_exists(DANCE_MOVES_META_SPECTRUM_RECORDING,$meta)) {
        $valid=dance_moves_validate_spectrum_attachment($meta[DANCE_MOVES_META_SPECTRUM_RECORDING]);
        if (is_wp_error($valid)) { $valid->add_data(array('status'=>400)); return $valid; }
    }
    if (array_key_exists(DANCE_MOVES_META_SPECTRUM_RENDERER,$meta) &&
        (!is_string($meta[DANCE_MOVES_META_SPECTRUM_RENDERER]) ||
         !array_key_exists($meta[DANCE_MOVES_META_SPECTRUM_RENDERER],dance_moves_spectrum_renderers()))) {
        return new WP_Error('dance_moves_spectrum_renderer','Choose a supported spectrum renderer.',array('status'=>400));
    }
    return $prepared;
}
add_filter('rest_pre_insert_page','dance_moves_spectrum_rest_guard',10,2);

function dance_moves_spectrum_renderer_field($name,$renderer) {
    echo '<p><label>Spectrum style <select name="'.esc_attr($name).'">';
    foreach (dance_moves_spectrum_renderers() as $value=>$label) {
        echo '<option value="'.esc_attr($value).'"'.selected($renderer,$value,false).'>'.esc_html($label).'</option>';
    }
    echo '</select></label></p>';
}
function dance_moves_spectrum_meta_box($post) {
    wp_nonce_field('dance_moves_save_spectrum','dance_moves_spectrum_nonce');
    dance_moves_file_field($post->ID,'Spectrum recording (.json)','dance_moves_spectrum_recording_id',DANCE_MOVES_META_SPECTRUM_RECORDING,array('json'));
    dance_moves_spectrum_renderer_field('dance_moves_spectrum_renderer',
        dance_moves_sanitize_spectrum_renderer(get_post_meta($post->ID,DANCE_MOVES_META_SPECTRUM_RENDERER,true)));
    echo '<p class="description">Choose this song’s StemLab Fourier DanceRudiments recording (up to 64 MiB). Add <code>[dance_moves_spectrum]</code> inside the same DanceMoves content root as its audio player. The recording loads only when that canvas mounts; the browser validates its samples and analysis provenance.</p>';
    echo '<p class="description">For Multiple songs, set a separate recording and style in each Song collection row.</p>';
}
function dance_moves_register_spectrum_box() {
    add_meta_box('dance-moves-spectrum','Dance-rudiment spectrum','dance_moves_spectrum_meta_box','page','side','default');
}
add_action('add_meta_boxes_page','dance_moves_register_spectrum_box');
function dance_moves_save_spectrum_meta($post_id) {
    if (!isset($_POST['dance_moves_spectrum_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['dance_moves_spectrum_nonce'])),'dance_moves_save_spectrum') ||
        (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post',$post_id)) return;
    $id=wp_unslash($_POST['dance_moves_spectrum_recording_id'] ?? 0);
    $renderer=wp_unslash($_POST['dance_moves_spectrum_renderer'] ?? 'spectrum');
    $valid=dance_moves_validate_spectrum_attachment($id);
    if (is_wp_error($valid)) {
        dance_moves_queue_admin_error($valid->get_error_message().' The previous spectrum selection was preserved.');
        return;
    }
    if (!is_string($renderer) || !array_key_exists($renderer,dance_moves_spectrum_renderers())) {
        dance_moves_queue_admin_error('Choose a supported spectrum renderer. The previous spectrum selection was preserved.');
        return;
    }
    if (absint($id)) update_post_meta($post_id,DANCE_MOVES_META_SPECTRUM_RECORDING,absint($id));
    else delete_post_meta($post_id,DANCE_MOVES_META_SPECTRUM_RECORDING);
    update_post_meta($post_id,DANCE_MOVES_META_SPECTRUM_RENDERER,$renderer);
}
add_action('save_post_page','dance_moves_save_spectrum_meta',25);

/** Reusable markup only: URL selection and all playback stay in the scoped runtime. */
function dance_moves_spectrum_markup($renderer='spectrum',$label='Dance-rudiment spectrum') {
    static $instance=0;
    $status_id='dance-moves-spectrum-status-'.(++$instance);
    $renderer=dance_moves_sanitize_spectrum_renderer($renderer);
    $label=is_string($label) ? sanitize_text_field($label) : '';
    if (trim($label)==='' || strlen($label)>200) $label='Dance-rudiment spectrum';
    return '<figure class="dance-moves-spectrum" data-dance-moves-spectrum-figure>'.
        '<canvas width="960" height="320" data-dance-moves-spectrum data-dance-moves-spectrum-renderer="'.esc_attr($renderer).'" role="img" aria-label="'.esc_attr($label).'" aria-describedby="'.esc_attr($status_id).'">'.
        'A spectrum visualisation follows this song’s audio. The audio controls remain available.'.
        '</canvas><figcaption id="'.esc_attr($status_id).'" data-dance-moves-spectrum-status role="status" aria-live="polite" aria-atomic="true">Spectrum loads for this song.</figcaption></figure>';
}
function dance_moves_render_spectrum($attrs=array(),$content=null) {
    $page_id=get_the_ID();
    // Song collections place their own scoped canvases next to each song's player.
    if (get_post_meta($page_id,'_dance_moves_song_page_type',true)==='collection') return '';
    $config=dance_moves_spectrum_page_config($page_id);
    if (!$config['spectrumRecordingUrl']) return '';
    $attrs=is_array($attrs) ? $attrs : array();
    return dance_moves_spectrum_markup($attrs['renderer'] ?? $config['spectrumRenderer'],$attrs['label'] ?? 'Dance-rudiment spectrum');
}
add_shortcode('dance_moves_spectrum','dance_moves_render_spectrum');
