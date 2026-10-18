<?php
/** Page-owned rudiment sources and Canvas markup. The shared runtime owns rendering and playback. */
if (!defined('ABSPATH')) { exit; }

define('DANCE_MOVES_META_VISUALISER_RECORDING', '_dance_moves_visualiser_recording_id');
define('DANCE_MOVES_META_VISUALISER_RENDERER', '_dance_moves_visualiser_renderer');
define('DANCE_MOVES_META_VISUALISER_RUDIMENT', '_dance_moves_visualiser_rudiment');
define('DANCE_MOVES_META_VISUALISER_AXES', '_dance_moves_visualiser_axes');

/** This small, trusted catalogue is build metadata; it contains no recording samples. */
function dance_moves_visualiser_catalogue() {
    static $catalogue=null;
    if ($catalogue!==null) return $catalogue;
    $catalogue=array();
    $file=__DIR__.'/assets/visualiser-catalogue.json';
    if (!is_file($file)) $file=__DIR__.'/lib/assets/visualiser-catalogue.json';
    if (!is_readable($file) || filesize($file)>262144) return $catalogue;
    $rows=json_decode(file_get_contents($file),true,16);
    if (!is_array($rows) || count($rows)>512) return $catalogue;
    foreach ($rows as $row) {
        if (!is_array($row) || !isset($row['name'],$row['label'],$row['family'],$row['styleFamily']) ||
            !is_string($row['name']) || !preg_match('/^[a-z][a-z0-9-]{0,127}$/D',$row['name']) ||
            !is_string($row['label']) || !is_string($row['family']) || !is_string($row['styleFamily']) ||
            !is_bool($row['requiresSpectrum'] ?? null)) continue;
        $catalogue[$row['name']]=$row;
    }
    return $catalogue;
}
function dance_moves_visualiser_renderers() {
    $renderers=array();
    foreach (dance_moves_visualiser_catalogue() as $name=>$row) $renderers[$name]=$row['label'];
    return $renderers;
}
/** Match the existing selected native package; do not introduce a second pattern catalogue. */
function dance_moves_visualiser_rudiments() {
    static $rudiments=null;
    if ($rudiments!==null) return $rudiments;
    $rudiments=array();
    $file=__DIR__.'/assets/vendor/dancerudiments/build-manifest.json';
    if (!is_file($file)) $file=__DIR__.'/lib/assets/DanceRudiments-build-manifest.json';
    if (!is_readable($file) || filesize($file)>65536) return $rudiments;
    $manifest=json_decode(file_get_contents($file),true,16);
    foreach (($manifest['upstream']['selection'] ?? array()) as $name) {
        if (is_string($name) && preg_match('/^[a-z][a-z0-9_]{0,127}$/D',$name))
            $rudiments[$name]=ucwords(str_replace('_',' ',$name));
    }
    return $rudiments;
}
function dance_moves_sanitize_visualiser_renderer($value) {
    return is_string($value) && isset(dance_moves_visualiser_catalogue()[$value]) ? $value : 'waveform';
}
function dance_moves_sanitize_visualiser_rudiment($value) {
    return is_string($value) && isset(dance_moves_visualiser_rudiments()[$value]) ? $value : '';
}
/** The editor accepts a comma list; REST and saved configuration use an ordered array. */
function dance_moves_validate_visualiser_axes($value) {
    if (is_string($value)) {
        if (strlen($value)>8255) return new WP_Error('dance_moves_visualiser_axes','Choose at most 64 dimension names.');
        $value=trim($value)==='' ? array() : array_map('trim',explode(',',$value));
    }
    if (!is_array($value) || !array_is_list($value) || count($value)>64)
        return new WP_Error('dance_moves_visualiser_axes','Axes must be an ordered list of at most 64 unique dimension names.');
    $seen=array();
    foreach ($value as $axis) {
        if (!is_string($axis) || !preg_match('/^[a-z][a-z0-9_]{0,127}$/D',$axis) || isset($seen[$axis]))
            return new WP_Error('dance_moves_visualiser_axes','Use unique dimension names beginning with a lowercase letter and containing only lowercase letters, digits or underscores.');
        $seen[$axis]=true;
    }
    return array_values($value);
}
function dance_moves_sanitize_visualiser_axes($value) {
    $axes=dance_moves_validate_visualiser_axes($value);
    return is_wp_error($axes) ? array() : $axes;
}
/** Validate references, not large JSON payloads. The browser validates actual dimensions and samples. */
function dance_moves_validate_visualiser_options($recording_id=0,$renderer='waveform',$rudiment='',$axes=array(),$check_attachment=true) {
    if (!dance_moves_spectrum_valid_id($recording_id))
        return new WP_Error('dance_moves_visualiser_id','Choose a Media Library visualiser recording attachment.');
    $catalogue=dance_moves_visualiser_catalogue();
    if (!is_string($renderer) || !isset($catalogue[$renderer]))
        return new WP_Error('dance_moves_visualiser_renderer','Choose a supported visualiser renderer.');
    if (!is_string($rudiment) || ($rudiment!=='' && !isset(dance_moves_visualiser_rudiments()[$rudiment])))
        return new WP_Error('dance_moves_visualiser_rudiment','Choose a supported bundled rudiment.');
    if (absint($recording_id) && $rudiment!=='')
        return new WP_Error('dance_moves_visualiser_source','Choose one visualiser source: a recording attachment or a bundled rudiment. Clear the other source before saving.');
    if ($rudiment!=='' && $catalogue[$renderer]['requiresSpectrum'])
        return new WP_Error('dance_moves_visualiser_spectrum','This renderer needs a calibrated Fourier recording. Choose a motion renderer for a bundled rudiment.');
    $axes=dance_moves_validate_visualiser_axes($axes);
    if (is_wp_error($axes)) return $axes;
    if ($check_attachment) {
        $valid=dance_moves_validate_spectrum_attachment($recording_id);
        if (is_wp_error($valid)) return new WP_Error('dance_moves_visualiser_attachment',
            str_replace(array('spectrum','Spectrum'),array('visualiser','Visualiser'),$valid->get_error_message()));
    }
    return array('visualiser_recording_id'=>absint($recording_id),'visualiser_renderer'=>$renderer,
        'visualiser_rudiment'=>$rudiment,'visualiser_axes'=>$axes);
}
function dance_moves_visualiser_config($recording_id=0,$renderer='waveform',$rudiment='',$axes=array()) {
    $config=array('visualiserRecordingUrl'=>'','visualiserRenderer'=>'waveform','visualiserRudiment'=>'','visualiserAxes'=>array());
    $valid=dance_moves_validate_visualiser_options($recording_id,$renderer,$rudiment,$axes,false);
    if (is_wp_error($valid)) return $config;
    $config['visualiserRenderer']=$valid['visualiser_renderer'];
    $config['visualiserRudiment']=$valid['visualiser_rudiment'];
    $config['visualiserAxes']=$valid['visualiser_axes'];
    // Removing an optional recording must not disable the Page's audio or other effects.
    if ($valid['visualiser_recording_id'] && !is_wp_error(dance_moves_validate_spectrum_attachment($valid['visualiser_recording_id'])))
        $config['visualiserRecordingUrl']=dance_moves_attachment_url($valid['visualiser_recording_id']);
    return $config;
}
function dance_moves_visualiser_page_config($page_id) {
    return dance_moves_visualiser_config(get_post_meta($page_id,DANCE_MOVES_META_VISUALISER_RECORDING,true),
        get_post_meta($page_id,DANCE_MOVES_META_VISUALISER_RENDERER,true) ?: 'waveform',
        get_post_meta($page_id,DANCE_MOVES_META_VISUALISER_RUDIMENT,true),
        get_post_meta($page_id,DANCE_MOVES_META_VISUALISER_AXES,true));
}
function dance_moves_visualiser_meta_keys() {
    return array(DANCE_MOVES_META_VISUALISER_RECORDING,DANCE_MOVES_META_VISUALISER_RENDERER,
        DANCE_MOVES_META_VISUALISER_RUDIMENT,DANCE_MOVES_META_VISUALISER_AXES);
}
function dance_moves_register_visualiser_meta() {
    $common=array('single'=>true,'auth_callback'=>'dance_moves_meta_auth','revisions_enabled'=>true);
    register_post_meta('page',DANCE_MOVES_META_VISUALISER_RECORDING,array_merge($common,array(
        'type'=>'integer','default'=>0,'sanitize_callback'=>'dance_moves_sanitize_spectrum_attachment_id','show_in_rest'=>true)));
    register_post_meta('page',DANCE_MOVES_META_VISUALISER_RENDERER,array_merge($common,array(
        'type'=>'string','default'=>'waveform','sanitize_callback'=>'dance_moves_sanitize_visualiser_renderer',
        'show_in_rest'=>array('schema'=>array('type'=>'string','enum'=>array_keys(dance_moves_visualiser_catalogue()))))));
    register_post_meta('page',DANCE_MOVES_META_VISUALISER_RUDIMENT,array_merge($common,array(
        'type'=>'string','default'=>'','sanitize_callback'=>'dance_moves_sanitize_visualiser_rudiment',
        'show_in_rest'=>array('schema'=>array('type'=>'string','enum'=>array_merge(array(''),array_keys(dance_moves_visualiser_rudiments())))))));
    register_post_meta('page',DANCE_MOVES_META_VISUALISER_AXES,array_merge($common,array(
        'type'=>'array','default'=>array(),'sanitize_callback'=>'dance_moves_sanitize_visualiser_axes',
        'show_in_rest'=>array('schema'=>array('type'=>'array','maxItems'=>64,'uniqueItems'=>true,
            'items'=>array('type'=>'string','pattern'=>'^[a-z][a-z0-9_]{0,127}$','maxLength'=>128))))));
}
add_action('init','dance_moves_register_visualiser_meta');
function dance_moves_visualiser_revision_meta_keys($keys) {
    return array_values(array_unique(array_merge($keys,dance_moves_visualiser_meta_keys())));
}
add_filter('wp_post_revision_meta_keys','dance_moves_visualiser_revision_meta_keys');
function dance_moves_visualiser_rest_guard($prepared,$request) {
    if (is_wp_error($prepared)) return $prepared;
    $meta=$request->get_param('meta');
    if (!is_array($meta) || !array_intersect(dance_moves_visualiser_meta_keys(),array_keys($meta))) return $prepared;
    $page_id=absint($request->get_param('id') ?: ($prepared->ID ?? 0));
    $values=array();
    foreach (dance_moves_visualiser_meta_keys() as $key)
        $values[]=array_key_exists($key,$meta) ? $meta[$key] : get_post_meta($page_id,$key,true);
    if (!array_key_exists(DANCE_MOVES_META_VISUALISER_RENDERER,$meta) && $values[1]==='') $values[1]='waveform';
    $valid=dance_moves_validate_visualiser_options(...$values);
    if (is_wp_error($valid)) { $valid->add_data(array('status'=>400)); return $valid; }
    return $prepared;
}
add_filter('rest_pre_insert_page','dance_moves_visualiser_rest_guard',15,2);

function dance_moves_visualiser_renderer_field($name,$renderer) {
    $groups=array();
    foreach (dance_moves_visualiser_catalogue() as $row) $groups[$row['family'].' / '.$row['styleFamily']][]=$row;
    echo '<p><label>Visualiser style <select name="'.esc_attr($name).'">';
    foreach ($groups as $group=>$rows) {
        echo '<optgroup label="'.esc_attr(ucwords(str_replace('-',' ',$group))).'">';
        foreach ($rows as $row)
            echo '<option value="'.esc_attr($row['name']).'"'.selected($renderer,$row['name'],false).'>'.esc_html($row['label']).'</option>';
        echo '</optgroup>';
    }
    echo '</select></label></p>';
}
function dance_moves_visualiser_rudiment_field($name,$rudiment) {
    echo '<p><label>Bundled rudiment <select name="'.esc_attr($name).'"><option value="">None</option>';
    foreach (dance_moves_visualiser_rudiments() as $value=>$label)
        echo '<option value="'.esc_attr($value).'"'.selected($rudiment,$value,false).'>'.esc_html($label).'</option>';
    echo '</select></label></p>';
}
function dance_moves_visualiser_axes_field($name,$axes) {
    echo '<p><label>Axes (optional, in display order) <input type="text" name="'.esc_attr($name).'" value="'.
        esc_attr(implode(', ',dance_moves_sanitize_visualiser_axes($axes))).'" maxlength="8255" placeholder="x, y"></label></p>';
    echo '<p class="description">Leave axes empty to use all dimensions. Choose up to 64 unique dimension names from the recording; bundled rudiments use x, y and z where available. Path views need at least two dimensions.</p>';
}
function dance_moves_visualiser_meta_box($post) {
    wp_nonce_field('dance_moves_save_visualiser','dance_moves_visualiser_nonce');
    dance_moves_file_field($post->ID,'Visualiser recording (.json)','dance_moves_visualiser_recording_id',DANCE_MOVES_META_VISUALISER_RECORDING,array('json'));
    dance_moves_visualiser_rudiment_field('dance_moves_visualiser_rudiment',get_post_meta($post->ID,DANCE_MOVES_META_VISUALISER_RUDIMENT,true));
    dance_moves_visualiser_renderer_field('dance_moves_visualiser_renderer',
        dance_moves_sanitize_visualiser_renderer(get_post_meta($post->ID,DANCE_MOVES_META_VISUALISER_RENDERER,true)));
    dance_moves_visualiser_axes_field('dance_moves_visualiser_axes',get_post_meta($post->ID,DANCE_MOVES_META_VISUALISER_AXES,true));
    echo '<p class="description">Choose one source: a saved DanceRudiments recording (up to 64 MiB) or a bundled rudiment. Clear the other source to switch. Spectrum and spectrogram views require a StemLab Fourier recording.</p>';
    echo '<p class="description">Add <code>[dance_moves_visualiser]</code> inside the same DanceMoves content root as its audio player. A recording requires audio; a bundled rudiment can also animate on a page without audio. For Multiple songs, configure each Song collection row instead.</p>';
}
function dance_moves_register_visualiser_box() {
    add_meta_box('dance-moves-visualiser','Dance-rudiment visualiser','dance_moves_visualiser_meta_box','page','side','default');
}
add_action('add_meta_boxes_page','dance_moves_register_visualiser_box');
function dance_moves_save_visualiser_meta($post_id) {
    if (!isset($_POST['dance_moves_visualiser_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['dance_moves_visualiser_nonce'])),'dance_moves_save_visualiser') ||
        (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post',$post_id)) return;
    $valid=dance_moves_validate_visualiser_options(wp_unslash($_POST['dance_moves_visualiser_recording_id'] ?? 0),
        wp_unslash($_POST['dance_moves_visualiser_renderer'] ?? 'waveform'),
        wp_unslash($_POST['dance_moves_visualiser_rudiment'] ?? ''),wp_unslash($_POST['dance_moves_visualiser_axes'] ?? ''));
    if (is_wp_error($valid)) {
        dance_moves_queue_admin_error($valid->get_error_message().' The previous visualiser selection was preserved.');
        return;
    }
    foreach (array(DANCE_MOVES_META_VISUALISER_RECORDING=>'visualiser_recording_id',DANCE_MOVES_META_VISUALISER_RENDERER=>'visualiser_renderer',
        DANCE_MOVES_META_VISUALISER_RUDIMENT=>'visualiser_rudiment',DANCE_MOVES_META_VISUALISER_AXES=>'visualiser_axes') as $key=>$field) {
        if ($valid[$field]) update_post_meta($post_id,$key,$valid[$field]);
        else delete_post_meta($post_id,$key);
    }
}
add_action('save_post_page','dance_moves_save_visualiser_meta',25);

function dance_moves_visualiser_markup($renderer='waveform',$label='Dance-rudiment visualiser') {
    static $instance=0;
    $status_id='dance-moves-visualiser-status-'.(++$instance);
    $renderer=dance_moves_sanitize_visualiser_renderer($renderer);
    $label=is_string($label) ? sanitize_text_field($label) : '';
    if (trim($label)==='' || strlen($label)>200) $label='Dance-rudiment visualiser';
    return '<figure class="dance-moves-visualiser" data-dance-moves-visualiser-figure>'.
        '<canvas width="960" height="400" data-dance-moves-visualiser data-dance-moves-visualiser-renderer="'.esc_attr($renderer).'" role="img" aria-label="'.esc_attr($label).'" aria-describedby="'.esc_attr($status_id).'">'.
        'A dance-rudiment visualisation follows the selected movement source. Audio controls remain available.'.
        '</canvas><figcaption id="'.esc_attr($status_id).'" data-dance-moves-visualiser-status role="status" aria-live="polite" aria-atomic="true">Visualiser loads when this view is active.</figcaption></figure>';
}
function dance_moves_render_visualiser($attrs=array(),$content=null) {
    $page_id=get_the_ID();
    if (get_post_meta($page_id,'_dance_moves_song_page_type',true)==='collection') return '';
    $config=dance_moves_visualiser_page_config($page_id);
    if (!$config['visualiserRecordingUrl'] && !$config['visualiserRudiment']) return '';
    $attrs=is_array($attrs) ? $attrs : array();
    return dance_moves_visualiser_markup($attrs['renderer'] ?? $config['visualiserRenderer'],$attrs['label'] ?? 'Dance-rudiment visualiser');
}
add_shortcode('dance_moves_visualiser','dance_moves_render_visualiser');
