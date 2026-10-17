<?php
/** Optional per-word lyrics and multi-song Pages. Legacy single-song metadata is unchanged. */
if (!defined('ABSPATH')) { exit; }
define('DANCE_MOVES_META_WORD_TIMING', '_dance_moves_word_timing_id');
define('DANCE_MOVES_META_SONG_PAGE_TYPE', '_dance_moves_song_page_type');
define('DANCE_MOVES_META_SONG_COLLECTION', '_dance_moves_song_collection');

function dance_moves_word_timing_contents($contents, $ext) {
    if (!is_string($contents) || strlen($contents) > 1048576 || strpos($contents,"\0") !== false ||
        strpos($contents,"\xEF\xBF\xBD") !== false || !preg_match('//u', $contents)) {
        return new WP_Error('dance_moves_word_utf8', 'Word timing must be UTF-8, without null/replacement characters, under 1 MiB.');
    }
    $events = array();
    if ($ext === 'json') {
        $data = json_decode($contents, true, 16);
        $items = isset($data['words']) && is_array($data['words']) ? $data['words'] : $data;
        if (!is_array($items) || !array_is_list($items)) {
            return new WP_Error('dance_moves_word_json', 'Word timing JSON needs a words array.');
        }
        foreach ($items as $item) {
            if (!is_array($item)) return new WP_Error('dance_moves_word_json', 'Each word must be an object.');
            $events[] = array('start'=>$item['start'] ?? $item['time'] ?? null,
                'end'=>$item['end'] ?? null, 'word'=>$item['word'] ?? $item['text'] ?? null);
        }
    } elseif ($ext === 'tsv') {
        $lines = preg_split('/\r\n|\r|\n/', trim($contents));
        $columns = explode("\t", array_shift($lines));
        $head = array_map('strtolower', array_map('trim', $columns));
        if (in_array('start',$head,true) && in_array('end',$head,true) && (in_array('word',$head,true) || in_array('text',$head,true))) {
            $si=array_search('start',$head,true);$ei=array_search('end',$head,true);
            $wi=in_array('word',$head,true)?array_search('word',$head,true):array_search('text',$head,true);
        } else {
            $si=0;$ei=1;$wi=2;array_unshift($lines,implode("\t",$columns));
        }
        foreach ($lines as $line) {
            if (trim($line)==='') continue;
            $cells=explode("\t",$line);
            $events[]=array('start'=>$cells[$si] ?? null,'end'=>$cells[$ei] ?? null,'word'=>$cells[$wi] ?? null);
        }
    } elseif ($ext === 'lrc') {
        $lines = preg_split('/\r\n|\r|\n/', $contents);
        $stamp = '/([<\[])(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?[>\]]/';
        foreach ($lines as $line) {
            if (trim($line)==='') continue;
            preg_match_all($stamp,$line,$matches,PREG_OFFSET_CAPTURE);
            $tokens=array();
            foreach ($matches[0] as $i=>$full) {
                if (substr($full[0],-1)!==($matches[1][$i][0]==='<'?'>':']')) continue;
                $tokens[]=array('raw'=>$full[0],'offset'=>$full[1],'kind'=>$matches[1][$i][0],
                    'minutes'=>$matches[2][$i][0],'seconds'=>$matches[3][$i][0],'fraction'=>$matches[4][$i][0] ?? '');
            }
            $enhanced=array_values(array_filter($tokens,static function($item){return $item['kind']==='<';}));
            $chosen=$enhanced ?: array_values(array_filter($tokens,static function($item){return $item['kind']==='[';}));
            if (!$chosen) {
                if (preg_match('/^\[(ar|al|ti|by|offset):/i',trim($line))) continue;
                return new WP_Error('dance_moves_word_lrc','Untimed word LRC text is not accepted.');
            }
            if (!$enhanced && count($chosen)!==1) return new WP_Error('dance_moves_word_lrc','Use one [] timestamp per word or enhanced <> stamps.');
            foreach ($chosen as $i=>$stamp_item) {
                $begin=$stamp_item['offset']+strlen($stamp_item['raw']);
                $end=$chosen[$i+1]['offset'] ?? strlen($line);
                $fraction=$stamp_item['fraction']!==''?(float)('0.'.$stamp_item['fraction']):0.0;
                $events[]=array('start'=>(int)$stamp_item['minutes']*60+(int)$stamp_item['seconds']+$fraction,
                    'end'=>null,'word'=>trim(substr($line,$begin,$end-$begin)));
            }
        }
    } else {
        return new WP_Error('dance_moves_word_ext', 'Word timing files must be .lrc, .tsv or .json.');
    }
    if (count($events)<1 || count($events)>50000) return new WP_Error('dance_moves_word_count', 'Require 1..50000 word timestamps.');
    $prior=-1.0;
    foreach ($events as $event) {
        $start=$event['start'];$end=$event['end'];$word=$event['word'];
        if ((!is_float($start)&&!is_int($start)&&!is_string($start)) || !is_numeric($start) ||
            !is_finite((float)$start) || (float)$start<0 || (float)$start>86400 || (float)$start<$prior ||
            ($end!==null && (!is_numeric($end) || !is_finite((float)$end) || (float)$end<(float)$start || (float)$end>86400)) ||
            !is_string($word) || trim($word)==='' || strlen($word)>1024 || preg_match('/[\x00-\x1f]/', $word)) {
            return new WP_Error('dance_moves_word_event', 'Word times must be ordered, finite, and contain nonempty text.');
        }
        $prior=(float)$start;
    }
    return count($events);
}
function dance_moves_validate_word_timing_attachment($attachment_id) {
    $id=absint($attachment_id);
    if (!$id) return true;
    if (get_post_type($id)!=='attachment') return new WP_Error('dance_moves_word_media', 'Choose a Media Library word timing file.');
    $file=get_attached_file($id);
    if (!$file || !is_file($file) || !is_readable($file) || filesize($file)>1048576)
        return new WP_Error('dance_moves_word_file', 'Word timing file is missing or exceeds 1 MiB.');
    $ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));
    if (!in_array($ext,array('lrc','tsv','json'),true)) return new WP_Error('dance_moves_word_ext', 'Word timing must be .lrc, .tsv or .json.');
    return dance_moves_word_timing_contents(file_get_contents($file),$ext);
}
function dance_moves_word_upload_mimes($mimes) {
    $mimes['tsv']='text/tab-separated-values';$mimes['json']='application/json';return $mimes;
}
add_filter('upload_mimes','dance_moves_word_upload_mimes');
function dance_moves_word_filetype($check,$file,$filename,$mimes) {
    $ext=strtolower(pathinfo($filename,PATHINFO_EXTENSION));
    if (!in_array($ext,array('tsv','json'),true)) return $check;
    if (!is_file($file) || filesize($file)>1048576 || is_wp_error(dance_moves_word_timing_contents(file_get_contents($file),$ext))) return $check;
    return array('ext'=>$ext,'type'=>$ext==='json'?'application/json':'text/tab-separated-values','proper_filename'=>$filename);
}
add_filter('wp_check_filetype_and_ext','dance_moves_word_filetype',20,4);

/** Store attachment IDs and compact verified alignment/maps, NEVER arbitrary public URLs. */
function dance_moves_validate_song_collection($input) {
    if (is_string($input)) {
        if (strlen($input)>8388608) return new WP_Error('dance_moves_songs_size','Song collection exceeds 8 MiB.');
        $input=json_decode($input,true,16);
    }
    if (!is_array($input) || ($input['schema'] ?? '')!=='dancemoves.song-collection.v1' || !isset($input['songs']) || !is_array($input['songs']) ||
        count($input['songs'])<1 || count($input['songs'])>24) return new WP_Error('dance_moves_songs','Configure 1..24 songs.');
    $used=array();$clean=array();
    foreach ($input['songs'] as $row) {
        if (!is_array($row)) return new WP_Error('dance_moves_songs','Invalid song entry.');
        $id=$row['id'] ?? null;$title=$row['title'] ?? null;
        if (!is_string($id) || !preg_match('/^[a-z][a-z0-9_-]{0,63}$/D',$id) || isset($used[$id]) ||
            !is_string($title) || trim($title)==='' || strlen($title)>160) return new WP_Error('dance_moves_songs','Song IDs must be unique and each song must have a title.');
        $used[$id]=true;
        $audio_id=absint($row['audio_id'] ?? 0);
        if (!$audio_id || get_post_type($audio_id)!=='attachment' ||
            !str_starts_with((string)get_post_mime_type($audio_id),'audio/') ||
            !get_attached_file($audio_id) || !is_readable(get_attached_file($audio_id)) ||
            filesize(get_attached_file($audio_id))>536870912 || !dance_moves_attachment_url($audio_id)) {
            return new WP_Error('dance_moves_song_master', 'Each song needs its own readable public Media Library audio attachment.');
        }
        $bpm=$row['bpm'] ?? null;
        if (!is_numeric($bpm) || !is_finite((float)$bpm) || (float)$bpm<20 || (float)$bpm>400)
            return new WP_Error('dance_moves_song_bpm','Each song requires BPM from 20 to 400 (nominal BPM for variable tempo).');
        $lyric=absint($row['lyric_id'] ?? 0);$word=absint($row['word_id'] ?? 0);$cue=absint($row['cue_id'] ?? 0);
        foreach (array(array($lyric,'lyric'),array($cue,'cue')) as $pair) {
            $ok=dance_moves_validate_timing_attachment($pair[0],$pair[1]);
            if (is_wp_error($ok)) return $ok;
        }
        $words=dance_moves_validate_word_timing_attachment($word);
        if (is_wp_error($words)) return $words;
        $enabled=in_array($row['use_beat_timeline'] ?? false,array(true,1,'1'),true);
        $alignment=$row['beat_alignment'] ?? '';
        if (is_array($alignment)) $alignment=wp_json_encode($alignment);
        if (!is_string($alignment) || strlen($alignment)>16384) return new WP_Error('dance_moves_song_align','Invalid fixed beat alignment JSON.');
        $fixed=$alignment!=='' ? dance_moves_resolve_beat_alignment($alignment,$audio_id,$enabled?'':(float)$bpm) : null;
        if (is_wp_error($fixed)) {
            if (!$enabled) return $fixed;
            $fixed=null; // An inactive, stale fixed reading cannot block an enabled valid variable map.
        }
        $map=$row['beat_timeline'] ?? '';
        if (is_array($map)) $map=wp_json_encode($map);
        if (!is_string($map) || strlen($map)>4194304) return new WP_Error('dance_moves_song_map','Song beat timeline exceeds 4 MiB.');
        $timeline=($enabled || trim($map)!=='') ? dance_moves_resolve_beat_timeline($map,$audio_id) : null;
        if (is_wp_error($timeline)) {
            if ($enabled) return $timeline;
            $timeline=null; // Ignore a disabled stale map; fixed-BPM playback stays available.
        }
        if ($enabled && !$timeline) return new WP_Error('dance_moves_song_map','Enabled variable tempo requires a complete source-matched beat map.');
        $clean[]=array('id'=>$id,'title'=>sanitize_text_field($title),'audio_id'=>$audio_id,'bpm'=>(float)$bpm,
            'lyric_id'=>$lyric,'word_id'=>$word,'cue_id'=>$cue,
            'beat_alignment'=>$fixed ? dance_moves_parse_beat_alignment($alignment) : null,
            'use_beat_timeline'=>$enabled,'beat_timeline'=>$timeline ? dance_moves_parse_beat_timeline($map) : null);
    }
    $result=array('schema'=>'dancemoves.song-collection.v1','songs'=>$clean);
    if (strlen(wp_json_encode($result))>8388608) return new WP_Error('dance_moves_songs_size','Song collection exceeds 8 MiB.');
    return $result;
}
function dance_moves_parse_song_collection($input) {
    if (!is_string($input) || trim($input)==='') return null;
    return dance_moves_validate_song_collection($input);
}
function dance_moves_sanitize_song_collection($value) {
    $valid=dance_moves_validate_song_collection($value);
    return is_wp_error($valid)?'':wp_json_encode($valid);
}
function dance_moves_song_collection_config($page_id) {
    if (get_post_meta($page_id,DANCE_MOVES_META_SONG_PAGE_TYPE,true)!=='collection') return null;
    $stored=dance_moves_parse_song_collection((string)get_post_meta($page_id,DANCE_MOVES_META_SONG_COLLECTION,true));
    if (!$stored || is_wp_error($stored)) return $stored;
    $songs=array();
    foreach ($stored['songs'] as $row) {
        $master=dance_moves_attachment_url($row['audio_id']);
        $entry=array('id'=>$row['id'],'title'=>$row['title'],'audioSrc'=>$master,'bpm'=>$row['bpm'],
            'lyricTimingUrl'=>dance_moves_attachment_url($row['lyric_id']),
            'wordTimingUrl'=>dance_moves_attachment_url($row['word_id']),
            'cueTimingUrl'=>dance_moves_attachment_url($row['cue_id']),
            'lyricPopupsEnabled'=>false);
        if ($row['beat_alignment']) $entry['beatAlignment']=array_merge($row['beat_alignment'],array('source_url'=>$master));
        if ($row['use_beat_timeline'] && $row['beat_timeline']) $entry['beatTimeline']=array_merge($row['beat_timeline'],array('source_url'=>$master));
        $songs[]=$entry;
    }
    return array('schema'=>'dancemoves.song-collection.v1','songs'=>$songs);
}
function dance_moves_song_page_type_sanitize($value) {return $value==='collection'?'collection':'single';}
function dance_moves_register_song_collection_meta() {
    register_post_meta('page',DANCE_MOVES_META_WORD_TIMING,array('type'=>'integer','single'=>true,'default'=>0,
        'sanitize_callback'=>'dance_moves_sanitize_attachment_id','auth_callback'=>'dance_moves_meta_auth','show_in_rest'=>true,'revisions_enabled'=>true));
    register_post_meta('page',DANCE_MOVES_META_SONG_PAGE_TYPE,array('type'=>'string','single'=>true,'default'=>'single',
        'sanitize_callback'=>'dance_moves_song_page_type_sanitize','auth_callback'=>'dance_moves_meta_auth','show_in_rest'=>true,'revisions_enabled'=>true));
    register_post_meta('page',DANCE_MOVES_META_SONG_COLLECTION,array('type'=>'string','single'=>true,'default'=>'',
        'sanitize_callback'=>'dance_moves_sanitize_song_collection','auth_callback'=>'dance_moves_meta_auth','show_in_rest'=>true,'revisions_enabled'=>true));
}
add_action('init','dance_moves_register_song_collection_meta');
function dance_moves_song_revisions($keys) {return array_values(array_unique(array_merge($keys,array(DANCE_MOVES_META_WORD_TIMING,DANCE_MOVES_META_SONG_PAGE_TYPE,DANCE_MOVES_META_SONG_COLLECTION))));}
add_filter('wp_post_revision_meta_keys','dance_moves_song_revisions');
function dance_moves_song_rest_guard($prepared,$request) {
    $meta=$request->get_param('meta');
    if (!is_array($meta)) return $prepared;
    $id=$request->get_param('id') ?: 0;
    if (array_key_exists(DANCE_MOVES_META_WORD_TIMING,$meta)) {
        $word=dance_moves_validate_word_timing_attachment($meta[DANCE_MOVES_META_WORD_TIMING]);
        if (is_wp_error($word)) {$word->add_data(array('status'=>400));return $word;}
    }
    if (!array_key_exists(DANCE_MOVES_META_SONG_PAGE_TYPE,$meta) && !array_key_exists(DANCE_MOVES_META_SONG_COLLECTION,$meta)) return $prepared;
    $mode=$meta[DANCE_MOVES_META_SONG_PAGE_TYPE] ?? get_post_meta($id,DANCE_MOVES_META_SONG_PAGE_TYPE,true);
    if ($mode==='collection') {
        $raw=$meta[DANCE_MOVES_META_SONG_COLLECTION] ?? get_post_meta($id,DANCE_MOVES_META_SONG_COLLECTION,true);
        $value=dance_moves_validate_song_collection($raw);
        if (is_wp_error($value)) {$value->add_data(array('status'=>400));return $value;}
    }
    return $prepared;
}
add_filter('rest_pre_insert_page','dance_moves_song_rest_guard',20,2);

function dance_moves_song_collection_file_field($name,$label,$id,$allowed) {
    $id=absint($id);$filename=$id?basename((string)get_attached_file($id)):'';$url=dance_moves_attachment_url($id);
    echo '<div class="dance-moves-file-field" data-allowed-extensions="'.esc_attr(implode(',',$allowed)).'">';
    echo '<label><strong>'.esc_html($label).'</strong></label>';
    echo '<input type="hidden" name="'.esc_attr($name).'" value="'.esc_attr($id).'">';
    echo '<p class="dance-moves-file-name">'.esc_html($filename?:'No file selected').'</p>';
    echo '<a class="dance-moves-file-url" href="'.esc_url($url?:'#').'" target="_blank" rel="noopener"'.($url?'':' hidden').'>View attachment</a>';
    echo '<p><button type="button" class="button dance-moves-select-file">Choose file</button> ';
    echo '<button type="button" class="button-link-delete dance-moves-clear-file"'.($id?'':' hidden').'>Clear</button></p></div>';
}
function dance_moves_song_collection_row($row,$index) {
    $prefix='dance_moves_songs['.$index.']';
    $defaults=array('id'=>'song_'.(is_numeric($index) ? ($index+1) : '__INDEX__'),'title'=>'','audio_id'=>0,'bpm'=>120,'lyric_id'=>0,'word_id'=>0,'cue_id'=>0,'beat_alignment'=>null,'beat_timeline'=>null,'use_beat_timeline'=>false);
    $row=array_merge($defaults,is_array($row)?$row:array());
    echo '<fieldset class="dance-moves-song-row" data-dance-moves-song-row><legend>Song '.esc_html((string)(is_numeric($index)?($index+1):'__INDEX__')).'</legend>';
    echo '<label>Song ID <input name="'.esc_attr($prefix.'[id]').'" value="'.esc_attr($row['id']).'" required pattern="[a-z][a-z0-9_-]*"></label> ';
    echo '<label>Title <input name="'.esc_attr($prefix.'[title]').'" value="'.esc_attr($row['title']).'" required maxlength="160"></label> ';
    echo '<label>Nominal BPM <input name="'.esc_attr($prefix.'[bpm]').'" type="number" min="20" max="400" step="0.001" value="'.esc_attr($row['bpm']).'"></label>';
    dance_moves_song_collection_file_field($prefix.'[audio_id]','Master audio',$row['audio_id'],array('mp3','wav','flac','m4a','ogg'));
    dance_moves_song_collection_file_field($prefix.'[lyric_id]','Line lyrics (.lrc)',$row['lyric_id'],array('lrc'));
    dance_moves_song_collection_file_field($prefix.'[word_id]','Word lyrics (.lrc/.tsv/.json)',$row['word_id'],array('lrc','tsv','json'));
    dance_moves_song_collection_file_field($prefix.'[cue_id]','Cues (.lrc/.cue)',$row['cue_id'],array('lrc','cue'));
    $fixed=is_array($row['beat_alignment'])?wp_json_encode($row['beat_alignment']):(string)$row['beat_alignment'];
    $map=is_array($row['beat_timeline'])?wp_json_encode($row['beat_timeline']):(string)$row['beat_timeline'];
    echo '<label>Fixed beat alignment JSON <textarea name="'.esc_attr($prefix.'[beat_alignment]').'" rows="3">'.esc_textarea($fixed).'</textarea></label>';
    echo '<label><input type="checkbox" name="'.esc_attr($prefix.'[use_beat_timeline]').'" value="1"'.checked($row['use_beat_timeline'],true,false).'> Use variable-tempo map</label>';
    echo '<label>Full StemLab beat timeline JSON <textarea name="'.esc_attr($prefix.'[beat_timeline]').'" rows="3">'.esc_textarea($map).'</textarea></label>';
    echo '<p><button type="button" class="button dance-moves-remove-song">Remove song</button> <button type="button" class="button dance-moves-move-song-up">Move up</button> <button type="button" class="button dance-moves-move-song-down">Move down</button></p>';
    echo '</fieldset>';
}
function dance_moves_song_collection_meta_box($post) {
    $mode=get_post_meta($post->ID,DANCE_MOVES_META_SONG_PAGE_TYPE,true)==='collection'?'collection':'single';
    $rows=dance_moves_parse_song_collection((string)get_post_meta($post->ID,DANCE_MOVES_META_SONG_COLLECTION,true));
    $songs=is_array($rows)?$rows['songs']:array();
    wp_nonce_field('dance_moves_save_song_collection','dance_moves_song_collection_nonce');
    echo '<p><label><strong>Page type</strong> <select name="dance_moves_song_page_type" data-dance-moves-song-mode>';
    echo '<option value="single"'.selected($mode,'single',false).'>Single song (existing EPK timing)</option>';
    echo '<option value="collection"'.selected($mode,'collection',false).'>Multiple songs (independent clocks)</option></select></label></p>';
    echo '<p class="description">All song files come from the Media Library. Each track has independent source time, BPM/phase, lyrics, words and cues. Existing single-song fields remain unchanged.</p>';
    echo '<div class="dance-moves-song-rows" data-dance-moves-song-rows>';
    foreach ($songs as $index=>$entry) dance_moves_song_collection_row($entry,$index);
    echo '</div>';
    echo '<p><button type="button" class="button dance-moves-add-song">Add song</button> (maximum 24)</p>';
    // A template outside the form's active controls until the admin script instantiates it.
    echo '<template id="dance-moves-song-template">';dance_moves_song_collection_row(array(),'__INDEX__');echo '</template>';
    if (is_wp_error($rows)) echo '<p class="description">Saved song configuration needs review; it is not exposed to visitors.</p>';
}
function dance_moves_register_song_collection_box() {add_meta_box('dance-moves-multi-song','Song collection', 'dance_moves_song_collection_meta_box','page','normal','default');}
add_action('add_meta_boxes_page','dance_moves_register_song_collection_box');
function dance_moves_save_song_collection_meta($post_id) {
    if (!isset($_POST['dance_moves_song_collection_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['dance_moves_song_collection_nonce'])),'dance_moves_save_song_collection') ||
        (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post',$post_id)) return;
    $mode=dance_moves_song_page_type_sanitize((string)($_POST['dance_moves_song_page_type'] ?? 'single'));
    if ($mode==='collection') {
        $rows=isset($_POST['dance_moves_songs']) && is_array($_POST['dance_moves_songs'])?wp_unslash($_POST['dance_moves_songs']):array();
        $result=dance_moves_validate_song_collection(array('schema'=>'dancemoves.song-collection.v1','songs'=>array_values($rows)));
        if (is_wp_error($result)) {dance_moves_queue_admin_error($result->get_error_message().' Existing song list was preserved.');return;}
        update_post_meta($post_id,DANCE_MOVES_META_SONG_COLLECTION,wp_json_encode($result));
    }
    update_post_meta($post_id,DANCE_MOVES_META_SONG_PAGE_TYPE,$mode);
}
add_action('save_post_page','dance_moves_save_song_collection_meta',20);

function dance_moves_render_song_collection($attrs=array(),$content=null) {
    $page_id=get_the_ID();$report=dance_moves_song_collection_config($page_id);
    if (!$report || is_wp_error($report)) return '';
    ob_start(); ?>
    <section class="dance-moves-song-collection" data-dance-moves-song-collection aria-label="Music collection">
      <label>Choose song <select data-dance-moves-song-select>
        <?php foreach($report['songs'] as $song): ?><option value="<?php echo esc_attr($song['id']); ?>"><?php echo esc_html($song['title']); ?></option><?php endforeach; ?>
      </select></label>
      <?php foreach($report['songs'] as $i=>$song): ?>
        <section class="dance-moves-song ks-epk" data-dance-moves-song="<?php echo esc_attr($song['id']); ?>"<?php echo $i?' hidden':''; ?>>
          <h3><?php echo esc_html($song['title']); ?></h3>
          <audio controls preload="metadata" data-dance-moves-master src="<?php echo esc_url($song['audioSrc']); ?>"></audio>
          <div class="dance-moves-song-now" aria-live="off">BPM: <output data-dance-moves-current="bpm"><?php echo esc_html((string)$song['bpm']); ?></output> · Line: <output data-dance-moves-current="line"></output> · Word: <output data-dance-moves-current="word"></output> · Cue: <output data-dance-moves-current="cue"></output></div>
          <div class="dance-moves-song-timeline" role="group" aria-label="Song timeline">
            <span data-dance-moves-playhead class="dance-moves-song-playhead" aria-hidden="true"></span>
            <div class="dance-moves-song-lane" data-dance-moves-lane="beat" aria-label="Beats / tempo map"></div>
            <div class="dance-moves-song-lane" data-dance-moves-lane="line" aria-label="Line lyrics"></div>
            <div class="dance-moves-song-lane" data-dance-moves-lane="word" aria-label="Word lyrics"></div>
            <div class="dance-moves-song-lane" data-dance-moves-lane="cue" aria-label="Cues"></div>
          </div>
        </section>
      <?php endforeach; ?>
    </section>
    <?php return (string)ob_get_clean();
}
add_shortcode('dance_moves_song_collection','dance_moves_render_song_collection');
function dance_moves_song_collection_content($content) {
    if (is_admin() || !is_singular('page') || !is_main_query() || !in_the_loop() || has_shortcode($content,'dance_moves_song_collection')) return $content;
    return get_post_meta(get_the_ID(),DANCE_MOVES_META_SONG_PAGE_TYPE,true)==='collection'
        ? $content."\n".dance_moves_render_song_collection() : $content;
}
add_filter('the_content','dance_moves_song_collection_content',30);
