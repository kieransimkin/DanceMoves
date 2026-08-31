<?php
/**
 * Plugin Name: DanceMoves
 * Description: Adds BPM-synchronised motion, lyric and cue timing properties, named cue handlers, and permission-aware orientation control to EPK pages.
 * Version: 2.3.2
 * Author: Kieran Simkin
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DANCE_MOVES_VERSION', '2.3.2');
define('KS_EPK_ORIENTATION_VERSION', DANCE_MOVES_VERSION);
define('KS_EPK_MOTION_CAPTURE_TOKEN', 'e4c1d9a77fb446608e796a0f8fd8f576e59d2e67bca54a4d9f7fd06fbef3e1c2');

define('DANCE_MOVES_META_BPM', '_dance_moves_bpm');
define('DANCE_MOVES_META_LYRIC_TIMING', '_dance_moves_lyric_timing_id');
define('DANCE_MOVES_META_CUE_TIMING', '_dance_moves_cue_timing_id');
define('DANCE_MOVES_META_MASTER_DURATION', '_dance_moves_master_duration_ms');
define('DANCE_MOVES_CLAY_STARS_PAGE_ID', 252);

function dance_moves_orientation_adapters() {
    return array(
        130 => 'dying-for-a-diagnosis',
        140 => 'light-will-win',
        243 => 'presents-and-chocolate',
        252 => 'clay-stars',
        268 => 'fully-nocturnal',
        270 => 'amnesty-honestly',
        276 => 'walk-with-me',
        298 => 'dmitri-my-talisman',
    );
}

function dance_moves_shared_control_pages() {
    return array(
        250, 254, 260, 262, 264, 266, 272, 274, 278, 280,
        282, 284, 286, 288, 290, 292, 294, 296, 300, 302,
        304, 306, 308, 312, 314, 316, 318, 320, 322,
    );
}

function dance_moves_lyric_disclosure_ticks($page_id) {
    if (130 === (int) $page_id) {
        return 5;
    }
    if (243 === (int) $page_id) {
        return 7;
    }
    return 6;
}

function dance_moves_attachment_url($attachment_id) {
    $attachment_id = absint($attachment_id);
    if (!$attachment_id) {
        return '';
    }
    $url = wp_get_attachment_url($attachment_id);
    return is_string($url) ? esc_url_raw($url) : '';
}

function dance_moves_get_page_config($page_id) {
    $stored_bpm = get_post_meta($page_id, DANCE_MOVES_META_BPM, true);
    $bpm = is_numeric($stored_bpm) ? (float) $stored_bpm : 120.0;
    $source = is_numeric($stored_bpm) ? 'explicit' : 'fallback';
    if (!is_finite($bpm) || $bpm < 20 || $bpm > 400) {
        $bpm = 120.0;
        $source = 'fallback';
    }

    $master_duration = get_post_meta($page_id, DANCE_MOVES_META_MASTER_DURATION, true);
    $master_duration = is_numeric($master_duration) && (float) $master_duration > 0 ? (float) $master_duration : 0.0;

    return array(
        'pageId' => absint($page_id),
        'version' => DANCE_MOVES_VERSION,
        'bpm' => $bpm,
        'bpmSource' => $source,
        'fallbackBpm' => 120,
        'lyricTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_LYRIC_TIMING, true)),
        'cueTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_CUE_TIMING, true)),
        'masterDurationMilliseconds' => $master_duration,
        'tickDefinition' => 'sixteenth-of-beat',
        'ticksPerBeat' => 16,
        'longDurationQuantumTicks' => 16,
        'sharedControlTicks' => in_array((int) $page_id, dance_moves_shared_control_pages(), true) ? 8 : 0,
        'lyricDisclosureTicks' => dance_moves_lyric_disclosure_ticks($page_id),
    );
}

function ks_epk_orientation_enqueue_runtime() {
    $page_id = get_queried_object_id();
    if (!$page_id || !is_page($page_id)) {
        return;
    }

    $adapters = dance_moves_orientation_adapters();
    $base_url = plugin_dir_url(__FILE__) . 'assets/';
    $config = dance_moves_get_page_config($page_id);

    wp_enqueue_style(
        'dance-moves-core',
        $base_url . 'dance-moves-core.css',
        array(),
        DANCE_MOVES_VERSION
    );

    wp_enqueue_script(
        'dance-moves-core',
        $base_url . 'dance-moves-core.js',
        array(),
        DANCE_MOVES_VERSION,
        true
    );
    wp_localize_script('dance-moves-core', 'danceMovesConfig', $config);

    wp_enqueue_script(
        'dance-moves-catalogue-timing',
        $base_url . 'dance-moves-catalogue-timing.js',
        array('dance-moves-core'),
        DANCE_MOVES_VERSION,
        true
    );

    if (DANCE_MOVES_CLAY_STARS_PAGE_ID === (int) $page_id && !defined('KS_CLAY_STARS_EFFECTS_VERSION')) {
        wp_enqueue_style(
            'dance-moves-clay-stars',
            $base_url . 'clay-stars-effects.css',
            array(),
            DANCE_MOVES_VERSION
        );
        wp_enqueue_script(
            'dance-moves-clay-stars',
            $base_url . 'clay-stars-effects.js',
            array('dance-moves-core'),
            DANCE_MOVES_VERSION,
            true
        );
    }

    if (!isset($adapters[$page_id])) {
        return;
    }

    wp_enqueue_style(
        'ks-epk-device-orientation',
        $base_url . 'ks-epk-device-orientation.css',
        array(),
        KS_EPK_ORIENTATION_VERSION
    );

    wp_enqueue_script(
        'ks-epk-device-orientation-core',
        $base_url . 'ks-epk-device-orientation-core.js',
        array(),
        KS_EPK_ORIENTATION_VERSION,
        true
    );

    $orientation_dependencies = array('ks-epk-device-orientation-core', 'dance-moves-core');
    if (DANCE_MOVES_CLAY_STARS_PAGE_ID === (int) $page_id && !defined('KS_CLAY_STARS_EFFECTS_VERSION')) {
        $orientation_dependencies[] = 'dance-moves-clay-stars';
    }

    wp_enqueue_script(
        'ks-epk-device-orientation',
        $base_url . 'ks-epk-device-orientation.js',
        $orientation_dependencies,
        KS_EPK_ORIENTATION_VERSION,
        true
    );

    wp_localize_script(
        'ks-epk-device-orientation',
        'ksEpkOrientationConfig',
        array(
            'adapter' => $adapters[$page_id],
            'pageId' => $page_id,
            'version' => KS_EPK_ORIENTATION_VERSION,
            'bpm' => $config['bpm'],
            'bpmSource' => $config['bpmSource'],
        )
    );
}
add_action('wp_enqueue_scripts', 'ks_epk_orientation_enqueue_runtime', 20);

function ks_epk_motion_register_capture_type() {
    register_post_type('ks_motion_capture', array(
        'labels' => array(
            'name' => 'Motion Captures',
            'singular_name' => 'Motion Capture',
        ),
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => 'tools.php',
        'show_in_rest' => false,
        'supports' => array('title', 'editor'),
        'map_meta_cap' => true,
    ));
}
add_action('init', 'ks_epk_motion_register_capture_type');

function ks_epk_motion_capture_permission(WP_REST_Request $request) {
    $provided = (string) $request->get_header('X-KS-Motion-Token');
    if ($provided === '' || !hash_equals(KS_EPK_MOTION_CAPTURE_TOKEN, $provided)) {
        return new WP_Error('ks_motion_forbidden', 'Invalid motion-capture token.', array('status' => 403));
    }

    $origin = get_http_origin();
    if ($origin && untrailingslashit($origin) !== untrailingslashit(home_url())) {
        return new WP_Error('ks_motion_origin', 'Motion captures must come from this site.', array('status' => 403));
    }

    $address = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $rate_key = 'ks_motion_' . md5($address);
    $attempts = (int) get_transient($rate_key);
    if ($attempts >= 8) {
        return new WP_Error('ks_motion_rate', 'Too many motion captures. Try again later.', array('status' => 429));
    }
    set_transient($rate_key, $attempts + 1, 10 * MINUTE_IN_SECONDS);
    return true;
}

function ks_epk_motion_finite_number($value, $minimum, $maximum) {
    if (!is_numeric($value)) {
        return null;
    }
    $number = (float) $value;
    if (!is_finite($number) || $number < $minimum || $number > $maximum) {
        return null;
    }
    return $number;
}

function ks_epk_motion_store_capture(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload) || ($payload['schema'] ?? '') !== 'ks-epk-motion-recording/v1') {
        return new WP_Error('ks_motion_schema', 'Unsupported motion-capture schema.', array('status' => 400));
    }

    $samples = $payload['samples'] ?? null;
    if (!is_array($samples) || count($samples) < 1 || count($samples) > 500) {
        return new WP_Error('ks_motion_samples', 'A capture must contain between 1 and 500 samples.', array('status' => 400));
    }

    $clean_samples = array();
    foreach ($samples as $sample) {
        if (!is_array($sample)) {
            continue;
        }
        $milliseconds = ks_epk_motion_finite_number($sample['milliseconds'] ?? null, 0, 120000);
        $beta = ks_epk_motion_finite_number($sample['beta'] ?? null, -180, 180);
        $gamma = ks_epk_motion_finite_number($sample['gamma'] ?? null, -90, 90);
        if ($milliseconds === null || $beta === null || $gamma === null) {
            continue;
        }
        $alpha = $sample['alpha'] ?? null;
        $alpha = $alpha === null ? null : ks_epk_motion_finite_number($alpha, 0, 360);
        $clean_samples[] = array(
            'milliseconds' => $milliseconds,
            'alpha' => $alpha,
            'beta' => $beta,
            'gamma' => $gamma,
            'absolute' => !empty($sample['absolute']),
            'screenAngle' => ks_epk_motion_finite_number($sample['screenAngle'] ?? 0, -360, 360),
            'nativeTrusted' => !empty($sample['nativeTrusted']),
            'simulatedTrusted' => !empty($sample['simulatedTrusted']),
            'fieldParity' => !empty($sample['fieldParity']),
            'dispatchParity' => !empty($sample['dispatchParity']),
            'mapperParity' => !empty($sample['mapperParity']),
        );
    }
    if (count($clean_samples) !== count($samples)) {
        return new WP_Error('ks_motion_invalid_samples', 'One or more motion samples were invalid.', array('status' => 400));
    }

    $clean_failures = array();
    if (is_array($payload['failures'] ?? null)) {
        foreach (array_slice($payload['failures'], 0, 100) as $failure) {
            if (!is_array($failure)) {
                continue;
            }
            $clean_failures[] = array(
                'type' => sanitize_key((string) ($failure['type'] ?? 'unknown')),
                'sample' => isset($failure['sample']) ? absint($failure['sample']) : null,
                'validPairs' => isset($failure['validPairs']) ? absint($failure['validPairs']) : null,
            );
        }
    }

    $clean_payload = array(
        'schema' => 'ks-epk-motion-recording/v1',
        'capturedAt' => sanitize_text_field((string) ($payload['capturedAt'] ?? '')),
        'userAgent' => sanitize_text_field((string) ($payload['userAgent'] ?? '')),
        'screenAngle' => ks_epk_motion_finite_number($payload['screenAngle'] ?? 0, -360, 360),
        'targetDurationMilliseconds' => ks_epk_motion_finite_number($payload['targetDurationMilliseconds'] ?? 0, 0, 120000),
        'captureDurationMilliseconds' => ks_epk_motion_finite_number($payload['captureDurationMilliseconds'] ?? 0, 0, 120000),
        'sampledDurationMilliseconds' => ks_epk_motion_finite_number($payload['sampledDurationMilliseconds'] ?? 0, 0, 120000),
        'processedPairCount' => min(100000, absint($payload['processedPairCount'] ?? count($clean_samples))),
        'storedSampleCount' => count($clean_samples),
        'storageIntervalMilliseconds' => ks_epk_motion_finite_number($payload['storageIntervalMilliseconds'] ?? 0, 0, 120000),
        'sampleStrategy' => sanitize_key((string) ($payload['sampleStrategy'] ?? 'legacy')),
        'fullWindowObserved' => !empty($payload['fullWindowObserved']),
        'expectedDifference' => sanitize_text_field((string) ($payload['expectedDifference'] ?? '')),
        'passed' => !empty($payload['passed']),
        'failureCount' => min(100000, absint($payload['failureCount'] ?? count($clean_failures))),
        'failures' => $clean_failures,
        'samples' => $clean_samples,
    );
    $encoded = wp_json_encode($clean_payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || strlen($encoded) > 262144) {
        return new WP_Error('ks_motion_size', 'The motion capture is too large.', array('status' => 413));
    }

    $post_id = wp_insert_post(array(
        'post_type' => 'ks_motion_capture',
        'post_status' => 'private',
        'post_title' => 'Phone motion capture ' . current_time('Y-m-d H:i:s'),
        'post_content' => $encoded,
    ), true);
    if (is_wp_error($post_id)) {
        return $post_id;
    }
    update_post_meta($post_id, '_ks_motion_passed', !empty($clean_payload['passed']) ? '1' : '0');
    update_post_meta($post_id, '_ks_motion_sample_count', count($clean_samples));
    update_post_meta($post_id, '_ks_motion_sha256', hash('sha256', $encoded));

    return rest_ensure_response(array(
        'captureId' => $post_id,
        'sampleCount' => count($clean_samples),
        'storedPrivately' => true,
    ));
}

function ks_epk_motion_register_rest_route() {
    register_rest_route('ks-epk-motion/v1', '/capture', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'ks_epk_motion_store_capture',
        'permission_callback' => 'ks_epk_motion_capture_permission',
    ));
}
add_action('rest_api_init', 'ks_epk_motion_register_rest_route');

function dance_moves_sanitize_bpm($value) {
    if ($value === '' || $value === null) {
        return '';
    }
    if (!is_numeric($value)) {
        return '';
    }
    $number = (float) $value;
    if (!is_finite($number) || $number < 20 || $number > 400) {
        return '';
    }
    return round($number, 3);
}

function dance_moves_sanitize_attachment_id($value) {
    return absint($value);
}

function dance_moves_sanitize_duration($value) {
    if (!is_numeric($value)) {
        return 0;
    }
    $number = (float) $value;
    return is_finite($number) && $number > 0 && $number <= DAY_IN_SECONDS * 1000 ? round($number, 3) : 0;
}

function dance_moves_meta_auth($allowed, $meta_key, $post_id) {
    return current_user_can('edit_post', $post_id);
}

function dance_moves_register_page_meta() {
    register_post_meta('page', DANCE_MOVES_META_BPM, array(
        'type' => 'number',
        'single' => true,
        'default' => 0,
        'sanitize_callback' => 'dance_moves_sanitize_bpm',
        'auth_callback' => 'dance_moves_meta_auth',
        'show_in_rest' => true,
        'revisions_enabled' => true,
    ));
    register_post_meta('page', DANCE_MOVES_META_LYRIC_TIMING, array(
        'type' => 'integer',
        'single' => true,
        'default' => 0,
        'sanitize_callback' => 'dance_moves_sanitize_attachment_id',
        'auth_callback' => 'dance_moves_meta_auth',
        'show_in_rest' => true,
        'revisions_enabled' => true,
    ));
    register_post_meta('page', DANCE_MOVES_META_CUE_TIMING, array(
        'type' => 'integer',
        'single' => true,
        'default' => 0,
        'sanitize_callback' => 'dance_moves_sanitize_attachment_id',
        'auth_callback' => 'dance_moves_meta_auth',
        'show_in_rest' => true,
        'revisions_enabled' => true,
    ));
    register_post_meta('page', DANCE_MOVES_META_MASTER_DURATION, array(
        'type' => 'number',
        'single' => true,
        'default' => 0,
        'sanitize_callback' => 'dance_moves_sanitize_duration',
        'auth_callback' => 'dance_moves_meta_auth',
        'show_in_rest' => false,
        'revisions_enabled' => true,
    ));
}
add_action('init', 'dance_moves_register_page_meta');

function dance_moves_revision_meta_keys($keys) {
    return array_values(array_unique(array_merge($keys, array(
        DANCE_MOVES_META_BPM,
        DANCE_MOVES_META_LYRIC_TIMING,
        DANCE_MOVES_META_CUE_TIMING,
        DANCE_MOVES_META_MASTER_DURATION,
    ))));
}
add_filter('wp_post_revision_meta_keys', 'dance_moves_revision_meta_keys');

function dance_moves_add_meta_box() {
    add_meta_box(
        'dance-moves-epk-timing',
        'EPK Timing',
        'dance_moves_render_meta_box',
        'page',
        'side',
        'default'
    );
}
add_action('add_meta_boxes_page', 'dance_moves_add_meta_box');

function dance_moves_file_field($post_id, $label, $field_name, $meta_key, $allowed_extensions) {
    $attachment_id = absint(get_post_meta($post_id, $meta_key, true));
    $url = dance_moves_attachment_url($attachment_id);
    $filename = $attachment_id ? basename((string) get_attached_file($attachment_id)) : '';
    ?>
    <div class="dance-moves-file-field" data-allowed-extensions="<?php echo esc_attr(implode(',', $allowed_extensions)); ?>">
        <label for="<?php echo esc_attr($field_name); ?>"><strong><?php echo esc_html($label); ?></strong></label>
        <input type="hidden" id="<?php echo esc_attr($field_name); ?>" name="<?php echo esc_attr($field_name); ?>" value="<?php echo esc_attr($attachment_id); ?>">
        <p class="dance-moves-file-name" aria-live="polite"><?php echo $filename ? esc_html($filename) : 'No file selected'; ?></p>
        <?php if ($url) : ?>
            <p><a class="dance-moves-file-url" href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener noreferrer">View timing file</a></p>
        <?php else : ?>
            <p><a class="dance-moves-file-url" href="#" target="_blank" rel="noopener noreferrer" hidden>View timing file</a></p>
        <?php endif; ?>
        <p>
            <button type="button" class="button dance-moves-select-file">Choose file</button>
            <button type="button" class="button-link-delete dance-moves-clear-file"<?php echo $attachment_id ? '' : ' hidden'; ?>>Clear</button>
        </p>
    </div>
    <?php
}

function dance_moves_render_meta_box($post) {
    wp_nonce_field('dance_moves_save_epk_timing', 'dance_moves_epk_timing_nonce');
    $stored_bpm = get_post_meta($post->ID, DANCE_MOVES_META_BPM, true);
    $display_bpm = is_numeric($stored_bpm) && (float) $stored_bpm >= 20 && (float) $stored_bpm <= 400 ? $stored_bpm : '';
    ?>
    <p>
        <label for="dance_moves_bpm"><strong>BPM</strong></label>
        <input class="widefat" type="number" min="20" max="400" step="0.001" id="dance_moves_bpm" name="dance_moves_bpm" value="<?php echo esc_attr($display_bpm); ?>" placeholder="120">
        <span class="description"><?php echo $display_bpm === '' ? 'Unknown; DanceMoves currently uses the 120 BPM fallback.' : 'Stored as the page BPM property.'; ?></span>
    </p>
    <?php
    dance_moves_file_field($post->ID, 'Lyric Timing File', 'dance_moves_lyric_timing_id', DANCE_MOVES_META_LYRIC_TIMING, array('lrc'));
    dance_moves_file_field($post->ID, 'Cue Timing File', 'dance_moves_cue_timing_id', DANCE_MOVES_META_CUE_TIMING, array('lrc', 'cue'));
}

function dance_moves_admin_assets($hook) {
    if (!in_array($hook, array('post.php', 'post-new.php'), true)) {
        return;
    }
    $screen = get_current_screen();
    if (!$screen || 'page' !== $screen->post_type) {
        return;
    }
    wp_enqueue_media();
    wp_enqueue_script(
        'dance-moves-admin',
        plugin_dir_url(__FILE__) . 'assets/dance-moves-admin.js',
        array('jquery'),
        DANCE_MOVES_VERSION,
        true
    );
}
add_action('admin_enqueue_scripts', 'dance_moves_admin_assets');

function dance_moves_timing_upload_mimes($mimes) {
    $mimes['lrc'] = 'text/plain';
    $mimes['cue'] = 'text/plain';
    return $mimes;
}
add_filter('upload_mimes', 'dance_moves_timing_upload_mimes');

function dance_moves_timing_filetype($data, $file, $filename, $mimes) {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (!in_array($extension, array('lrc', 'cue'), true)) {
        return $data;
    }
    $size = is_readable($file) ? filesize($file) : false;
    $contents = is_int($size) && $size <= 1048576 ? file_get_contents($file) : false;
    if (!is_string($contents) || strpos($contents, "\0") !== false || !preg_match('//u', $contents)) {
        return $data;
    }
    $data['ext'] = $extension;
    $data['type'] = 'text/plain';
    $data['proper_filename'] = $filename;
    return $data;
}
add_filter('wp_check_filetype_and_ext', 'dance_moves_timing_filetype', 10, 4);

function dance_moves_validate_timing_attachment($attachment_id, $kind) {
    $attachment_id = absint($attachment_id);
    if (!$attachment_id) {
        return true;
    }
    if ('attachment' !== get_post_type($attachment_id)) {
        return new WP_Error('dance_moves_attachment', 'The selected timing file is not a Media Library attachment.');
    }
    $path = get_attached_file($attachment_id);
    if (!$path || !is_readable($path) || filesize($path) > 1048576) {
        return new WP_Error('dance_moves_file', 'The timing file is missing, unreadable, or larger than 1 MiB.');
    }
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $allowed = 'lyric' === $kind ? array('lrc') : array('lrc', 'cue');
    if (!in_array($extension, $allowed, true)) {
        return new WP_Error('dance_moves_extension', 'The selected file extension is not valid for this field.');
    }
    $contents = file_get_contents($path);
    if (!is_string($contents) || strpos($contents, "\0") !== false || strpos($contents, "\xEF\xBF\xBD") !== false || !preg_match('//u', $contents)) {
        return new WP_Error('dance_moves_utf8', 'Timing files must be valid UTF-8 with no replacement or null characters.');
    }
    preg_match_all('/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/', $contents, $matches, PREG_SET_ORDER);
    if (!$matches) {
        return new WP_Error('dance_moves_timestamps', 'The timing file must contain at least one LRC or CUE timestamp.');
    }
    $previous = -1.0;
    foreach ($matches as $match) {
        $fraction = isset($match[3]) ? (float) ('0.' . str_pad($match[3], 3, '0')) : 0.0;
        $seconds = ((int) $match[1] * 60) + (int) $match[2] + $fraction;
        if ($seconds < $previous) {
            return new WP_Error('dance_moves_order', 'Timing-file timestamps must be monotonic.');
        }
        $previous = $seconds;
    }
    return true;
}

function dance_moves_queue_admin_error($message) {
    set_transient('dance_moves_admin_error_' . get_current_user_id(), sanitize_text_field($message), 60);
}

function dance_moves_admin_notice() {
    $key = 'dance_moves_admin_error_' . get_current_user_id();
    $message = get_transient($key);
    if (!$message) {
        return;
    }
    delete_transient($key);
    echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($message) . '</p></div>';
}
add_action('admin_notices', 'dance_moves_admin_notice');

function dance_moves_save_page_meta($post_id) {
    if (!isset($_POST['dance_moves_epk_timing_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['dance_moves_epk_timing_nonce'])), 'dance_moves_save_epk_timing')) {
        return;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    $raw_bpm = isset($_POST['dance_moves_bpm']) ? trim((string) wp_unslash($_POST['dance_moves_bpm'])) : '';
    if ($raw_bpm === '') {
        delete_post_meta($post_id, DANCE_MOVES_META_BPM);
    } else {
        $bpm = dance_moves_sanitize_bpm($raw_bpm);
        if ($bpm === '') {
            dance_moves_queue_admin_error('BPM must be a finite number from 20 to 400. The previous value was preserved.');
        } else {
            update_post_meta($post_id, DANCE_MOVES_META_BPM, $bpm);
        }
    }

    $fields = array(
        'dance_moves_lyric_timing_id' => array(DANCE_MOVES_META_LYRIC_TIMING, 'lyric'),
        'dance_moves_cue_timing_id' => array(DANCE_MOVES_META_CUE_TIMING, 'cue'),
    );
    foreach ($fields as $field => $definition) {
        $attachment_id = isset($_POST[$field]) ? absint($_POST[$field]) : 0;
        if (!$attachment_id) {
            delete_post_meta($post_id, $definition[0]);
            continue;
        }
        $valid = dance_moves_validate_timing_attachment($attachment_id, $definition[1]);
        if (is_wp_error($valid)) {
            dance_moves_queue_admin_error($valid->get_error_message() . ' The previous timing-file selection was preserved.');
            continue;
        }
        update_post_meta($post_id, $definition[0], $attachment_id);
    }
}
add_action('save_post_page', 'dance_moves_save_page_meta');

function dance_moves_clay_stars_is_target() {
    return is_page(DANCE_MOVES_CLAY_STARS_PAGE_ID);
}

function dance_moves_clay_stars_filter_content($content) {
    if (defined('KS_CLAY_STARS_EFFECTS_VERSION') || is_admin() || !dance_moves_clay_stars_is_target() || !in_the_loop() || !is_main_query()) {
        return $content;
    }
    if (false === strpos($content, 'ks-clay-stars-v2')) {
        return $content;
    }
    if (false === strpos($content, 'ks-warm-bloom')) {
        $content = preg_replace(
            '/<div class="epk-cover-wrap">/',
            '<div class="epk-cover-wrap"><span class="ks-warm-bloom" aria-hidden="true"></span><span class="ks-lens-flare" aria-hidden="true"></span><span class="ks-specular-sweep" aria-hidden="true"></span>',
            $content,
            1
        );
    }
    if (false === strpos($content, 'ks-cloud-field')) {
        $content = preg_replace(
            '/(<div class="epk-atmosphere"[^>]*aria-hidden="true"><\/div>)/',
            '$1' . "\n  " . '<span class="ks-cloud-field" aria-hidden="true"></span>',
            $content,
            1
        );
    }
    $content = preg_replace('#<script id="ks-clay-stars-v2-script">.*?</script>#s', '', $content, 1);
    return is_string($content) ? $content : '';
}
add_filter('the_content', 'dance_moves_clay_stars_filter_content', 20);
